---
name: analytic_continuation
description: Extend the domain of a complex analytic function beyond its initial region of convergence using the identity theorem and Schwarz reflection, or derive global properties from local data.
---

# Analytic Continuation

## Technique

Analytic continuation extends a complex analytic function `f` from an open set `U ⊆ ℂ` to a larger domain `V ⊇ U`. The key theorem (Identity Theorem) states: if two analytic functions on a connected open domain agree on a set with an accumulation point, they agree everywhere. This means the "continuation" of `f` to `V` is unique when it exists.

The practical proof pattern: (1) define `f` on `U` by a power series or integral formula, (2) show the continued function `F` on `V` satisfies the same functional equations or differential equations as `f`, and (3) invoke the Identity Theorem to conclude `F = f` on `U`.

Key examples: the Riemann zeta function extends from Re(s) > 1 to all of ℂ \ {1} via the Euler product and functional equation. The Gamma function extends from Re(z) > 0 to ℂ \ ℤ≤0 via the reflection formula Γ(z)Γ(1-z) = π/sin(πz).

## When to Apply

- The goal requires properties of `ζ(s)` or `Γ(z)` outside their initial domains of definition.
- A function defined by a convergent series in a half-plane needs to be evaluated at a point outside.
- Two analytic functions agree on a real interval and need to be shown to agree on a full complex neighborhood.
- The Schwarz reflection principle is needed: a function on the upper half-plane with real boundary values extends to the lower half-plane.
- The ARCHITECT's context shows a complex function identity that holds for large Re(s) but needs to be extended.

## Lean 4 Template

```lean
import Mathlib

open Complex

-- Identity theorem: two analytic functions agreeing on a sequence are equal
theorem identity_theorem_application {f g : ℂ → ℂ}
    (hf : AnalyticOn ℂ f (Set.univ))  
    (hg : AnalyticOn ℂ g (Set.univ))
    (s : ℕ → ℂ) (hs : Filter.Tendsto s Filter.atTop (nhds z₀))
    (hagree : ∀ n, f (s n) = g (s n)) :
    f = g := by
  sorry  -- identity theorem: eq on accumulation set → eq everywhere

-- Analytic continuation exists and is unique
#check Complex.AnalyticOn
#check Complex.analyticAt_iff_hasSum

-- Riemann zeta function (defined in mathlib4 via Hurwitz zeta)
#check Complex.riemannZeta

-- Functional equation for ζ
#check Complex.riemannZeta_one_sub

-- Gamma function analytic continuation
#check Complex.Gamma

-- Schwarz reflection principle sketch
theorem schwarz_reflection (f : ℂ → ℂ)
    (hf : AnalyticOn ℂ f {z | 0 < z.im})
    (hR : ∀ x : ℝ, ContinuousAt f x ∧ (f x).im = 0) :
    ∃ F : ℂ → ℂ, AnalyticOn ℂ F Set.univ ∧ ∀ z, 0 < z.im → F z = f z := by
  -- F(z̄) = conj(f(z)) gives the reflection
  sorry

-- Taylor series radius of convergence and continuation
theorem power_series_continuation {f : ℂ → ℂ} (hf : AnalyticAt ℂ f 0)
    (R : ℝ≥0) (hR : EMetric.ball 0 R ⊆ {z | AnalyticAt ℂ f z}) :
    ∃ F : FormalMultilinearSeries ℂ ℂ ℂ, HasFPowerSeriesOnBall f F 0 R := by
  exact hf.hasFiniteRadius.exists_hasFPowerSeriesOnBall
```

## Worked Example

Zeta function functional equation (key identity):

```lean
import Mathlib

-- ζ(s) = 2^s π^(s-1) sin(πs/2) Γ(1-s) ζ(1-s)
#check Complex.riemannZeta_one_sub  -- the functional equation is in mathlib4

example (s : ℂ) (hs : s ≠ 1) : Complex.riemannZeta (1 - s) = 
    2^(1-s) * π^(-s) * Complex.Gamma s * Complex.sin (π * s / 2) * Complex.riemannZeta s := by
  sorry -- follows from riemannZeta_one_sub
```

## DAG Node Config Template

```json
{
  "id": "apply_analytic_continuation",
  "kind": "skill_apply",
  "label": "Extend analytic function and derive global identity via continuation",
  "dependsOn": ["literature", "[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/analytic_continuation/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Mathlib4: `Mathlib.Analysis.Complex.RemovableSingularity`, `Mathlib.NumberTheory.ZetaFunction`.
- Ahlfors, Lars. *Complex Analysis*, 3rd ed. McGraw-Hill, 1979 (Ch. 8: analytic continuation).
- Stein & Shakarchi. *Complex Analysis*. Princeton, 2003 (Ch. 5: Riemann zeta and continuation).
