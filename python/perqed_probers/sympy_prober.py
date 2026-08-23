"""
SymPy CAS Prober for Perqed Falsification Gate
Executes symbolic algebraic evaluation and finite parameter grid sweeps.
"""

from typing import Dict, List, Any, Optional, Tuple
import itertools
import sympy as sp


try:
    from .expr_utils import normalize_math_expr
except ImportError:
    from expr_utils import normalize_math_expr


class SymPyProber:
    """SymPy CAS solver for symbolic simplification and finite parameter sweeps."""

    def __init__(self, sweep_depth: int = 15):
        self.sweep_depth = sweep_depth

    def _parse_expr(self, expr_str: str, sym_vars: Dict[str, sp.Symbol]) -> Any:
        """Parse mathematical string expression into SymPy expression."""
        clean_expr = normalize_math_expr(expr_str)
        return sp.sympify(clean_expr, locals=sym_vars)

    def finite_sweep_falsification(
        self,
        variables: Dict[str, str],
        hypotheses: List[str],
        target_assertion: str,
        test_ranges: Optional[Dict[str, List[int]]] = None,
    ) -> Tuple[bool, Optional[Dict[str, int]], Optional[str]]:
        """
        Runs finite grid sweep over specified variables.
        Returns (falsified, counterexample_assignment, details).
        """
        # Build symbol dictionary
        sym_vars = {name: sp.Symbol(name, integer=True) for name in variables.keys()}

        # Build grid
        grid_axes = {}
        for name, vtype in variables.items():
            if test_ranges and name in test_ranges:
                grid_axes[name] = test_ranges[name]
            elif "nat" in vtype.lower():
                grid_axes[name] = list(range(0, self.sweep_depth))
            else:
                grid_axes[name] = list(range(-self.sweep_depth // 2, self.sweep_depth // 2 + 1))

        var_names = list(grid_axes.keys())
        value_lists = [grid_axes[k] for k in var_names]

        # Prepare safe evaluation context
        safe_builtins = {
            "abs": abs,
            "min": min,
            "max": max,
            "pow": pow,
        }

        for values in itertools.product(*value_lists):
            env = dict(zip(var_names, values))
            env.update(safe_builtins)

            # Check if all hypotheses hold for this instance
            hyp_satisfied = True
            for hyp in hypotheses:
                try:
                    clean_hyp = normalize_math_expr(hyp)
                    if not bool(eval(clean_hyp, {"__builtins__": {}}, env)):
                        hyp_satisfied = False
                        break
                except Exception:
                    # Skip unparseable non-evaluable python hypothesis
                    continue

            if not hyp_satisfied:
                continue

            # Hypotheses hold, check target
            try:
                clean_target = normalize_math_expr(target_assertion)
                target_val = bool(eval(clean_target, {"__builtins__": {}}, env))
                if not target_val:
                    return (
                        True,
                        env,
                        f"SymPy counterexample found at assignment: {env}",
                    )
            except Exception:
                continue

        return False, None, "No counterexample discovered in finite grid sweep."
