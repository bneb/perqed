"""
Unified Falsification Engine CLI for Perqed v2.1
Integrates Z3 prober, SymPy sweeps, Combined Hypothesis Separation, and Mutation/Load-Bearing Analysis.
"""

import sys
import json
from dataclasses import dataclass, asdict
from typing import Dict, List, Any, Optional

try:
    from .z3_prober import Z3Prober
    from .sympy_prober import SymPyProber
    from .separation_prober import SeparationProber
    from .mutation_analyzer import MutationAnalyzer
except ImportError:
    from z3_prober import Z3Prober
    from sympy_prober import SymPyProber
    from separation_prober import SeparationProber
    from mutation_analyzer import MutationAnalyzer


@dataclass
class FalsificationResult:
    conjecture_id: str
    passed: bool
    hypothesis_consistent: bool
    falsified: bool
    counterexample: Optional[Dict[str, Any]]
    separation_results: Dict[str, Any]
    load_bearing_report: Dict[str, Any]
    reason: str
    solver_details: Dict[str, Any]


class FalsificationEngine:
    """Orchestrates multi-engine falsification and load-bearing verification gates."""

    def __init__(self, timeout_ms: int = 5000):
        self.z3 = Z3Prober(timeout_ms=timeout_ms)
        self.sympy = SymPyProber()
        self.separation = SeparationProber(timeout_ms=timeout_ms)
        self.mutation = MutationAnalyzer(timeout_ms=timeout_ms)

    def run_falsification_suite(self, conjecture: Dict[str, Any]) -> FalsificationResult:
        conjecture_id = conjecture.get("conjecture_id", "conj_unknown")
        variables = conjecture.get("variables", {"n": "Nat", "m": "Nat"})
        hypotheses = conjecture.get("hypotheses", [])
        target = conjecture.get("target", "True")
        custom_predicates = conjecture.get("custom_predicates", [])
        domain_bounds = conjecture.get("domain_bounds", None)

        # Gate 1: Hypothesis Consistency Check (H ⊢ ⊥)
        h_consistent, h_msg = self.z3.check_hypotheses_consistency(variables, hypotheses)
        if not h_consistent:
            return FalsificationResult(
                conjecture_id=conjecture_id,
                passed=False,
                hypothesis_consistent=False,
                falsified=True,
                counterexample=None,
                separation_results={},
                load_bearing_report={},
                reason=h_msg or "Hypotheses imply False (vacuous conjecture).",
                solver_details={"stage": "hypothesis_consistency_check", "status": "unsat"},
            )

        # Gate 2: Combined Hypothesis Set Separation & Non-Vacuity
        c_passed, c_details, c_msg = self.separation.verify_combined_hypotheses_separation(
            variables, hypotheses, domain_bounds
        )
        separation_results = {"combined_hypotheses": c_details}
        if not c_passed:
            return FalsificationResult(
                conjecture_id=conjecture_id,
                passed=False,
                hypothesis_consistent=True,
                falsified=True,
                counterexample=None,
                separation_results=separation_results,
                load_bearing_report={},
                reason=c_msg,
                solver_details={"stage": "combined_hypothesis_separation_check"},
            )

        # Gate 3: Non-Vacuity Separation Check on custom predicates
        for pred in custom_predicates:
            p_name = pred.get("name", "P")
            p_expr = pred.get("expr", "True")
            p_vars = pred.get("variables", variables)
            p_bounds = pred.get("domain_bounds", domain_bounds)

            p_passed, p_details, p_msg = self.separation.verify_predicate_separation(
                p_name, p_expr, p_vars, p_bounds
            )
            separation_results[p_name] = p_details
            if not p_passed:
                return FalsificationResult(
                    conjecture_id=conjecture_id,
                    passed=False,
                    hypothesis_consistent=True,
                    falsified=True,
                    counterexample=None,
                    separation_results=separation_results,
                    load_bearing_report={},
                    reason=p_msg,
                    solver_details={"stage": "separation_check", "predicate": p_name},
                )

        # Gate 4: SMT Bounded Counterexample Search via Z3
        z3_falsified, z3_cex, z3_msg = self.z3.search_counterexample(
            variables, hypotheses, target, domain_bounds
        )
        if z3_falsified:
            return FalsificationResult(
                conjecture_id=conjecture_id,
                passed=False,
                hypothesis_consistent=True,
                falsified=True,
                counterexample=z3_cex,
                separation_results=separation_results,
                load_bearing_report={},
                reason=f"FALSIFIED: {z3_msg}",
                solver_details={"stage": "z3_counterexample_search", "solver": "Z3"},
            )

        # Gate 5: SymPy Finite Grid Sweep
        sp_falsified, sp_cex, sp_msg = self.sympy.finite_sweep_falsification(
            variables, hypotheses, target
        )
        if sp_falsified:
            return FalsificationResult(
                conjecture_id=conjecture_id,
                passed=False,
                hypothesis_consistent=True,
                falsified=True,
                counterexample=sp_cex,
                separation_results=separation_results,
                load_bearing_report={},
                reason=f"FALSIFIED: {sp_msg}",
                solver_details={"stage": "sympy_finite_sweep", "solver": "SymPy"},
            )

        # Gate 6: Mutation-Consistency & Load-Bearing Hypothesis Analysis
        load_bearing_report = self.mutation.analyze_load_bearing_hypotheses(
            variables, hypotheses, target
        )

        # All gates passed
        return FalsificationResult(
            conjecture_id=conjecture_id,
            passed=True,
            hypothesis_consistent=True,
            falsified=False,
            counterexample=None,
            separation_results=separation_results,
            load_bearing_report=load_bearing_report,
            reason="PASSED: All falsification and non-vacuity gates cleared.",
            solver_details={"z3_msg": z3_msg, "sympy_msg": sp_msg},
        )


def main():
    if len(sys.argv) > 1 and sys.argv[1] not in ("-", "--stdin"):
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            raw_input = f.read()
    else:
        raw_input = sys.stdin.read()

    try:
        data = json.loads(raw_input)
    except Exception as e:
        print(json.dumps({"passed": False, "error": f"Invalid JSON input: {e}"}))
        sys.exit(1)

    engine = FalsificationEngine()
    res = engine.run_falsification_suite(data)
    print(json.dumps(asdict(res), indent=2))
    sys.exit(0 if res.passed else 1)


if __name__ == "__main__":
    main()
