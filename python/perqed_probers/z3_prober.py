"""
Z3 SMT Prober for Perqed Falsification Gate
Executes bounded SMT queries and hypothesis consistency checks over quantifier-free logic.
"""

from typing import Dict, List, Any, Optional, Tuple
import z3


try:
    from .expr_utils import normalize_math_expr
except ImportError:
    from expr_utils import normalize_math_expr


class Z3Prober:
    """SMT-based counterexample prober using Z3."""

    def __init__(self, timeout_ms: int = 5000):
        self.timeout_ms = timeout_ms

    def _eval_expr(self, expr_str: str, env: Dict[str, Any]) -> Any:
        safe_dict = {
            "And": z3.And,
            "Or": z3.Or,
            "Not": z3.Not,
            "Implies": z3.Implies,
            "If": z3.If,
            "abs": lambda x: z3.If(x >= 0, x, -x),
        }
        safe_dict.update(env)
        clean = normalize_math_expr(expr_str)
        return eval(clean, {"__builtins__": {}}, safe_dict)

    def check_hypotheses_consistency(
        self,
        variables: Dict[str, str],
        hypotheses: List[str],
    ) -> Tuple[bool, Optional[str]]:
        """
        Verifies that hypotheses do not imply False (H |- \bot).
        Returns (is_consistent, error_message).
        """
        if not hypotheses:
            return True, None

        s = z3.Solver()
        s.set("timeout", self.timeout_ms)

        z3_vars = {}
        for name, vtype in variables.items():
            if "nat" in vtype.lower():
                var = z3.Int(name)
                s.add(var >= 0)
                z3_vars[name] = var
            elif "int" in vtype.lower():
                z3_vars[name] = z3.Int(name)
            elif "real" in vtype.lower():
                z3_vars[name] = z3.Real(name)
            elif "bool" in vtype.lower():
                z3_vars[name] = z3.Bool(name)
            else:
                z3_vars[name] = z3.Int(name)

        for h in hypotheses:
            try:
                ast = self._eval_expr(h, z3_vars)
                s.add(ast)
            except Exception as e:
                return False, f"Failed to parse hypothesis '{h}': {e}"

        res = s.check()
        if res == z3.unsat:
            return False, "Hypotheses are contradictory (H ⊢ ⊥). Rejected as vacuous."
        return True, None

    def search_counterexample(
        self,
        variables: Dict[str, str],
        hypotheses: List[str],
        target: str,
        bounds: Optional[Dict[str, Tuple[int, int]]] = None,
    ) -> Tuple[bool, Optional[Dict[str, Any]], str]:
        """
        Searches for a counterexample where hypotheses hold but target is FALSE.
        Returns (falsified, counterexample_dict, status_message).
        Handles z3.unknown gracefully (undecidability boundaries).
        """
        s = z3.Solver()
        s.set("timeout", self.timeout_ms)

        z3_vars = {}
        for name, vtype in variables.items():
            if "nat" in vtype.lower():
                var = z3.Int(name)
                s.add(var >= 0)
                z3_vars[name] = var
            elif "int" in vtype.lower():
                z3_vars[name] = z3.Int(name)
            elif "real" in vtype.lower():
                z3_vars[name] = z3.Real(name)
            elif "bool" in vtype.lower():
                z3_vars[name] = z3.Bool(name)
            else:
                z3_vars[name] = z3.Int(name)

        if bounds:
            for name, (low, high) in bounds.items():
                if name in z3_vars:
                    s.add(z3_vars[name] >= low)
                    s.add(z3_vars[name] <= high)

        for h in hypotheses:
            try:
                s.add(self._eval_expr(h, z3_vars))
            except Exception as e:
                return False, None, f"Error parsing hypothesis '{h}': {e}"

        try:
            target_ast = self._eval_expr(target, z3_vars)
            s.add(z3.Not(target_ast))
        except Exception as e:
            return False, None, f"Error parsing target '{target}': {e}"

        check_res = s.check()
        if check_res == z3.sat:
            # Concrete Counterexample Found!
            m = s.model()
            cex = {
                name: str(m.eval(var, model_completion=True))
                for name, var in z3_vars.items()
            }
            return True, cex, "Counterexample found by Z3."
        elif check_res == z3.unsat:
            # Verified within bounded scope
            return False, None, "No counterexample found in bounded domain (UNSAT)."
        else:
            # check_res == z3.unknown (e.g. non-linear arithmetic undecidability boundary)
            return (
                False,
                None,
                "SMT returned UNKNOWN (undecidable boundary); deferring to compiled numerical sweeps.",
            )
