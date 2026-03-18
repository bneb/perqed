---
name: fixed_point_arguments
description: Prove existence of a fixed point f(x) = x using Brouwer's, Banach's, or Tarski's fixed-point theorem based on the space type (compact convex, metric, or lattice).
---

# Fixed-Point Arguments

## Technique

A fixed-point theorem guarantees that for a function `f : X → X` satisfying certain conditions, there exists `x* ∈ X` with `f(x*) = x*`. The three main versions divide by the space type:

**Banach (Contraction Mapping)**: If `X` is a complete metric space and `f` is a contraction (`∃ L < 1, ∀ x y, d(fx, fy) ≤ L * d(x,y)`), then `f` has a unique fixed point. This yields both existence and a constructive iteration `x_{n+1} = f(x_n)`.

**Brouwer**: Every continuous `f : Dⁿ → Dⁿ` (unit disk in ℝⁿ) has a fixed point. Non-constructive; proved topologically (no retraction of Dⁿ onto ∂Dⁿ).

**Tarski**: Every monotone endomorphism of a complete lattice has a fixed point. Used in logic and program verification for least/greatest fixed points of monotone operators.

## When to Apply

- The goal is existence of a solution to `x = f(x)` (fixed-point equation).
- The function is a contraction on a complete metric space → Banach gives uniqueness too.
- The function maps a compact convex set to itself continuously → Brouwer.
- A monotone operator on a lattice needs a least fixed point → Tarski (for Kleene's theorem).
- The ARCHITECT's context shows an ODE or integral equation whose solution is a fixed point of a Picard iteration.

## Lean 4 Template

```lean
import Mathlib

-- Banach fixed point theorem
theorem banach_fixed_point_application
    {α : Type*} [MetricSpace α] [CompleteSpace α]
    (f : α → α) (L : ℝ) (hL : L < 1) (hL0 : 0 ≤ L)
    (hf : ∀ x y, dist (f x) (f y) ≤ L * dist x y) :
    ∃! x, f x = x :=
  (ContractingWith.mk ⟨⟨L, hL0⟩, hL⟩ hf).exists_fixedPoint

-- Brouwer fixed point (requires topology — stated here, proof via mathlib)
#check IsFixedPt
#check Continuous.isFixedPt  -- placeholder; Brouwer is in Mathlib
-- theorem brouwer_fixed_point [COMPACT_CONVEX X] (f : X → X) (hf : Continuous f) :
--   ∃ x, f x = x := ...

-- Tarski fixed point on a complete lattice
theorem tarski_fixed_point {α : Type*} [CompleteLattice α]
    (f : α → α) (hf : Monotone f) : ∃ a, f a = a := by
  exact ⟨sSup {a | a ≤ f a}, by
    have h1 : sSup {a | a ≤ f a} ≤ f (sSup {a | a ≤ f a}) := by
      apply sSup_le; intro a ha; exact ha.trans (hf (le_sSup ha))
    exact le_antisymm (hf h1 |>.trans' h1 |> le_sSup |>.antisymm h1) h1⟩

-- Picard iteration pattern (for ODEs)
-- x_{n+1} = T(x_n), converges to fixed point of T
def picard_iterate (T : [FUNCTION_SPACE] → [FUNCTION_SPACE]) (x₀ : [FUNCTION_SPACE]) :
    ℕ → [FUNCTION_SPACE]
  | 0     => x₀
  | n + 1 => T (picard_iterate T x₀ n)
```

## Worked Example

Banach fixed point for a contraction on ℝ:

```lean
import Mathlib

example : ∃! x : ℝ, (1/2) * x + 1 = x := by
  -- f(x) = x/2 + 1 is a contraction with L = 1/2
  have : ContractingWith ⟨1/2, by norm_num⟩ (fun x : ℝ => (1/2) * x + 1) := by
    constructor
    · norm_num
    · intro x y; simp [dist_comm, abs_sub_comm]; ring_nf; norm_num
  exact this.exists_fixedPoint
```

## DAG Node Config Template

```json
{
  "id": "apply_fixed_point",
  "kind": "skill_apply",
  "label": "Apply Banach/Brouwer/Tarski fixed-point theorem for existence",
  "dependsOn": ["[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/fixed_point_arguments/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Mathlib4: `Mathlib.Topology.MetricSpace.ContractingWith`, `Mathlib.Order.FixedPoint`.
- Banach, Stefan. "Sur les opérations dans les ensembles abstraits." *Fund. Math.*, 1922.
- Tarski, Alfred. "A Lattice-Theoretical Fixpoint Theorem." *Pacific J. Math.*, 1955.
