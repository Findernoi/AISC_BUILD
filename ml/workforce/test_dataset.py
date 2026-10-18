"""Integrity checks for temporal alignment and synthetic headcount accounting."""
import copy
import csv
import json
import unittest

import numpy as np

from generate import CATEGORICAL, NUMERIC, OUTPUT, STAGING, TARGET, build_features, generate_history, month_add, validate_history
from train_baseline import encode, fit_encoder, metrics, validate_samples


class DatasetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.history = generate_history()
        cls.samples, cls.latest = build_features(cls.history)

    def test_reproducible_and_expected_shape(self):
        self.assertEqual(self.history, generate_history())
        self.assertEqual((len(self.history), len(self.samples), len(self.latest)), (2790, 2400, 30))
        self.assertTrue(all(r["is_synthetic"] == 1 and r["data_source"] == "synthetic" for r in self.history))
        self.assertNotEqual(self.history, generate_history(123))

    def test_target_and_rolling_features_are_correctly_aligned(self):
        lookup = {(r["company_id"], r["department"], r["month"]): r for r in self.history}
        for r in self.samples:
            key = (r["company_id"], r["department"])
            current = lookup[(*key, r["origin_month"])]
            future = lookup[(*key, r["target_month"])]
            self.assertEqual(r[TARGET], future["required_interns"])
            self.assertEqual(r["required_interns_current"], current["required_interns"])
            self.assertEqual(r["required_interns_same_month_last_year"], lookup[(*key, month_add(r["target_month"], -12))]["required_interns"])
            self.assertEqual(r["planned_workload_hours_next_month"], current["planned_workload_hours_next_month"])
            self.assertLess(r["snapshot_date"], r["target_month"] + "-01")

    def test_future_actuals_do_not_change_past_features(self):
        altered = copy.deepcopy(self.history)
        for r in altered:
            if r["month"] == "2026-09":
                r["required_interns"] += 10
                r["actual_intern_workload_hours"] += 5000
        samples, _ = build_features(altered)
        old = next(r for r in self.samples if r["origin_month"] == "2026-08")
        new = next(r for r in samples if r["origin_month"] == "2026-08")
        self.assertEqual({k: old[k] for k in CATEGORICAL + NUMERIC}, {k: new[k] for k in CATEGORICAL + NUMERIC})
        self.assertEqual(new[TARGET], old[TARGET] + 10)

    def test_temporal_split_and_inference_has_no_label(self):
        validate_samples(self.samples)
        validate_samples(self.latest, labeled=False)
        ranges = {s: sorted({r["target_month"] for r in self.samples if r["split"] == s}) for s in ("train", "validation", "test")}
        self.assertLess(ranges["train"][-1], ranges["validation"][0])
        self.assertLess(ranges["validation"][-1], ranges["test"][0])
        self.assertTrue(all(TARGET not in r and "split" not in r and r["target_month"] == "2026-10" for r in self.latest))
        self.assertNotIn(TARGET, NUMERIC + CATEGORICAL)
        self.assertNotIn("split", NUMERIC + CATEGORICAL)

    def test_stock_balances_and_invalid_history_rejected(self):
        validate_history(self.history)
        bad = copy.deepcopy(self.history)
        bad[0]["interns_end"] += 1
        with self.assertRaisesRegex(ValueError, "reconcile"):
            validate_history(bad)
        with self.assertRaisesRegex(ValueError, "Duplicate month"):
            validate_history(self.history + [self.history[0]])

    def test_missing_is_not_silently_zero(self):
        bad = copy.deepcopy(self.samples[:1])
        bad[0]["interns_current"] = ""
        with self.assertRaisesRegex(ValueError, "Missing"):
            validate_samples(bad)

    def test_preprocessing_fits_training_only_and_rejects_unseen_company(self):
        train = [r for r in self.samples if r["split"] == "train"]
        encoder = fit_encoder(train)
        self.assertAlmostEqual(encoder["mean"][0], np.mean([r["month_index"] for r in train]))
        self.assertNotAlmostEqual(encoder["mean"][0], np.mean([r["month_index"] for r in self.samples]))
        altered = copy.deepcopy(self.latest[:1])
        altered[0]["company_id"] = "UNSEEN_COMPANY"
        with self.assertRaisesRegex(ValueError, "Unseen"):
            encode(altered, encoder)

    def test_mae_with_zero_demand_is_defined(self):
        self.assertEqual(metrics(np.array([0, 2]), np.array([1, 3])), {"MAE_interns": 1.0, "RMSE_interns": 1.0})

    def test_exported_csv_preserves_every_value(self):
        tables = json.loads((STAGING / "tables.json").read_text(encoding="utf-8"))
        for filename, table in tables.items():
            with (OUTPUT / filename).open(encoding="utf-8-sig", newline="") as file:
                reader = csv.DictReader(file)
                self.assertEqual(reader.fieldnames, table["columns"])
                saved = list(reader)
            self.assertEqual(len(saved), len(table["rows"]))
            for actual, expected in zip(saved, table["rows"]):
                for key, value in expected.items():
                    if isinstance(value, (int, float)):
                        self.assertEqual(float(actual[key]), value)
                    else:
                        self.assertEqual(actual[key], value)


if __name__ == "__main__":
    unittest.main(verbosity=2)
