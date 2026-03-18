---
name: duality_arguments
description: Prove a statement about primal objects (vectors, polyhedra, programs) by passing to the dual and exploiting weak or strong duality to transfer bounds or optimality conditions.
---

# Duality Arguments

## Technique

Duality transforms a problem about a mathematical object into an equivalent or complementary problem about a "dual" object in the same or related category. The key insight is that the dual often exposes structure invisible in the primal.

**LP Duality**: Every linear program has a dual LP. Weak duality: any feasible primal solution bounds the optimal dual value. Strong duality (Farkas/von Neumann): primal and dual optima coincide when both are feasible. This is used to prove min-max theorems (max-flow min-cut, König's theorem, minimax for games).

**Order Duality**: In a poset, reverse all inequalities. A down-closed set becomes an up-closed set. Dilworth's theorem (max antichains = min chain covers) follows from König's theorem via order duality.

**Algebraic Duality**: The dual of a vector space `V` is `V* = Hom(V, k)`. Annihilators and dual bases transfer linear independence properties.

## When to Apply

- The goal is a min-max equality (max-flow = min-cut, minimax theorem).
- A linear programming bound is needed: exhibit a dual certificate to certify optimality.
- Farkas lemma: prove infeasibility of a system `Ax ≤ b` by exhibiting a dual multiplier.
- König's theorem application: bipartite matching size = vertex cover size.
- The ARCHITECT's context shows a combinatorial optimization problem where the dual is easier to analyze.

## Lean 4 Template

```lean
import Mathlib

-- LP duality pattern (using Farkas lemma)
-- Primal: min c·x s.t. Ax = b, x ≥ 0
-- Dual:   max b·y s.t. Aᵀy ≤ c
-- Strong duality: optimal values coincide

theorem farkas_alternative {m n : ℕ} (A : Matrix (Fin m) (Fin n) ℝ) (b : Fin m → ℝ) :
    (∃ x : Fin n → ℝ, (∀ i, 0 ≤ x i) ∧ A.mulVec x = b) ∨
    (∃ y : Fin m → ℝ, Aᵀ.mulVec y ≥ 0 ∧ Matrix.dotProduct y b < 0) := by
  exact Matrix.Farkas A b   -- mathlib4 may have this

-- Order duality: Dilworth's theorem sketch
-- max antichain = min chain cover
theorem dilworth {α : Type*} [PartialOrder α] [Fintype α] :
    ∃ (k : ℕ), [MAX_ANTICHAIN_SIZE α = k] ∧ [MIN_CHAIN_COVER α = k] := by
  sorry  -- requires König's theorem

-- Vector space duality
theorem dual_annihilator_complement {K V : Type*} [Field K] [AddCommGroup V] [Module K V]
    (W : Subspace K V) : W.dualAnnihilator.dualAnnihilator = W.map (Subspace.dualMap K) := by
  sorry

-- Game theory minimax (von Neumann)
-- max_{x ∈ Δ_m} min_{y ∈ Δ_n} xᵀ A y = min_{y ∈ Δ_n} max_{x ∈ Δ_m} xᵀ A y
theorem minimax {m n : ℕ} (A : Matrix (Fin m) (Fin n) ℝ) :
    [MINIMAX_EQUALITY A] := by
  sorry  -- follows from LP strong duality
```

## Worked Example

Max-flow min-cut (structural statement):

```lean
import Mathlib

-- Max flow = min cut capacity in a network
-- This is König's theorem for bipartite matchings
#check Finset.maxMatching  -- bipartite matching tooling
```

## DAG Node Config Template

```json
{
  "id": "apply_duality",
  "kind": "skill_apply",
  "label": "Pass to dual problem and apply weak/strong duality for bound",
  "dependsOn": ["[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/duality_arguments/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Mathlib4: `Mathlib.LinearAlgebra.Dual`, `Mathlib.Analysis.InnerProductSpace.Dual`.
- Schrijver, Alexander. *Theory of Linear and Integer Programming.* Wiley, 1998.
- von Neumann, John. "Zur Theorie der Gesellschaftsspiele." *Math. Ann.*, 1928.
