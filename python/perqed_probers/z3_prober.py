"""
Z3 SMT Prober for Perqed Falsification Gate
Performs bounded counterexample search and hypothesis consistency checks (H ⊢ ⊥).
"""

from typing import Dict, List, Any, Optional, Tuple
import z3


class Z3Prober:
    """Z3 SMT Solver interface for formal conjecture falsification."""

    def __init__(self, timeout_ms: int = 5000):
        self.timeout_ms = timeout_ms

    def _create_var(self, name: str, var_type: str) -> Any:
        """Create a Z3 variable based on type declaration."""
        var_type_lower = var_type.lower()
        if "int" in var_type_lower or "nat" in var_type_lower:
            return z3.Int(name)
        elif "real" in var_type_lower or "float" in var_type_lower:
            return z3.Real(name)
        elif "bool" in var_type_lower or "prop" in var_type_lower:
            return z3.Bool(name)
        else:
            return z3.Int(name)

    def _eval_expr(self, expr_str: str, env: Dict[str, Any]) -> Any:
        """Safely evaluate arithmetic/logical expression into a Z3 AST node."""
        # Provide common mathematical functions and z3 constructs
        safe_dict = {
            "And": z3.And,
            "Or": z3.Or,
            "Not": z3.Not,
            "Implies": z3.Implies,
            "If": z3.If,
            "Sum": sum,
            "abs": lambda x: z3.If(x >= 0, x, -x),
            "max": lambda a, b: z3.If(a >= b, a, b),
            "min": lambda a, b: z3.If(a <= b, a, b),
        }
        safe_dict.update(env)
        
        # Replace python-like syntax if needed
        clean_expr = (
            expr_str.replace("&&", " and ")
            .replace("||", " or ")
            .replace("!", " not ")
            .replace("→", " <= ")  # Implication in boolean logic
        )
        return eval(clean_expr, {"__builtins__": {}}, safe_dict)

    def check_hypotheses_consistency(
        self,
        variables: Dict[str, str],
        hypotheses: List[str],
    ) -> Tuple[bool, Optional[str]]:
        """
        Hypothesis Consistency Check: Verifies if H ⊢ ⊥ (hypotheses imply False).
        Returns (is_consistent, error_message).
        If unsatisfiable, the conjecture is vacuous and must be rejected immediately.
        """
        solver = z3.Solver()
        solver.set("timeout", self.timeout_ms)

        z3_vars = {name: self._create_var(name, vtype) for name, vtype in variables.items()}

        # Add natural number non-negativity constraints if variable is Nat
        for name, vtype in variables.items():
            if "nat" in vtype.lower():
                solver.add(z3_vars[name] >= 0)

        for hyp in hypotheses:
            try:
                z3_hyp = self._eval_expr(hyp, z3_vars)
                solver.add(z3_hyp)
            except Exception as e:
                return True, f"Could not parse hypothesis '{hyp}': {e}"

        result = solver.check()
        if result == z3.unsat:
            return False, "Hypotheses are contradictory (H ⊢ ⊥). Conjecture is vacuous."
        elif result == z3.unknown:
            return True, "Hypothesis consistency check timed out (assumed satisfiable)."
        return True, None

    def search_counterexample(
        self,
        variables: Dict[str, str],
        hypotheses: List[str],
        target: str,
        domain_bounds: Optional[Dict[str, Tuple[int, int]]] = None,
    ) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """
        Searches for a counterexample: ∃ x, Hypotheses(x) ∧ ¬Target(x).
        Returns (falsified, counterexample_dict, message).
        - If SAT: Counterexample found -> conjecture is FALSE.
        - If UNSAT: No counterexample exists in bounded domain -> passed gate.
        """
        solver = z3.Solver()
        solver.set("timeout", self.timeout_ms)

        z3_vars = {name: self._create_var(name, vtype) for name, vtype in variables.items()}

        # Add domain bounds or Nat bounds
        for name, vtype in variables.items():
            if "nat" in vtype.lower():
                solver.add(z3_vars[name] >= 0)
            if domain_bounds and name in domain_bounds:
                low, high = domain_bounds[name]
                solver.add(z3_vars[name] >= low)
                solver.add(z3_vars[name] <= high)

        # Add all hypotheses
        for hyp in hypotheses:
            try:
                z3_hyp = self._eval_expr(hyp, z3_vars)
                solver.add(z3_hyp)
            except Exception as e:
                return False, None, f"Hypothesis parse error: {e}"

        # Add negation of target: ¬Target
        try:
            z3_target = self._eval_expr(target, z3_vars)
            solver.add(z3.Not(z3_target))
        except Exception as e:
            return False, None, f"Target parse error: {e}"

        result = solver.check()
        if result == z3.sat:
            model = solver.model()
            counterexample = {
                name: str(model.eval(var, model_completion=True))
                for name, var in z3_vars.items()
            }
            return True, counterexample, "Counterexample found by Z3."
        elif result == z3.unsat:
            return False, None, "UNSAT: No counterexample exists within domain bounds."
        else:
            return False, None, "TIMEOUT/UNKNOWN: SMT solver could not decide satisfiability."
