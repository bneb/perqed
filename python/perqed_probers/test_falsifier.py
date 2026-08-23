"""
Unit tests for Perqed Probers & Falsification Engine.
"""

import unittest
from python.perqed_probers.falsifier import FalsificationEngine


class TestFalsifier(unittest.TestCase):

    def setUp(self):
        self.engine = FalsificationEngine(timeout_ms=3000)

    def test_valid_arithmetic_conjecture(self):
        """Conjecture: for all n >= 1, m >= 1: n + m > n"""
        conj = {
            "conjecture_id": "test_valid_01",
            "variables": {"n": "Int", "m": "Int"},
            "hypotheses": ["n >= 1", "m >= 1"],
            "target": "n + m > n",
        }
        res = self.engine.run_falsification_suite(conj)
        self.assertTrue(res.passed)
        self.assertTrue(res.hypothesis_consistent)
        self.assertFalse(res.falsified)
        self.assertIsNone(res.counterexample)

    def test_falsifiable_conjecture(self):
        """False conjecture: for all n >= 0, n^2 + n + 41 is always composite (which is false, e.g. n=0 -> 41 is prime). Or n > 5 implies n > 10."""
        conj = {
            "conjecture_id": "test_false_01",
            "variables": {"n": "Int"},
            "hypotheses": ["n >= 5"],
            "target": "n >= 10",
        }
        res = self.engine.run_falsification_suite(conj)
        self.assertFalse(res.passed)
        self.assertTrue(res.falsified)
        self.assertIsNotNone(res.counterexample)
        self.assertIn("n", res.counterexample)
        n_val = int(res.counterexample["n"])
        self.assertTrue(5 <= n_val < 10)

    def test_contradictory_hypotheses_rejection(self):
        """Hypotheses imply False (H ⊢ ⊥): m >= 5 and m <= 3."""
        conj = {
            "conjecture_id": "test_vacuous_01",
            "variables": {"m": "Int"},
            "hypotheses": ["m >= 5", "m <= 3"],
            "target": "m == 100",
        }
        res = self.engine.run_falsification_suite(conj)
        self.assertFalse(res.passed)
        self.assertFalse(res.hypothesis_consistent)
        self.assertTrue(res.falsified)
        self.assertIn("H ⊢ ⊥", res.reason)

    def test_predicate_separation_check(self):
        """Custom predicate: IsPositive(x) = x > 0 on integers."""
        conj = {
            "conjecture_id": "test_pred_01",
            "variables": {"x": "Int"},
            "hypotheses": ["x > 0"],
            "target": "x + 1 > 1",
            "custom_predicates": [
                {
                    "name": "IsPositive",
                    "expr": "x > 0",
                    "variables": {"x": "Int"},
                    "domain_bounds": {"x": [-10, 10]},
                }
            ],
        }
        res = self.engine.run_falsification_suite(conj)
        self.assertTrue(res.passed)
        self.assertIn("IsPositive", res.separation_results)
        self.assertTrue(res.separation_results["IsPositive"]["inhabitation"])
        self.assertTrue(res.separation_results["IsPositive"]["separation"])

    def test_vacuous_predicate_rejection(self):
        """Vacuous predicate: Impossible(x) = x > 5 and x < 2."""
        conj = {
            "conjecture_id": "test_pred_vacuous",
            "variables": {"x": "Int"},
            "hypotheses": ["x >= 0"],
            "target": "x >= 0",
            "custom_predicates": [
                {
                    "name": "Impossible",
                    "expr": "And(x > 5, x < 2)",
                    "variables": {"x": "Int"},
                }
            ],
        }
        res = self.engine.run_falsification_suite(conj)
        self.assertFalse(res.passed)
        self.assertIn("uninhabited", res.reason.lower())

    def test_single_equals_valid_arithmetic(self):
        """Conjecture using single = and ^: (x + 0 = x) and x^2 >= 0"""
        conj = {
            "conjecture_id": "test_single_eq_valid",
            "variables": {"x": "Int"},
            "hypotheses": ["x >= 0"],
            "target": "x + 0 = x && x^2 >= 0",
        }
        res = self.engine.run_falsification_suite(conj)
        self.assertTrue(res.passed)
        self.assertFalse(res.falsified)

    def test_single_equals_false_conjecture_falsified(self):
        """False conjecture with single =: (a + b) + c = a + (b + c) + 1 must be falsified!"""
        conj = {
            "conjecture_id": "test_single_eq_false",
            "variables": {"a": "Int", "b": "Int", "c": "Int"},
            "hypotheses": ["a >= 0", "b >= 0", "c >= 0"],
            "target": "(a + b) + c = a + (b + c) + 1",
        }
        res = self.engine.run_falsification_suite(conj)
        self.assertFalse(res.passed)
        self.assertTrue(res.falsified)
        self.assertIsNotNone(res.counterexample)


    def test_unicode_math_operators(self):
        """Conjecture with Unicode operators: x ≤ y ∧ y ≤ z ⇒ x ≤ z"""
        conj = {
            "conjecture_id": "test_unicode_transitivity",
            "variables": {"x": "Real", "y": "Real", "z": "Real"},
            "hypotheses": ["x ≤ y", "y ≤ z"],
            "target": "x ≤ z",
        }
        res = self.engine.run_falsification_suite(conj)
        self.assertTrue(res.passed)
        self.assertFalse(res.falsified)

    def test_unicode_falsifiable_conjecture(self):
        """False conjecture with Unicode: x ≥ 5 ∧ x ≠ 10 ⇒ x ≥ 20"""
        conj = {
            "conjecture_id": "test_unicode_false",
            "variables": {"x": "Int"},
            "hypotheses": ["x ≥ 5", "x ≠ 10"],
            "target": "x ≥ 20",
        }
        res = self.engine.run_falsification_suite(conj)
        self.assertFalse(res.passed)
        self.assertTrue(res.falsified)
        self.assertIsNotNone(res.counterexample)

    def test_sympy_counterexample_json_serializable(self):
        """Ensure counterexample from probers is strictly JSON serializable"""
        import json
        from dataclasses import asdict
        conj = {
            "conjecture_id": "test_sympy_json",
            "variables": {"n": "Int"},
            "hypotheses": ["n >= 2"],
            "target": "n >= 10",
        }
        res = self.engine.run_falsification_suite(conj)
        self.assertTrue(res.falsified)
        dumped = json.dumps(asdict(res))
        self.assertIn('"conjecture_id": "test_sympy_json"', dumped)


if __name__ == "__main__":
    unittest.main()

