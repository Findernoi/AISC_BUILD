"""Package only explicit dataset/code/report files; never dependencies or app data."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "datasets"
FILES = [
    "data/workforce_synthetic/README.md",
    "data/workforce_synthetic/DATA_DICTIONARY.md",
    "data/workforce_synthetic/manifest.json",
    "data/workforce_synthetic/monthly_history.csv",
    "data/workforce_synthetic/training_next_month.csv",
    "data/workforce_synthetic/forecast_inputs_2026_10.csv",
    "data/workforce_synthetic/real_data_template.csv",
    "ml/workforce/generate.py",
    "ml/workforce/export_dataset.mjs",
    "ml/workforce/train_baseline.py",
    "ml/workforce/test_dataset.py",
    "ml/workforce/requirements.txt",
    "ml/workforce/package_bundle.py",
    "ml/workforce/artifacts/EVALUATION.md",
    "ml/workforce/artifacts/evaluation.json",
    "ml/workforce/artifacts/evaluation_model.json",
    "ml/workforce/artifacts/demo_model.json",
    "ml/workforce/artifacts/demo_forecast_2026_10.json",
]


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    destination = OUTPUT / "workforce_synthetic_demo.zip"
    checksums = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in FILES}
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name in FILES:
            # Stable metadata makes the archive reproducible from unchanged contents.
            info = zipfile.ZipInfo(name, date_time=(2026, 10, 18, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, (ROOT / name).read_bytes())
        archive.writestr("CHECKSUMS_SHA256.json", json.dumps(checksums, indent=2) + "\n")
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        for name, digest in checksums.items():
            assert hashlib.sha256(archive.read(name)).hexdigest() == digest
    print(json.dumps({"archive": str(destination), "files": len(FILES) + 1, "bytes": destination.stat().st_size}))


if __name__ == "__main__":
    main()
