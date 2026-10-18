"""Seeded fictional company panel. No real company/student records are used.

Writes a typed JSON intermediate; export_dataset.mjs authors the deliverable CSVs.
"""
from __future__ import annotations

import argparse
import calendar
import json
import math
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "data" / "workforce_synthetic"
STAGING = ROOT / "tmp" / "workforce_dataset"
SEED = 20261018
DEPARTMENTS = ("AI", "Frontend", "Backend")
TARGET = "required_interns_next_month"
CATEGORICAL = ["company_id", "department"]
NUMERIC = [
    "month_index", "target_month_sin", "target_month_cos",
    "required_interns_current", "required_interns_lag_1m", "required_interns_lag_2m",
    "required_interns_same_month_last_year", "required_interns_mean_3m",
    "required_interns_mean_6m", "interns_current", "permanent_staff_current",
    "active_projects_current", "overtime_hours_current", "planned_projects_next_month",
    "planned_workload_hours_next_month", "planned_mentor_capacity_next_month",
    "planned_stipend_budget_vnd_next_month", "planned_intern_exits_next_month",
    "confirmed_intern_starts_next_month", "working_days_next_month",
]

# name: (Vietnamese description, unit, data availability / source)
HISTORY_SCHEMA = {
    "company_id": ("Mã doanh nghiệp ẩn danh, ổn định qua các tháng", "mã", "Danh mục doanh nghiệp"),
    "department": ("Phòng/nhóm chuyên môn AI, Frontend hoặc Backend", "nhóm", "Danh mục phòng ban"),
    "month": ("Tháng vừa kết thúc, ký hiệu t", "YYYY-MM", "Lịch"),
    "snapshot_date": ("Ngày chốt số liệu và lưu kế hoạch cho t+1", "YYYY-MM-DD", "Cuối tháng t"),
    "required_interns": ("TỔNG số intern cần có trong tháng t, đã được HR xác nhận độc lập với số tuyển được", "người", "Kế hoạch nhân lực được duyệt của tháng t"),
    "interns_start": ("Intern đang làm tại đầu tháng t", "người", "HRIS đầu tháng t"),
    "intern_starts": ("Intern thực tế bắt đầu trong tháng t", "người", "HRIS đến cuối tháng t"),
    "intern_exits": ("Intern thực tế kết thúc/nghỉ trong tháng t", "người", "HRIS đến cuối tháng t"),
    "interns_end": ("Intern đang làm cuối tháng t = đầu kỳ + vào - ra", "người", "HRIS cuối tháng t"),
    "permanent_staff": ("Nhân viên chính thức cuối tháng t", "người", "HRIS cuối tháng t"),
    "active_projects": ("Dự án đang triển khai trong tháng t", "dự án", "Hệ thống quản lý dự án đến cuối t"),
    "overtime_hours": ("Tổng giờ làm thêm của nhân viên chính thức tháng t", "giờ", "Bảng công cuối t; không phải điểm chuyên cần ứng viên"),
    "actual_intern_workload_hours": ("Khối lượng công việc phù hợp cho intern thực tế tháng t", "giờ", "Báo cáo công việc cuối t; chỉ dùng lịch sử/audit"),
    "planned_projects_next_month": ("Dự án dự kiến hoạt động trong t+1, phiên bản kế hoạch đã biết tại cuối t", "dự án", "PM lưu snapshot tại cuối t"),
    "planned_workload_hours_next_month": ("Giờ công dự kiến giao cho intern trong t+1, đã biết tại cuối t", "giờ", "Kế hoạch dự án lưu tại cuối t"),
    "planned_mentor_capacity_next_month": ("Số intern tối đa mentor dự kiến hướng dẫn được trong t+1", "người", "Quản lý phòng ban tại cuối t"),
    "planned_stipend_budget_vnd_next_month": ("Ngân sách trợ cấp intern cho t+1 đã được phê duyệt tại cuối t", "VND", "Tài chính tại cuối t"),
    "planned_intern_exits_next_month": ("Intern dự kiến kết thúc trong t+1, đã biết cuối t", "người", "Lịch hợp đồng tại cuối t"),
    "confirmed_intern_starts_next_month": ("Intern đã xác nhận sẽ bắt đầu trong t+1, đã biết cuối t", "người", "Lịch nhận việc đã xác nhận tại cuối t"),
    "working_days_next_month": ("Số ngày làm việc dự kiến trong t+1", "ngày", "Lịch doanh nghiệp đã biết tại cuối t; lịch mẫu không phải lịch nghỉ lễ chính thức"),
    "data_source": ("Nguồn bản ghi; bản tạo sẵn luôn là synthetic", "nhãn", "Metadata"),
    "is_synthetic": ("1 = giả lập; dữ liệu thật phải ghi 0 và nguồn thật", "0/1", "Metadata"),
}


