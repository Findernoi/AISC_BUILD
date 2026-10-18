"""Reproducible, two-feature placement experiment; never modifies source CSVs."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import platform
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import sklearn
from sklearn.dummy import DummyClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, log_loss, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "campus_recruitment"
ARTIFACTS = Path(__file__).resolve().parent / "artifacts"
FEATURES = ("CGPA", "Projects")
TARGET = "PlacementStatus"
LABELS = {"NotPlaced": 0, "Placed": 1}
SPLITS = ("train", "validation", "test")
SEED = 20261018
C_VALUES = (0.01, 0.1, 1.0, 10.0, 100.0)


def fingerprint(row: dict) -> tuple:
    """Use ALL original predictor columns, excluding the target and split."""
    return tuple(sorted((k, v.strip()) for k, v in row.items() if k != TARGET))


def prepare_splits(source: dict[str, list[dict]]) -> tuple[dict, dict, dict]:
    """Protect test, then validation; keep label disagreements within a split."""
    memberships = defaultdict(set)
    labels = defaultdict(set)
    exact = Counter()
    for split in SPLITS:
        for row in source[split]:
            key = fingerprint(row)
            memberships[key].add(split)
            labels[key].add(row[TARGET])
            exact[(key, row[TARGET])] += 1
    cleaned, indices, removed = {}, {}, {}
    protected = set()
    for split in reversed(SPLITS):
        seen = set()
        cleaned[split], indices[split] = [], []
        removed[split] = {"cross_split": 0, "within_split": 0}
        for line, row in enumerate(source[split], start=2):
            key = fingerprint(row)
            exact_key = (key, row[TARGET])
            if key in protected:
                removed[split]["cross_split"] += 1
            elif exact_key in seen:
                removed[split]["within_split"] += 1
            else:
                cleaned[split].append(row)
                indices[split].append(line)
                seen.add(exact_key)
        protected.update(fingerprint(row) for row in source[split])
    audit = {
        "policy": "Keep source splits; protect test > validation > train using all original predictor columns. Deduplicate identical predictor+label rows within each retained split. Keep differing labels within the winning source split.",
        "raw_rows": {s: len(source[s]) for s in SPLITS},
        "retained_rows": {s: len(cleaned[s]) for s in SPLITS},
        "removed_rows": removed,
        "raw_duplicate_predictor_and_label_excess_rows": sum(n - 1 for n in exact.values()),
        "raw_cross_split_predictor_groups": sum(len(s) > 1 for s in memberships.values()),
        "raw_predictor_groups_with_differing_labels": sum(len(s) > 1 for s in labels.values()),
        "retained_labels": {s: dict(Counter(r[TARGET] for r in cleaned[s])) for s in SPLITS},
        "note": "No person ID is available. Identical profiles are not proof of the same person; conservative overlap filtering changes the evaluated population. Matching only the model inputs is not treated as a duplicate.",
    }
    keys = {s: {fingerprint(r) for r in cleaned[s]} for s in SPLITS}
    assert all(not keys[a] & keys[b] for i, a in enumerate(SPLITS) for b in SPLITS[i + 1:])
    return cleaned, audit, indices


def parse_feature(value: str | None, name: str) -> float:
    if value is None or not value.strip():
        return float("nan")
    number = float(value)
    if not math.isfinite(number) or number < 0:
        raise ValueError(f"Invalid {name}: expected a finite nonnegative value")
    if name == "CGPA" and number > 10:
        raise ValueError("CGPA must be on the dataset's 0–10 scale")
    if name != "CGPA" and not number.is_integer():
        raise ValueError(f"{name} must be an integer count")
    return number


def matrix(rows: list[dict]) -> tuple[np.ndarray, np.ndarray]:
    x = np.array([[parse_feature(row.get(name), name) for name in FEATURES] for row in rows])
    y = np.array([LABELS[row[TARGET]] for row in rows])
    if len(set(y)) != 2:
        raise ValueError("Each split must contain both target classes")
    return x, y


def load_data(data_dir: Path = DATA) -> tuple[dict, dict, dict]:
    manifest = json.loads((data_dir / "manifest.json").read_text(encoding="utf-8"))
    source, checksums = {}, {}
    for split in SPLITS:
        name = f"{split}.csv"
        path = data_dir / name
        checksum = hashlib.sha256(path.read_bytes()).hexdigest()
        if checksum != manifest["files"][name]["sha256"]:
            raise ValueError(f"Source checksum mismatch: {name}")
        checksums[name] = checksum
        with path.open(encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream)
            if not set((*FEATURES, TARGET)).issubset(reader.fieldnames or []):
                raise ValueError(f"Required columns missing: {name}")
            source[split] = list(reader)
        matrix(source[split])  # Reject malformed inputs before filtering.
    cleaned, audit, indices = prepare_splits(source)
    audit["source_sha256"] = checksums
    audit["missing_model_inputs_raw"] = {
        s: {name: sum(not r.get(name, "").strip() for r in source[s]) for name in FEATURES}
        for s in SPLITS
    }
    return cleaned, audit, indices


def build_pipeline(c: float) -> Pipeline:
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("classifier", LogisticRegression(C=c, random_state=SEED, max_iter=2000)),
    ])


def calibration_bins(y: np.ndarray, probability: np.ndarray) -> list[dict]:
    result = []
    for i in range(10):
        mask = (probability >= i / 10) & ((probability <= 1) if i == 9 else (probability < (i + 1) / 10))
        if mask.any():
            result.append({"lower": i / 10, "upper": (i + 1) / 10, "count": int(mask.sum()),
                           "mean_probability": float(probability[mask].mean()),
                           "observed_placement_rate": float(y[mask].mean())})
    return result


def scores(y: np.ndarray, probability: np.ndarray) -> dict:
    return {
        "roc_auc": float(roc_auc_score(y, probability)),
        "average_precision": float(average_precision_score(y, probability)),
        "brier_score": float(brier_score_loss(y, probability)),
        "log_loss": float(log_loss(y, probability)),
        "calibration_bins": calibration_bins(y, probability),
    }


def export_model(pipeline: Pipeline, x_train: np.ndarray, checksums: dict, c: float) -> dict:
    return {
        "schema_version": 2,
        "model_type": "logistic_regression",
        "features": list(FEATURES),
        "app_fields": ["gpaOn10Scale", "projectCount"],
        "target": TARGET,
        "positive_class": "Placed",
        "seed": SEED,
        "selected_C": c,
        "imputer": {"strategy": "median", "statistics": pipeline["imputer"].statistics_.tolist()},
        "scaler": {"mean": pipeline["scaler"].mean_.tolist(), "scale": pipeline["scaler"].scale_.tolist()},
        "coefficients": pipeline["classifier"].coef_[0].tolist(),
        "intercept": float(pipeline["classifier"].intercept_[0]),
        "calibration": "none; reliability assessed using held-out calibration bins",
        "training_ranges": {name: [float(np.nanmin(x_train[:, i])), float(np.nanmax(x_train[:, i]))]
                            for i, name in enumerate(FEATURES)},
        "input_policy": "CGPA on 0–10 scale; Projects is a nonnegative integer count. Missing values use TRAIN medians. Warn outside training ranges; do not clamp. No internship input is used.",
        "fit_scope": "Retained train rows only; validation selects C; test evaluates the selected model once. No train+validation refit.",
        "source": "https://huggingface.co/datasets/Krooz/Campus_Recruitment_CSV",
        "source_revision": "21406aa2f2326cfdff1a90babffc6d141753706d",
        "source_license_as_published": "CC0-1.0",
        "source_sha256": checksums,
        "runtime": {"python": platform.python_version(), "numpy": np.__version__, "scikit_learn": sklearn.__version__},
        "limitations": ["External campus dataset with limited collection provenance; real/synthetic status unverified.",
                        "Not validated for UIT, a particular company, or a particular job.",
                        "Placement outcome is not an HR decision rule; no automatic rejection or hiring.",
                        "Conservative full-profile overlap filtering changes the evaluated population.",
                        "Two-input profiles can legitimately recur across splits; there is no person identifier."],
    }


def predict_exported(model: dict, values: list[float | None]) -> float:
    if len(values) != len(FEATURES):
        raise ValueError("Expected two model inputs")
    numbers = [parse_feature(None if v is None else str(v), name) for name, v in zip(FEATURES, values)]
    transformed = [(model["imputer"]["statistics"][i] if math.isnan(v) else v) for i, v in enumerate(numbers)]
    z = model["intercept"] + sum(
        ((v - model["scaler"]["mean"][i]) / model["scaler"]["scale"][i]) * model["coefficients"][i]
        for i, v in enumerate(transformed))
    return 1 / (1 + math.exp(-z)) if z >= 0 else math.exp(z) / (1 + math.exp(z))


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def train(output_dir: Path = ARTIFACTS) -> dict:
    cleaned, audit, indices = load_data()
    arrays = {s: matrix(cleaned[s]) for s in SPLITS}
    x_train, y_train = arrays["train"]
    x_val, y_val = arrays["validation"]
    candidates = []
    fitted = {}
    for c in C_VALUES:
        model = build_pipeline(c).fit(x_train, y_train)
        fitted[c] = model
        candidates.append({"C": c, **scores(y_val, model.predict_proba(x_val)[:, 1])})
    best = min(candidates, key=lambda r: (r["brier_score"], r["log_loss"], r["C"]))
    selected = fitted[best["C"]]
    baseline = DummyClassifier(strategy="prior", random_state=SEED).fit(x_train, y_train)
    x_test, y_test = arrays["test"]
    test_probs = selected.predict_proba(x_test)[:, 1]
    baseline_probs = baseline.predict_proba(x_test)[:, 1]
    exported = export_model(selected, x_train, audit["source_sha256"], best["C"])
    cases = []
    # Training-derived inputs only; these fixtures reveal no held-out labels.
    for values in [list(row) for row in x_train[:12]] + [[None, 0], [6.5, None], [None, None]]:
        expected = float(selected.predict_proba(np.array([[np.nan if v is None else v for v in values]]))[:, 1][0])
        actual = predict_exported(exported, values)
        if abs(expected - actual) >= 1e-12:
            raise AssertionError("Exported inference differs from sklearn")
        cases.append({"inputs": values, "expected_probability": expected})
    report = {
        "features": list(FEATURES), "seed": SEED,
        "selection_metric": "minimum validation Brier score; tie-break log loss then smaller C",
        "validation_candidates": candidates, "selected_C": best["C"],
        "train_placement_rate": float(y_train.mean()),
        "validation": {"logistic_regression": scores(y_val, selected.predict_proba(x_val)[:, 1]),
                       "dummy_prior": scores(y_val, baseline.predict_proba(x_val)[:, 1])},
        "test": {"logistic_regression": scores(y_test, test_probs), "dummy_prior": scores(y_test, baseline_probs)},
        "test_rows": len(y_test), "calibration_method": "10 equal-width probability bins; no post-hoc correction",
        "export_max_abs_error": max(abs(predict_exported(exported, case["inputs"]) - case["expected_probability"]) for case in cases),
        "runtime": exported["runtime"],
        "historical_three_feature_reference": json.loads((Path(__file__).parent / "three_feature_reference.json").read_text(encoding="utf-8")),
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    write_json(output_dir / "data_audit.json", audit)
    write_json(output_dir / "split_rows.json", {"indexing": "CSV line numbers including header as line 1", "source_sha256": audit["source_sha256"], "retained_lines": indices})
    write_json(output_dir / "model.json", exported)
    write_json(output_dir / "metrics.json", report)
    write_json(output_dir / "inference_cases.json", {"feature_order": list(FEATURES), "cases": cases})
    write_report(output_dir, report, audit)
    plot_calibration(output_dir, report)
    return report


def write_report(output_dir: Path, report: dict, audit: dict) -> None:
    lines = ["# Đánh giá mô hình placement với hai đầu vào", "",
             "Mô hình Campus Recruitment xuất JSON cho frontend; xem kiểm tra đối chiếu Python/TypeScript trong npm test. Nguồn thu thập của dataset còn hạn chế; chưa xác nhận thật/giả lập và chưa kiểm định trên UIT hoặc doanh nghiệp Việt Nam.", "",
             "## Dữ liệu và chống trùng", "", audit["policy"], "",
             "Giữ nguyên tất cả CSV nguồn. Không coi việc trùng hai đầu vào của model là cùng một người. Không có ID để xác minh danh tính hồ sơ.", "",
             "| Tập | Gốc | Sau lọc |", "|---|---:|---:|"]
    for s in SPLITS:
        lines.append(f"| {s} | {audit['raw_rows'][s]} | {audit['retained_rows'][s]} |")
    lines += ["", f"Có {audit['raw_duplicate_predictor_and_label_excess_rows']} dòng dư trùng toàn bộ predictor và nhãn, {audit['raw_cross_split_predictor_groups']} nhóm predictor giao nhau giữa các tập và {audit['raw_predictor_groups_with_differing_labels']} nhóm predictor có nhãn khác nhau trước lọc. Nhãn khác nhau ở hồ sơ giống nhau không tự động là lỗi; giữ các nhãn khác nhau trong tập ưu tiên được giữ.", "",
              "## Phương pháp", "",
              "X chỉ gồm CGPA và Projects theo đúng thứ tự. Không dùng số lần hoặc số tháng thực tập. Nhãn Placed = 1, NotPlaced = 0. Không dùng điểm vòng 2 hoặc kết quả HR.", "",
              "Median imputer và StandardScaler chỉ fit trên train. So sánh Logistic Regression với DummyClassifier dự đoán tỷ lệ Placed của train. Không dùng trọng số cân bằng lớp hoặc hiệu chỉnh xác suất sau train.", "",
              f"Thử C = {list(C_VALUES)}, chọn C = {report['selected_C']} theo Brier score trên validation (thấp hơn tốt hơn). Giữ model đã fit trên train, không fit lại train + validation. Test chỉ dùng báo cáo cuối sau khi chọn C.", "",
              "## Kết quả test", "", "| Model | ROC AUC ↑ | Average Precision ↑ | Brier ↓ | Log loss ↓ |", "|---|---:|---:|---:|---:|"]
    for name, m in report["test"].items():
        lines.append(f"| {name} | {m['roc_auc']:.6f} | {m['average_precision']:.6f} | {m['brier_score']:.6f} | {m['log_loss']:.6f} |")
    lines += ["", "![Calibration trên test](calibration.png)", "",
              "Biểu đồ gom xác suất thành 10 khoảng cố định; JSON lưu số mẫu và tỷ lệ quan sát ở từng khoảng. Biểu đồ là kiểm tra độ khớp, không phải bước hiệu chỉnh model. Không chọn lại cấu hình sau khi xem test.", "",
              f"Export JSON đã đối chiếu với sklearn trên 15 đầu vào lấy từ train hoặc mẫu thiếu đầu vào; sai số lớn nhất {report['export_max_abs_error']:.3g}. Các mẫu này được dùng để đối chiếu TypeScript qua npm test sau khi export.", "",
              "## So sánh với bản ba đầu vào", "",
              "Tham chiếu trước đây dùng CGPA, Projects, Internships trên cùng tập test (ROC AUC 0.807996; Brier 0.173321). Bản hai đầu vào được chốt theo yêu cầu đơn giản hóa form, không chọn theo điểm test. Đây là so sánh mô tả trên test đã xem, không phải đánh giá độc lập mới.", "",
              "## Giới hạn", "",
              "Chỉ số phản ánh tập đã lọc trùng của nguồn này, không chứng minh xác suất tuyển dụng thật tại UIT. Việc lọc theo hồ sơ giống nhau làm thay đổi quần thể đánh giá. Thiếu ID nên chưa chứng minh tính độc lập theo người hoặc theo thời gian.", "",
              "GPA ngoài phạm vi học cần cảnh báo, không ép về biên. Thiếu đầu vào dùng median train theo model; giá trị 0 vẫn là 0. Quy đổi GPA thang 4 sang 10 cần quy tắc demo rõ ràng, không gọi là chuẩn UIT.", "",
              "Model chỉ hỗ trợ tham khảo; không thay rubric, ngưỡng top 10, quyết định HR hoặc giả định offer 75%.", ""]
    (output_dir / "EVALUATION.md").write_text("\n".join(lines), encoding="utf-8")


def plot_calibration(output_dir: Path, report: dict) -> None:
    import matplotlib
    matplotlib.use("Agg")
    from matplotlib import pyplot as plt
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot([0, 1], [0, 1], "--", color="gray", label="Perfect calibration")
    for name, metrics in report["test"].items():
        bins = metrics["calibration_bins"]
        ax.plot([b["mean_probability"] for b in bins], [b["observed_placement_rate"] for b in bins], "o-", label=name)
    ax.set(xlim=(0, 1), ylim=(0, 1), xlabel="Mean predicted probability", ylabel="Observed placement rate", title="Campus Recruitment: held-out test calibration")
    ax.legend(); ax.grid(alpha=0.2)
    fig.tight_layout()
    fig.savefig(output_dir / "calibration.png", dpi=160)
    plt.close(fig)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ARTIFACTS)
    args = parser.parse_args()
    result = train(args.output_dir)
    print(json.dumps({"selected_C": result["selected_C"], "test": {name: {k: v for k, v in m.items() if k != "calibration_bins"} for name, m in result["test"].items()}, "export_max_abs_error": result["export_max_abs_error"]}, indent=2))
