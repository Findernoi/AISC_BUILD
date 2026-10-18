"""Fit Ridge regression using NumPy. One-month rolling-origin evaluation only.

No scikit-learn installation required. JSON model stores only learned numeric
parameters, feature metadata and training-only preprocessing (no pickle).
"""
from __future__ import annotations

import csv
import json
import math
from pathlib import Path

import numpy as np

from generate import CATEGORICAL, NUMERIC, OUTPUT, TARGET, month_add, split_for

ARTIFACTS = Path(__file__).resolve().parent / "artifacts"


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def validate_samples(rows: list[dict], labeled: bool = True) -> None:
    seen = set()
    for row in rows:
        key = (row["company_id"], row["department"], row["origin_month"])
        if key in seen:
            raise ValueError("Duplicate training/inference key")
        seen.add(key)
        if month_add(row["origin_month"], 1) != row["target_month"] or int(row["horizon_months"]) != 1:
            raise ValueError("Forecast horizon must be exactly one month")
        for name in CATEGORICAL + NUMERIC + ([TARGET] if labeled else []):
            value = row.get(name)
            if value is None or value == "":
                raise ValueError(f"Missing feature/target: {name}")
            if name not in CATEGORICAL and not math.isfinite(float(value)):
                raise ValueError(f"Nonfinite feature: {name}")
        if labeled and row["split"] != split_for(row["target_month"]):
            raise ValueError("Incorrect time split")
        if labeled and (float(row[TARGET]) < 0 or not float(row[TARGET]).is_integer()):
            raise ValueError("Target must be nonnegative integer headcount")


def fit_encoder(rows: list[dict]) -> dict:
    numeric = np.array([[float(r[k]) for k in NUMERIC] for r in rows])
    scale = numeric.std(axis=0)
    scale[scale < 1e-10] = 1
    return {
        "numeric_features": NUMERIC, "categorical_features": CATEGORICAL,
        "mean": numeric.mean(axis=0).tolist(), "scale": scale.tolist(),
        "categories": {name: sorted({r[name] for r in rows}) for name in CATEGORICAL},
    }


def encode(rows: list[dict], encoder: dict) -> np.ndarray:
    numeric = np.array([[float(r[k]) for k in encoder["numeric_features"]] for r in rows])
    numeric = (numeric - encoder["mean"]) / encoder["scale"]
    categories = encoder["categories"]
    # Reference category dropped to avoid redundant dummies with intercept.
    dummy = np.array([[int(r[name] == c) for name in encoder["categorical_features"] for c in categories[name][1:]] for r in rows])
    for name, known in categories.items():
        if any(r[name] not in known for r in rows):
            raise ValueError(f"Unseen {name}: this demo has not been evaluated for new companies/departments")
    return np.column_stack([np.ones(len(rows)), numeric, dummy])


def fit(rows: list[dict], alpha: float) -> dict:
    encoder = fit_encoder(rows)
    design = encode(rows, encoder)
    target = np.array([float(r[TARGET]) for r in rows])
    penalty = np.eye(design.shape[1]) * alpha
    penalty[0, 0] = 0
    coefficients = np.linalg.solve(design.T @ design + penalty, design.T @ target)
    return {"model": "Ridge regression", "alpha": alpha, "encoder": encoder,
            "coefficients": coefficients.tolist(), "target": TARGET, "horizon_months": 1,
            "trained_through_target_month": max(r["target_month"] for r in rows),
            "training_rows": len(rows), "synthetic_only": True,
            "deployment_status": "offline demo, not connected to app, not validated on real company data"}


def predict(rows: list[dict], model: dict) -> np.ndarray:
    return np.maximum(0, encode(rows, model["encoder"]) @ model["coefficients"])


def metrics(actual: np.ndarray, predicted: np.ndarray) -> dict:
    return {"MAE_interns": round(float(np.mean(np.abs(actual - predicted))), 4),
            "RMSE_interns": round(float(np.sqrt(np.mean((actual - predicted) ** 2))), 4)}


def comparisons(rows: list[dict], model: dict) -> dict:
    actual = np.array([float(r[TARGET]) for r in rows])
    return {
        "last_month": metrics(actual, np.array([float(r["required_interns_current"]) for r in rows])),
        "same_month_last_year": metrics(actual, np.array([float(r["required_interns_same_month_last_year"]) for r in rows])),
        "ridge": metrics(actual, predict(rows, model)),
    }