def month_add(month: str, offset: int) -> str:
    y, m = map(int, month.split("-"))
    index = y * 12 + m - 1 + offset
    return f"{index // 12:04d}-{index % 12 + 1:02d}"


def workdays(month: str) -> int:
    year, mon = map(int, month.split("-"))
    days = sum(calendar.weekday(year, mon, d) < 5 for d in range(1, calendar.monthrange(year, mon)[1] + 1))
    return max(15, days - (4 if mon == 2 else 0))


def split_for(target_month: str) -> str:
    if target_month <= "2024-12":
        return "train"
    if target_month <= "2025-12":
        return "validation"
    return "test"


def generate_history(seed: int = SEED) -> list[dict]:
    """Causal simulation: next-month plans are saved BEFORE next-month shocks.

    Assumed monthly stipend: 4 million VND. Capacity and noisy planned workload
    drive a fictional approved demand. These are scenario assumptions, not
    fitted economic relationships or empirical estimates.
    """
    rng = np.random.default_rng(seed)
    rows = []
    for company in range(1, 11):
        scale = rng.uniform(7, 18)
        growth = rng.uniform(-0.001, 0.006)
        phase = rng.uniform(0, 2 * math.pi)
        for department, multiplier in zip(DEPARTMENTS, (0.75, 1.0, 1.1)):
            base = scale * multiplier
            productivity = rng.uniform(90, 115)
            interns_end = max(0, int(round(base * 0.75)))
            previous_need = max(1, int(round(base)))
            demand_shock = 0.0
            plan_workload = base * productivity
            mentor_capacity = int(math.ceil(base * 1.35))
            budget_slots = int(math.ceil(base * 1.3))
            projects_plan = max(1, int(round(base / 3)))
            exits_plan, starts_plan = 0, 0
            for i in range(93):  # January 2019 through September 2026, inclusive.
                month = month_add("2019-01", i)
                mon = int(month[-2:])
                days = workdays(month)
                # Workload realized after the previous plan, with unforeseeable shocks.
                actual_workload = max(0, plan_workload * rng.normal(1, 0.09))
                demand_shock = 0.45 * demand_shock + rng.normal(0, 0.7)
                workload_need = actual_workload / (productivity * days / 21)
                desired = max(0, int(round(0.2 * previous_need + 0.8 * workload_need + demand_shock)))
                required = min(desired, mentor_capacity, budget_slots)
                opening = interns_end
                exits = min(opening, exits_plan + int(rng.binomial(max(0, opening - exits_plan), 0.015)))
                # Confirmed starters can withdraw; actual recruitment is not the demand label.
                starts = int(rng.binomial(starts_plan, 0.9))
                interns_end = opening + starts - exits
                staff = max(3, int(round(base * 1.7 * (1 + growth * i))))
                overtime = max(0, int(round(max(0, required - interns_end) * 9 + rng.normal(8, 5))))
                next_month = month_add(month, 1)
                next_mon = int(next_month[-2:])
                next_days = workdays(next_month)
                season = 1 + 0.13 * math.sin(2 * math.pi * (next_mon - 4) / 12)
                cycle = 1 + 0.09 * math.sin((i + 1) / 8 + phase)
                trend_base = base * max(0.6, 1 + growth * (i + 1))
                plan_workload = max(0, (0.30 * actual_workload + 0.70 * trend_base * productivity * season * cycle) * rng.normal(1, 0.05))
                projects_plan = max(1, int(round(plan_workload / 350 + rng.normal(0, 0.4))))
                mentor_capacity = max(1, int(round(trend_base * rng.uniform(1.05, 1.4))))
                budget_slots = max(1, int(round(trend_base * rng.uniform(1.0, 1.35))))
                exits_plan = int(rng.binomial(interns_end, 0.12))
                hiring_gap = max(0, required - (interns_end - exits_plan))
                starts_plan = int(rng.binomial(hiring_gap, 0.65))
                year, month_number = map(int, month.split("-"))
                rows.append({
                    "company_id": f"SYNTH_CO_{company:02d}", "department": department,
                    "month": month, "snapshot_date": f"{month}-{calendar.monthrange(year, month_number)[1]:02d}",
                    "required_interns": required, "interns_start": opening,
                    "intern_starts": starts, "intern_exits": exits, "interns_end": interns_end,
                    "permanent_staff": staff, "active_projects": max(1, int(round(actual_workload / 350))),
                    "overtime_hours": overtime, "actual_intern_workload_hours": round(actual_workload, 1),
                    "planned_projects_next_month": projects_plan,
                    "planned_workload_hours_next_month": round(plan_workload, 1),
                    "planned_mentor_capacity_next_month": mentor_capacity,
                    "planned_stipend_budget_vnd_next_month": budget_slots * 4_000_000,
                    "planned_intern_exits_next_month": exits_plan,
                    "confirmed_intern_starts_next_month": starts_plan,
                    "working_days_next_month": next_days, "data_source": "synthetic", "is_synthetic": 1,
                })
                previous_need = required
    return sorted(rows, key=lambda r: (r["company_id"], r["department"], r["month"]))


