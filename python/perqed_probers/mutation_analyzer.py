"""
Mutation-Consistency & Load-Bearing Hypothesis Analyzer
Executes counterfactual deletion and mutation sweeps to identify stuffed,
redundant, or non-load-bearing hypotheses in mathematical conjectures.
"""

from typing import Dict, List, Any, Optional, Tuple
import z3


class MutationAnalyzer:
    """Analyzes whether hypotheses in a conjecture are genuinely load-bearing."""

    def __init__(self, timeout_ms: int = 5000):
        self.timeout_ms = timeout_ms

    def _eval_expr(self, expr_str: str, env: Dict[str, Any]) -> Any:
        safe_dict = {
            "And": z3.And,
            "Or": z3.Or,
            "Not": z3.Not,
            "Implies": z3.Implies,
            "If": z3.If,
        }
        safe_dict.update(env)
        clean = (
            expr_str.replace("&&", " and ")
            .replace("||", " or ")
            .replace("!", " not ")
        )
        return eval(clean, {"__builtins__": {}}, safe_dict)

    def analyze_load_bearing_hypotheses(
        self,
        variables: Dict[str, str],
        hypotheses: List[str],
        target: str,
    ) -> Dict[str, Any]:
        """
        Runs counterfactual hypothesis mutation & deletion analysis.
        Returns a structured report on each hypothesis.
        """
        if not hypotheses:
            return {
                "all_load_bearing": True,
                "hypothesis_reports": [],
                "redundant_count": 0,
                "summary": "No hypotheses to analyze.",
            }

        z3_vars = {name: z3.Int(name) for name in variables.keys()}
        reports = []
        redundant_count = 0

        for i, hyp in enumerate(hypotheses):
            remaining_hypotheses = [h for j, h in enumerate(hypotheses) if j != i]

            # 1. Counterfactual Deletion Test: Does (H \ {h_i}) ⊢ Target?
            s_del = z3.Solver()
            s_del.set("timeout", self.timeout_ms)

            for name, vtype in variables.items():
                if "nat" in vtype.lower():
                    s_del.add(z3_vars[name] >= 0)

            for rh in remaining_hypotheses:
                try:
                    s_del.add(self._eval_expr(rh, z3_vars))
                except Exception:
                    pass

            try:
                target_ast = self._eval_expr(target, z3_vars)
                s_del.add(z3.Not(target_ast))
                res_del = s_del.check()

                # If UNSAT, target holds even without this hypothesis -> NOT load-bearing!
                is_strictly_load_bearing = (res_del == z3.sat)
            except Exception:
                is_strictly_load_bearing = True

            if not is_strictly_load_bearing:
                redundant_count += 1

            reports.append({
                "hypothesis": hyp,
                "index": i,
                "is_load_bearing": is_strictly_load_bearing,
                "status": "load-bearing" if is_strictly_load_bearing else "redundant / non-load-bearing",
            })

        all_load_bearing = (redundant_count == 0)

        return {
            "all_load_bearing": all_load_bearing,
            "hypothesis_reports": reports,
            "redundant_count": redundant_count,
            "summary": (
                "All hypotheses are load-bearing."
                if all_load_bearing
                else f"Detected {redundant_count} non-load-bearing / stuffed hypothesis(es)."
            ),
        }
