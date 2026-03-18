---
name: local_to_global_hasse_principle
description: Prove a global existence result by first establishing existence at all local completions (p-adic and real), then applying the Hasse-Minkowski theorem or analogous local-global principle to lift to the integers or rationals.
---

# Local-to-Global (Hasse Principle)

## Technique

The Hasse (or local-global) principle asserts that a system of polynomial equations has a solution over ℚ if and only if it has a solution over ℝ and over ℚ_p for all primes p. For quadratic forms this is a theorem (Hasse-Minkowski); for higher degrees it can fail (Selmer's counterexample: 3x³+4y³+5z³=0 has local solutions everywhere but no rational solution).

The proof strategy: (1) show local solutions at ∞ (over ℝ) and at each prime p (over ℚ_p or ℤ/pⁿℤ), (2) invoke the Hasse-Minkowski theorem (for quadratics) or a more refined lift (for other structures).

More broadly, local-to-global arguments appear in: cohomology (Čech → sheaf cohomology), number theory (adeles and ideles), and topology (covering spaces, sheaves, and descent). The philosophy is: verify a property on every "patch" of the appropriate covering and assemble a global witness.

## When to Apply

- The goal is existence of a rational or integer solution to a quadratic form equation.
- An arithmetic property is to be checked modulo all prime powers (p-adic verification).
- A geometric or algebraic structure is to be assembled from local data (sheaf axioms, descent).
- The ARCHITECT's journal shows that Z3 proved satisfiability over various finite fields but needs global conclusion.
- A statement "holds over all finite fields" needs to be lifted to a characteristic-0 statement.

## Lean 4 Template

```lean
import Mathlib

-- Hasse-Minkowski: quadratic form over ℚ represents 0 iff it does over all completions
-- (mathlib4 formalization is in progress — state the key steps)

-- Local solution existence (over ℤ/pℤ)
theorem local_solution_mod_p (p : ℕ) [hp : Fact p.Prime]
    (a b c : ZMod p) (ha : a ≠ 0) :
    ∃ x y z : ZMod p, a * x^2 + b * y^2 + c * z^2 = 0 := by
  -- For ternary quadratics over finite fields, non-trivial zero always exists
  sorry  -- follows from Chevalley-Warning when p > 2

-- Hensel's lemma: lift mod p solution to ℤ_p  
theorem hensel_lift (f : Polynomial ℤ) (a : ZMod (p^n)) (ha : f.eval₂ (Int.castRingHom _) a = 0)
    (hda : f.derivative.eval₂ (Int.castRingHom _) a ≠ 0) :
    ∃ b : ZMod (p^(n+1)), f.eval₂ (Int.castRingHom _) b = 0 ∧ b ≡ a [MOD p] := by
  sorry  -- Hensel.apply in mathlib4

#check Polynomial.IsHenselian  -- mathlib4 Hensel's lemma infrastructure

-- Adelic global-local bridge (structural)
-- A quadratic form q over ℚ has a non-trivial zero ↔
-- it has a non-trivial zero over ℝ AND over ℚ_p for all p
theorem hasse_minkowski_sketch (q : QuadraticForm ℚ (Fin n → ℚ)) :
    [REPRESENTS_ZERO q] ↔ 
    ([REPRESENTS_ZERO_OVER_REAL q] ∧ ∀ p : ℕ, p.Prime → [REPRESENTS_ZERO_OVER_Qp p q]) := by
  sorry  -- Active area: mathlib4 has partial formalization
```

## Worked Example

Sum of two squares: n = a² + b² iff every prime p ≡ 3 (mod 4) divides n to an even power:

```lean
import Mathlib

-- Fermat's two-square theorem
#check Nat.Prime.sq_add_sq  -- ℕ.Prime.sq_add_sq: p.Prime → p = 2 ∨ p % 4 = 1 → ...
theorem fermat_two_squares (p : ℕ) (hp : p.Prime) (hp1 : p % 4 = 1) :
    ∃ a b : ℤ, a ^ 2 + b ^ 2 = p := by
  exact hp.sq_add_sq (Or.inr hp1)
```

## DAG Node Config Template

```json
{
  "id": "apply_local_to_global",
  "kind": "skill_apply",
  "label": "Verify at all local completions and apply Hasse principle",
  "dependsOn": ["z3_mod_p_check", "literature"],
  "config": {
    "skillPath": ".agents/skills/local_to_global_hasse_principle/SKILL.md",
    "inputFromNode": "z3_mod_p_check"
  }
}
```

## Key References

- Mathlib4: `Mathlib.NumberTheory.Bernoulli`, `Mathlib.RingTheory.Henselian`.
- Serre, Jean-Pierre. *A Course in Arithmetic*. Springer GTM 7, 1973 (Ch. 4: quadratic forms over ℚ_p).
- Cassels & Fröhlich. *Algebraic Number Theory.* Academic Press, 1968 (adeles).
