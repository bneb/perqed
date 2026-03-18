---
name: maximality_zorns_lemma
description: Apply Zorn's Lemma to produce a maximal element in a partially ordered set where every chain is bounded above, enabling non-constructive existence proofs of maximal objects.
---

# Maximality (Zorn's Lemma)

## Technique

Zorn's Lemma states: if every chain in a non-empty partially ordered set has an upper bound, then the set has at least one maximal element. It is equivalent to the Axiom of Choice and the Well-Ordering Theorem.

The proof pattern has three steps: (1) define a partial order on the collection of candidate objects, (2) show that every chain (totally ordered subcollection) has an upper bound (usually the union or limit of the chain), (3) conclude that a maximal element exists by Zorn's Lemma.

The maximal element is then shown to be the desired object (a maximal ideal, a Hamel basis, a maximal clique, a maximal independent set) by arguing that any further extension contradicts maximality.

## When to Apply

- The goal is existence of a maximal (or minimal) element: maximal ideal, maximal linearly independent set, maximal clique.
- A basis or spanning set is needed for a vector space without a given dimension (infinite-dimensional spaces).
- A graph-theoretic argument requires a maximal matching, independent set, or acyclic subgraph.
- The existence is non-constructive: no explicit formula for the maximal element is available.
- The ARCHITECT's context shows a goal of the form `∃ M, Maximal P M` over an infinite structure.

## Lean 4 Template

```lean
import Mathlib

-- Zorn's Lemma (already in mathlib4)
#check zorn_le          -- for ≤ on a type
#check zorn_subset      -- for ⊆ on sets
#check zorn_partial_order  -- for PartialOrder

-- Maximal ideal existence in a ring
theorem maximal_ideal_exists (R : Type*) [CommRing R] [Nontrivial R] :
    ∃ I : Ideal R, I.IsMaximal := by
  exact Ideal.exists_maximal R

-- Hamel basis (maximal linearly independent set)
theorem hamel_basis_exists (K V : Type*) [DivisionRing K] [AddCommGroup V] [Module K V] :
    ∃ B : Set V, LinearIndependent K ((↑) : B → V) ∧ Submodule.span K B = ⊤ := by
  exact ⟨_, Module.Basis.exists_basis K V⟩

-- General Zorn application template
theorem zorn_application {α : Type*} [PartialOrder α]
    (S : Set α) (hS : S.Nonempty)
    (hchain : ∀ c ⊆ S, IsChain (· ≤ ·) c → ∃ ub ∈ S, ∀ x ∈ c, x ≤ ub) :
    ∃ m ∈ S, ∀ x ∈ S, m ≤ x → x = m := by
  -- Apply Zorn's lemma
  obtain ⟨m, hm, hmax⟩ := zorn_le₀ S (fun c hcS hchain => hchain c hcS hchain)
  exact ⟨m, hm, fun x hx hle => le_antisymm (hmax hx hle) hle⟩

-- Maximal clique existence (graph theory)
theorem maximal_clique_exists {V : Type*} [Fintype V] [DecidableEq V]
    (G : SimpleGraph V) [DecidableRel G.Adj] :
    ∃ S : Finset V, G.IsClique S ∧ ∀ v ∉ S, ¬ G.IsClique (insert v S) := by
  -- Apply finitary Zorn (or just take maximum on finite type)
  exact ⟨G.maximalClique, G.maximalClique_isClique, G.maximalClique_maximal⟩
```

## Worked Example

Existence of a maximal ideal in `ℤ`:

```lean
import Mathlib

-- Every commutative nontrivial ring has a maximal ideal
example : ∃ I : Ideal ℤ, I.IsMaximal :=
  Ideal.exists_maximal ℤ
```

## DAG Node Config Template

```json
{
  "id": "apply_zorns_lemma",
  "kind": "skill_apply",
  "label": "Apply Zorn's Lemma to extract maximal element",
  "dependsOn": ["[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/maximality_zorns_lemma/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Mathlib4: `Mathlib.Order.Zorn`, `Mathlib.Algebra.Ring.Ideal`, `Mathlib.LinearAlgebra.Basis`.
- Zorn, Max. "A Remark on Method in Transfinite Algebra." *Bull. AMS*, 1935.
- Lang, Serge. *Algebra*, Graduate Texts in Mathematics 211. Springer, 2002 (Ch. 1).
