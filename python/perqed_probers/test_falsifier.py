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


if __name__ == "__main__":
    unittest.main()