def validate_history(rows: list[dict]) -> None:
    groups: dict[tuple, list] = {}
    for row in rows:
        if set(row) != set(HISTORY_SCHEMA):
            raise ValueError("History columns missing or unexpected")
        if any(v is None or v == "" for v in row.values()):
            raise ValueError("Missing history value; do not replace absent data with zero")
        if row["department"] not in DEPARTMENTS:
            raise ValueError("Unknown department")
        if row["interns_start"] + row["intern_starts"] - row["intern_exits"] != row["interns_end"]:
            raise ValueError("Intern headcount does not reconcile")
        if any(isinstance(v, (float, int)) and (not math.isfinite(v) or v < 0) for v in row.values()):
            raise ValueError("Negative/nonfinite history value")
        if row["planned_intern_exits_next_month"] > row["interns_end"]:
            raise ValueError("Planned exits exceed current interns")
        if row["is_synthetic"] not in (0, 1):
            raise ValueError("Invalid synthetic flag")
        groups.setdefault((row["company_id"], row["department"]), []).append(row)
    for series in groups.values():
        series.sort(key=lambda r: r["month"])
        for prev, current in zip(series, series[1:]):
            if month_add(prev["month"], 1) != current["month"]:
                raise ValueError("Duplicate month or gap in monthly series")
            if prev["interns_end"] != current["interns_start"]:
                raise ValueError("Headcount rollforward does not reconcile")