def main() -> None:
    rows = read_csv(OUTPUT / "training_next_month.csv")
    latest = read_csv(OUTPUT / "forecast_inputs_2026_10.csv")
    validate_samples(rows)
    validate_samples(latest, labeled=False)
    train, validation, test = ([r for r in rows if r["split"] == name] for name in ("train", "validation", "test"))
    assert max(r["target_month"] for r in train) < min(r["target_month"] for r in validation)
    assert max(r["target_month"] for r in validation) < min(r["target_month"] for r in test)
    # Alpha selection touches validation only. No tuning on the final test.
    candidates = []
    validation_actual = np.array([float(r[TARGET]) for r in validation])
    for alpha in (0.1, 1.0, 10.0, 100.0):
        model = fit(train, alpha)
        candidates.append((metrics(validation_actual, predict(validation, model))["MAE_interns"], alpha, model))
    _, best_alpha, selected = min(candidates, key=lambda result: (result[0], result[1]))
    # Refit with train+validation after choosing alpha, then evaluate test once.
    test_model = fit(train + validation, best_alpha)
    report = {
        "data": "100% synthetic, seeded simulation; metrics are not real-world accuracy",
        "evaluation": "Chronological, rolling one-step forecasts for the same 10 fictional companies. Each test month may use the preceding month's observed history. No held-out-company claim.",
        "validation": comparisons(validation, selected),
        "alpha_candidates_validation_MAE": [{"alpha": a, "MAE_interns": m} for m, a, _ in candidates],
        "selected_alpha": best_alpha, "test": comparisons(test, test_model),
        "test_rows": len(test), "test_target_period": [min(r["target_month"] for r in test), max(r["target_month"] for r in test)],
        "test_by_department": {d: comparisons([r for r in test if r["department"] == d], test_model)
                               for d in sorted({r["department"] for r in test})},
        "metric_definition": "MAE: average absolute difference in interns. RMSE: root mean square difference. Fractional predictions used in metrics; no accuracy percentage.",
    }
    # Only after finishing test evaluation do we refit all historical data for a demo forecast.
    final_model = fit(rows, best_alpha)
    predictions = []
    for row, predicted in zip(latest, predict(latest, final_model)):
        current = int(row["interns_current"])
        exits = int(row["planned_intern_exits_next_month"])
        starts = int(row["confirmed_intern_starts_next_month"])
        need = max(0, int(math.floor(float(predicted) + 0.5)))
        available = max(0, current - exits + starts)
        predictions.append({"company_id": row["company_id"], "department": row["department"],
                            "origin_month": row["origin_month"], "target_month": row["target_month"],
                            "predicted_total_interns": round(float(predicted), 3),
                            "planning_total_interns_rounded": need,
                            "planned_available_interns": available,
                            "additional_interns_to_recruit": max(0, need - available),
                            "is_synthetic": 1, "model_status": "synthetic demo only"})
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    for name, value in (("evaluation.json", report), ("evaluation_model.json", test_model),
                        ("demo_model.json", final_model), ("demo_forecast_2026_10.json", predictions)):
        (ARTIFACTS / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["# Kiểm tra mô hình dự báo intern trên dữ liệu giả lập", "",
             "**Toàn bộ dữ liệu là giả lập. Các chỉ số dưới đây không chứng minh độ chính xác trên doanh nghiệp thật.**", "",
             "Ridge Regression học hệ số từ dữ liệu bằng NumPy. Chọn alpha trên validation năm 2025, sau đó học lại train + validation và kiểm tra một lần trên 01–09/2026.", "",
             "Đây là dự báo từng tháng kế tiếp: khi dự báo tháng 6, đã biết số liệu cuối tháng 5. Không phải dự báo cả 9 tháng ngay từ đầu năm. Không xáo trộn ngẫu nhiên các dòng.", "",
             "| Mô hình | MAE (người) | RMSE (người) |", "|---|---:|---:|"]
    for label, name in (("Dùng nhu cầu tháng vừa qua", "last_month"), ("Dùng cùng tháng năm trước", "same_month_last_year"), ("Ridge Regression", "ridge")):
        score = report["test"][name]
        lines.append(f"| {label} | {score['MAE_interns']:.3f} | {score['RMSE_interns']:.3f} |")
    lines += ["", f"Tập kiểm tra: {len(test)} dòng; alpha được chọn: {best_alpha}. MAE 1 nghĩa là lệch trung bình 1 intern cho một phòng ban của một doanh nghiệp trong một tháng.", "",
              "`evaluation_model.json` chỉ học đến nhãn tháng 12/2025, dùng để tái lập đánh giá. `demo_model.json` học lại toàn bộ 2.400 dòng sau đánh giá, dùng tạo dự báo mẫu tháng 10/2026. Không dùng mô hình học toàn bộ dữ liệu để báo cáo lại điểm test.", "",
              "Các hệ số chỉ học lại quy luật của bộ mô phỏng. Chưa kiểm tra doanh nghiệp mới, thay đổi chính sách hay dữ liệu thật. Chưa tích hợp mô hình này vào web.", "",
              "Số cần tuyển bổ sung = max(0, tổng nhu cầu dự báo đã làm tròn − số intern dự kiến sẵn có). Sẵn có = hiện tại − dự kiến nghỉ + đã xác nhận bắt đầu. Tỷ lệ nhận offer 75% là một giả định riêng của ứng dụng, không phải nhãn hoặc đầu vào để mô hình học.", ""]
    (ARTIFACTS / "EVALUATION.md").write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"selected_alpha": best_alpha, "test": report["test"], "forecast_rows": len(predictions)}))


if __name__ == "__main__":
    main()
