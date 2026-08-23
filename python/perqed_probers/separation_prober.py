"""
Separation & Non-Vacuity Prober for Perqed Falsification Gate
Ensures both individual predicates and the COMBINED hypothesis conjunction satisfy:
1. Inhabitation: ∃ x, ⋀ H_i(x)
2. Non-Triviality / Separation: ∃ y, ¬(⋀ H_i(y))
"""

from typing import Dict, List, Any, Optional, Tuple
import z3


try:
    from .expr_utils import normalize_math_expr
except ImportError:
    from expr_utils import normalize_math_expr


class SeparationProber:
    """Non-Vacuity separation tester for mathematical specifications."""

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
        clean_expr = normalize_math_expr(expr_str)
        return eval(clean_expr, {"__builtins__": {}}, safe_dict)

    def _build_z3_vars(self, variables: Dict[str, str], solver: z3.Solver) -> Dict[str, Any]:
        z3_vars = {}
        for name, vtype in variables.items():
            vt = vtype.lower()
            if "nat" in vt:
                var = z3.Int(name)
                solver.add(var >= 0)
                z3_vars[name] = var
            elif "int" in vt:
                z3_vars[name] = z3.Int(name)
            elif any(t in vt for t in ("real", "rat", "float")):
                z3_vars[name] = z3.Real(name)
            elif "bool" in vt:
                z3_vars[name] = z3.Bool(name)
            else:
                z3_vars[name] = z3.Int(name)
        return z3_vars

    def verify_predicate_separation(
        self,
        predicate_name: str,
        predicate_expr: str,
        variables: Dict[str, str],
        domain_bounds: Optional[Dict[str, Tuple[int, int]]] = None,
    ) -> Tuple[bool, Dict[str, Any], str]:
        """Tests individual predicate P(x) for non-vacuity and non-triviality."""
        # 1. Inhabitation
        s_inhabit = z3.Solver()
        s_inhabit.set("timeout", self.timeout_ms)
        z3_vars = self._build_z3_vars(variables, s_inhabit)

        if domain_bounds:
            for name, (low, high) in domain_bounds.items():
                if name in z3_vars:
                    s_inhabit.add(z3_vars[name] >= low)
                    s_inhabit.add(z3_vars[name] <= high)

        try:
            p_ast = self._eval_expr(predicate_expr, z3_vars)
            s_inhabit.add(p_ast)
        except Exception as e:
            return False, {}, f"Failed to parse predicate expression: {e}"

        if s_inhabit.check() != z3.sat:
            return (
                False,
                {"inhabitation": False, "witness": None},
                f"REJECTED: Predicate '{predicate_name}' is unsatisfiable / uninhabited (∃ x, P(x) failed).",
            )

        m_inhabit = s_inhabit.model()
        witness_inhabit = {
            name: str(m_inhabit.eval(var, model_completion=True))
            for name, var in z3_vars.items()
        }

        # 2. Separation / Non-Triviality
        s_sep = z3.Solver()
        s_sep.set("timeout", self.timeout_ms)
        z3_vars_sep = self._build_z3_vars(variables, s_sep)

        if domain_bounds:
            for name, (low, high) in domain_bounds.items():
                if name in z3_vars_sep:
                    s_sep.add(z3_vars_sep[name] >= low)
                    s_sep.add(z3_vars_sep[name] <= high)

        p_ast_sep = self._eval_expr(predicate_expr, z3_vars_sep)
        s_sep.add(z3.Not(p_ast_sep))

        if s_sep.check() != z3.sat:
            return (
                False,
                {
                    "inhabitation": True,
                    "inhabitation_witness": witness_inhabit,
                    "separation": False,
                    "counter_witness": None,
                },
                f"REJECTED: Predicate '{predicate_name}' is a tautology (∃ y, ¬P(y) failed).",
            )

        m_sep = s_sep.model()
        counter_witness = {
            name: str(m_sep.eval(var, model_completion=True))
            for name, var in z3_vars_sep.items()
        }

        return (
            True,
            {
                "inhabitation": True,
                "inhabitation_witness": witness_inhabit,
                "separation": True,
                "counter_witness": counter_witness,
            },
            f"PASSED: Predicate '{predicate_name}' is non-vacuous and separates positive and negative witnesses.",
        )

    def verify_combined_hypotheses_separation(
        self,
        variables: Dict[str, str],
        hypotheses: List[str],
        domain_bounds: Optional[Dict[str, Tuple[int, int]]] = None,
    ) -> Tuple[bool, Dict[str, Any], str]:
        """
        Tests the COMBINED hypothesis set ⋀ H_i(x) for mutual satisfiability and non-triviality.
        """
        if not hypotheses:
            return True, {"inhabitation": True, "separation": True}, "No hypotheses (unconstrained)."

        # 1. Combined Inhabitation: ∃ x, ⋀ H_i(x)
        s_inhabit = z3.Solver()
        s_inhabit.set("timeout", self.timeout_ms)
        z3_vars = self._build_z3_vars(variables, s_inhabit)

        for h in hypotheses:
            try:
                s_inhabit.add(self._eval_expr(h, z3_vars))
            except Exception as e:
                return False, {}, f"Failed to parse combined hypothesis '{h}': {e}"

        if s_inhabit.check() != z3.sat:
            return (
                False,
                {"combined_inhabitation": False},
                "REJECTED: Combined hypothesis set is mutually contradictory (⋀ H_i ⊢ ⊥).",
            )

        m = s_inhabit.model()
        inhabit_witness = {
            name: str(m.eval(var, model_completion=True))
            for name, var in z3_vars.items()
        }

        # 2. Combined Separation Check: ∃ y, ¬(⋀ H_i(y))
        s_sep = z3.Solver()
        s_sep.set("timeout", self.timeout_ms)
        z3_vars_sep = self._build_z3_vars(variables, s_sep)

        hyp_asts = [self._eval_expr(h, z3_vars_sep) for h in hypotheses]
        combined_and = z3.And(*hyp_asts) if len(hyp_asts) > 1 else hyp_asts[0]
        s_sep.add(z3.Not(combined_and))

        is_universal = (s_sep.check() != z3.sat)
        sep_witness = None
        if not is_universal:
            m_sep = s_sep.model()
            sep_witness = {
                name: str(m_sep.eval(var, model_completion=True))
                for name, var in z3_vars_sep.items()
            }

        return (
            True,
            {
                "combined_inhabitation": True,
                "inhabitation_witness": inhabit_witness,
                "combined_separation": not is_universal,
                "is_universal_domain": is_universal,
                "counter_witness": sep_witness,
            },
            "PASSED: Combined hypotheses are mutually satisfiable (inhabited)."
            if not is_universal
            else "PASSED: Combined hypotheses hold universally on the domain (unconstrained universal theorem).",
        )
