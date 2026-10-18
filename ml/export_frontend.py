"""Export learned parameters, synthetic snapshots and Python parity fixtures."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "frontend/src/data/models"


def write(name, value):
    (DEST / name).write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    placement = json.loads((ROOT / "ml/placement/artifacts/model.json").read_text(encoding="utf-8"))
    assert placement["features"] == ["CGPA", "Projects"], "Retrain the two-input placement model first"
    write("placement.json", placement)
    write("placement_cases.json", json.loads((ROOT / "ml/placement/artifacts/inference_cases.json").read_text(encoding="utf-8")))
    # Import workforce helpers using their existing module-relative imports.
    import sys
    sys.path.insert(0, str(ROOT / "ml/workforce"))
    from train_baseline import predict, validate_samples
    workforce = json.loads((ROOT / "ml/workforce/artifacts/demo_model.json").read_text(encoding="utf-8"))
    workforce["deployment_status"] = "Frontend synthetic scenario only; not validated on real companies"
    write("workforce.json", workforce)
    with (ROOT / "data/workforce_synthetic/forecast_inputs_2026_10.csv").open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    validate_samples(rows, labeled=False)
    expected = predict(rows, workforce)
    write("workforce_cases.json", {"cases": [{"inputs": r, "expected_total": float(p)} for r, p in zip(rows, expected)]})
    with (ROOT / "data/workforce_synthetic/monthly_history.csv").open(encoding="utf-8-sig", newline="") as f:
        history = list(csv.DictReader(f))
    demo = []
    job_ids = {"AI": "job-ai-intern", "Frontend": "job-fe-intern", "Backend": "job-backend-intern"}
    for row in rows:
        if row["company_id"] != "SYNTH_CO_01":
            continue
        monthly = sorted([r for r in history if r["company_id"] == row["company_id"] and r["department"] == row["department"] and r["month"] <= row["origin_month"]], key=lambda r: r["month"])[-13:]
        assert len(monthly) == 13
        demo.append({"jobId": job_ids[row["department"]], "snapshot": row,
                     "history": [{"month": r["month"], "required_interns": int(r["required_interns"])} for r in monthly]})
    write("workforce_demo.json", demo)
    print("Exported two learned models, 15 placement cases, 30 workforce cases and 3 synthetic department snapshots.")


if __name__ == "__main__":
    main()