def build_features(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    validate_history(rows)
    groups: dict[tuple, list] = {}
    for row in rows:
        groups.setdefault((row["company_id"], row["department"]), []).append(row)
    supervised, inference = [], []
    for series in groups.values():
        series.sort(key=lambda r: r["month"])
        for i in range(12, len(series)):
            r = series[i]
            target_month = month_add(r["month"], 1)
            mon = int(target_month[-2:])
            origin_year, origin_mon = map(int, r["month"].split("-"))
            sample = {
                "company_id": r["company_id"], "department": r["department"],
                "origin_month": r["month"], "target_month": target_month,
                "snapshot_date": r["snapshot_date"], "horizon_months": 1,
                "month_index": (origin_year - 2019) * 12 + origin_mon - 1,
                "target_month_sin": round(math.sin(2 * math.pi * mon / 12), 8),
                "target_month_cos": round(math.cos(2 * math.pi * mon / 12), 8),
                "required_interns_current": r["required_interns"],
                "required_interns_lag_1m": series[i - 1]["required_interns"],
                "required_interns_lag_2m": series[i - 2]["required_interns"],
                "required_interns_same_month_last_year": series[i - 11]["required_interns"],
                "required_interns_mean_3m": round(float(np.mean([s["required_interns"] for s in series[i - 2:i + 1]])), 4),
                "required_interns_mean_6m": round(float(np.mean([s["required_interns"] for s in series[i - 5:i + 1]])), 4),
                "interns_current": r["interns_end"], "permanent_staff_current": r["permanent_staff"],
                "active_projects_current": r["active_projects"], "overtime_hours_current": r["overtime_hours"],
                **{k: r[k] for k in NUMERIC if k.startswith("planned_") or k in ("confirmed_intern_starts_next_month", "working_days_next_month")},
                "data_source": r["data_source"], "is_synthetic": r["is_synthetic"],
            }
            if i + 1 < len(series):
                sample[TARGET] = series[i + 1]["required_interns"]
                sample["split"] = split_for(target_month)
                supervised.append(sample)
            else:
                inference.append(sample)
    return supervised, inference


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=SEED)
    args = parser.parse_args()
    history = generate_history(args.seed)
    supervised, inference = build_features(history)
    STAGING.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    # The real-data template has headers only: no invented real company records.
    tables = {
        "monthly_history.csv": {"columns": list(HISTORY_SCHEMA), "rows": history},
        "training_next_month.csv": {"columns": list(supervised[0]), "rows": supervised},
        "forecast_inputs_2026_10.csv": {"columns": list(inference[0]), "rows": inference},
        "real_data_template.csv": {"columns": list(HISTORY_SCHEMA), "rows": []},
    }
    (STAGING / "tables.json").write_text(json.dumps(tables, ensure_ascii=False), encoding="utf-8")
    manifest = {
        "dataset_version": "1.0", "seed": args.seed, "source": "100% synthetic; no real company observations",
        "target": TARGET, "horizon_months": 1,
        "categorical_features": CATEGORICAL, "numeric_features": NUMERIC,
        "not_features": ["origin_month", "target_month", "snapshot_date", "horizon_months", "data_source", "is_synthetic", "split", TARGET],
        "history_rows": len(history), "training_rows": len(supervised), "forecast_input_rows": len(inference),
        "companies": 10, "departments": list(DEPARTMENTS), "history_period": ["2019-01", "2026-09"],
        "target_period": [min(r["target_month"] for r in supervised), max(r["target_month"] for r in supervised)],
        "splits": {s: {"rows": len(subset := [r for r in supervised if r["split"] == s]),
                       "from": min(r["target_month"] for r in subset), "to": max(r["target_month"] for r in subset)}
                   for s in ("train", "validation", "test")},
        "assumptions": {"stipend_vnd_per_intern_month": 4_000_000,
                        "effective_hours_per_intern_month_range": [90, 115],
                        "fictional_calendar": True,
                        "demand_definition": "Monthly total approved intern headcount need, constrained by fictional funding and mentorship capacity"},
        "limitations": ["Synthetic metrics measure the simulation only", "Not a real-data validated model",
                        "No transfer guarantee to a real company", "Training output is not connected to the app",
                        "No applicant data, GPA, attendance or peer reviews are needed"],
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    dictionary = ["# Từ điển dữ liệu dự báo nhu cầu intern", "",
                  "Bộ đi kèm là 100% giả lập. `t` là tháng vừa kết thúc; dự báo cho `t+1`. Đơn vị một dòng lịch sử: một doanh nghiệp, một phòng ban, một tháng.", "",
                  "## Các cột trong lịch sử và mẫu nhập dữ liệu thật", "",
                  "| Cột | Ý nghĩa | Đơn vị | Nguồn/thời điểm biết |", "|---|---|---|---|"]
    for name, (description, unit, availability) in HISTORY_SCHEMA.items():
        dictionary.append(f"| `{name}` | {description} | {unit} | {availability} |")
    dictionary += ["", "## Cột được tạo cho machine learning", "",
                   "| Cột | Cách tạo/ý nghĩa |", "|---|---|"]
    derived = {
        "origin_month": "Tháng t, thời điểm chốt đầu vào.",
        "target_month": "Tháng t+1 cần dự báo.",
        "horizon_months": "Luôn bằng 1 trong phiên bản này.",
        "month_index": "Số tháng kể từ 01/2019 đến t, bắt đầu từ 0.",
        "target_month_sin, target_month_cos": "sin/cos(2π × số thứ tự tháng t+1 / 12), biểu diễn mùa vụ.",
        "required_interns_current": "Lấy required_interns ở t.",
        "required_interns_lag_1m, required_interns_lag_2m": "Nhu cầu t−1 và t−2.",
        "required_interns_same_month_last_year": "Nhu cầu cùng tháng năm trước của THÁNG ĐÍCH, tức t−11. Ví dụ dự báo 02/2026 dùng 02/2025.",
        "required_interns_mean_3m": "Trung bình nhu cầu từ t−2 đến t, gồm tháng t.",
        "required_interns_mean_6m": "Trung bình nhu cầu từ t−5 đến t, gồm tháng t.",
        "interns_current": "Lấy interns_end ở t.",
        "permanent_staff_current, active_projects_current, overtime_hours_current": "Lấy số nhân viên chính thức, dự án và giờ làm thêm ở t.",
        "planned_*_next_month, confirmed_intern_starts_next_month, working_days_next_month": "Sao chép đúng snapshot kế hoạch lưu tại cuối t. Không lấy phiên bản sửa sau đó.",
        TARGET: "NHÃN y: required_interns thực tế đã ghi nhận ở t+1. Để trống/không có cột này khi dự báo tháng chưa xảy ra.",
        "split": "train đến nhãn 12/2024; validation trong 2025; test từ 01 đến 09/2026. Chỉ dùng chia tập, không đưa vào X.",
    }
    dictionary += [f"| `{name}` | {description} |" for name, description in derived.items()]
    dictionary += ["", "## Danh sách chính xác đầu vào X", "",
                   "Các cột phân loại: " + ", ".join(f"`{name}`" for name in CATEGORICAL) + ".", "",
                   "Các cột số:", "", *[f"- `{name}`" for name in NUMERIC], "",
                   "Không đưa nhãn y, split, nguồn dữ liệu hoặc kết quả tương lai vào X. `snapshot_date`, `origin_month`, `target_month`, `horizon_months` dùng để kiểm soát thời gian; mùa vụ/thứ tự tháng đã được tạo thành cột số riêng.", "",
                   "## Quy tắc chất lượng", "",
                   "- Một khóa company_id + department + month chỉ có một dòng; tháng liên tục trong từng nhóm.",
                   "- Đầu kỳ + bắt đầu − kết thúc = cuối kỳ. Cuối kỳ trước bằng đầu kỳ sau.",
                   "- Các số đếm là số nguyên không âm; giờ công/ngân sách không âm; không dùng 0 thay dữ liệu thiếu.",
                   "- Hồ sơ thật cần nguồn truy vết, thời điểm chốt, is_synthetic=0; không đổi cờ dữ liệu giả lập thành dữ liệu thật.",
                   "- Kế hoạch t+1 phải được lưu tại cuối t. Khi tháng t+1 kết thúc mới bổ sung nhãn bằng một bản ghi lịch sử mới.",
                   "- Không dùng số hồ sơ, số người nhận offer hay số thực tuyển thay cho tổng nhu cầu nhân lực.", ""]
    (OUTPUT / "DATA_DICTIONARY.md").write_text("\n".join(dictionary), encoding="utf-8")
    print(json.dumps({k: len(v["rows"]) for k, v in tables.items()}))


if __name__ == "__main__":
    main()
