"""Guard against split leakage, train-only preprocessing and JSON export drift."""
import hashlib
import unittest

import numpy as np

from train import (DATA, FEATURES, SPLITS, build_pipeline, calibration_bins,
                   export_model, fingerprint, load_data, parse_feature,
                   predict_exported, prepare_splits)


def row(gpa="7.5", projects="2", internships="1", extra="80", label="Placed"):
    return {"CGPA": gpa, "Projects": projects, "Internships": internships,
            "AptitudeTestScore": extra, "PlacementStatus": label}


class SplitTests(unittest.TestCase):
    def test_overlap_uses_predictors_not_target_and_protects_test(self):
        source = {"train": [row(label="NotPlaced"), row(extra="70")],
                  "validation": [row(), row(extra="71")], "test": [row(), row()]}
        cleaned, audit, indices = prepare_splits(source)
        self.assertEqual(cleaned["test"], [row()])
        self.assertEqual(cleaned["validation"], [row(extra="71")])
        self.assertEqual(cleaned["train"], [row(extra="70")])
        self.assertEqual(indices["test"], [2])
        self.assertEqual(audit["raw_predictor_groups_with_differing_labels"], 1)
        self.assertEqual(audit["removed_rows"]["train"]["cross_split"], 1)

    def test_matching_model_inputs_do_not_imply_duplicate_people(self):
        source = {"train": [row(extra="70")], "validation": [row(extra="71")], "test": [row(extra="72")]}
        cleaned, _, _ = prepare_splits(source)
        self.assertTrue(all(len(cleaned[s]) == 1 for s in SPLITS))

    def test_differing_labels_within_winning_split_are_preserved(self):
        source = {"train": [], "validation": [], "test": [row(), row(label="NotPlaced")]}
        cleaned, _, _ = prepare_splits(source)
        self.assertEqual(len(cleaned["test"]), 2)

    def test_source_checksums_and_no_retained_overlap(self):
        first, audit, indices = load_data()
        second, second_audit, second_indices = load_data()
        self.assertEqual(first, second)
        self.assertEqual(audit, second_audit)
        self.assertEqual(indices, second_indices)
        sets = {s: {fingerprint(r) for r in first[s]} for s in SPLITS}
        for i, a in enumerate(SPLITS):
            for b in SPLITS[i + 1:]:
                self.assertFalse(sets[a] & sets[b])
        for filename, expected in audit["source_sha256"].items():
            self.assertEqual(hashlib.sha256((DATA / filename).read_bytes()).hexdigest(), expected)


class ModelTests(unittest.TestCase):
    def setUp(self):
        self.x = np.array([[6.5, 0], [7, 1], [8, 2], [9, 3], [np.nan, 0], [7.5, 2]])
        self.y = np.array([0, 0, 1, 1, 0, 1])
        self.pipeline = build_pipeline(1).fit(self.x, self.y)

    def test_missing_imputation_is_train_only_and_zero_is_observed(self):
        np.testing.assert_allclose(self.pipeline["imputer"].statistics_, np.nanmedian(self.x, axis=0))
        before = self.pipeline["imputer"].statistics_.copy()
        self.pipeline.predict_proba(np.array([[10, 100], [np.nan, 0]]))
        np.testing.assert_array_equal(before, self.pipeline["imputer"].statistics_)
        self.assertEqual(self.pipeline["imputer"].transform([[7, 0]])[0, 1], 0)

    def test_json_inference_matches_sklearn_with_missing_and_extreme_inputs(self):
        model = export_model(self.pipeline, self.x, {}, 1)
        self.assertEqual(model["features"], list(FEATURES))
        for values in [[6.5, 0], [9.1, 3], [None, 2], [7.5, None], [0, 0], [10, 10000]]:
            expected = self.pipeline.predict_proba([[np.nan if v is None else v for v in values]])[0, 1]
            self.assertAlmostEqual(expected, predict_exported(model, values), places=12)

    def test_invalid_values_are_rejected_not_clamped_or_replaced_with_zero(self):
        for name, value in [("CGPA", "10.1"), ("CGPA", "nan"), ("Projects", "-1"), ("Projects", "1.5"), ("Internships", "inf")]:
            with self.subTest(name=name, value=value):
                with self.assertRaises(ValueError):
                    parse_feature(value, name)
        self.assertEqual(parse_feature("0", "Internships"), 0)
        self.assertTrue(np.isnan(parse_feature("", "Internships")))

    def test_calibration_includes_probability_one_and_zero(self):
        bins = calibration_bins(np.array([0, 1, 1]), np.array([0, 0.5, 1]))
        self.assertEqual(sum(b["count"] for b in bins), 3)
        self.assertEqual(bins[-1]["observed_placement_rate"], 1)


if __name__ == "__main__":
    unittest.main()
