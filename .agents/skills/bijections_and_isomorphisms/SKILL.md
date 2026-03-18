---
name: bijections_and_isomorphisms
description: Prove that two mathematical structures are essentially identical by exhibiting a structure-preserving map with an inverse; used to transfer properties and count equivalences.
---

# Bijections and Isomorphisms

## Technique

A bijection (a function that is both injective and surjective) between sets `A` and `B` establishes `|A| = |B|` and enables the transfer of any structural property that depends only on the set's cardinality or element relationships. An isomorphism extends this to structures: a group isomorphism preserves group operations; a graph isomorphism preserves edge relationships; a ring isomorphism preserves addition and multiplication.

The proof strategy has three parts: (1) define the map `f : A → B` explicitly, (2) prove injectivity (`f(a) = f(b) → a = b`), and (3) prove surjectivity (for every `b ∈ B`, find `a ∈ A` with `f(a) = b`). Once the bijection is established, properties of `A` transfer to `B` via the inverse map.

In Lean 4 / mathlib4, `Equiv` (for sets/types), `Finset.card_bij`, `MulEquiv`, `LinearEquiv`, and `GraphIso` provide the infrastructure for structural bijections. Cardinality equalities follow from `Fintype.card_congr`.

## When to Apply

- The goal is `|A| = |B|` or `Fintype.card A = Fintype.card B` and a natural correspondence is visible.
- Two algebraic structures (groups, rings, vector spaces) need to be identified as "the same" up to naming.
- A combinatorial identity requires establishing a bijection between two sets of combinatorial objects.
- The proof requires transferring a known property from a simple structure to a complex one via an isomorphism.
- The ARCHITECT's context shows a counting argument blocked by the need to match two finite sets.

## Lean 4 Template

```lean
import Mathlib

-- Bijection via Equiv
def [NAME]_equiv : [TYPE_A] ≃ [TYPE_B] where
  toFun := fun a => [FORWARD_FORMULA a]
  invFun := fun b => [INVERSE_FORMULA b]
  left_inv := by intro a; [PROVE_LEFT_INVERSE]
  right_inv := by intro b; [PROVE_RIGHT_INVERSE]

-- Cardinality equality from Equiv
theorem [CARD_THEOREM] : Fintype.card [A] = Fintype.card [B] :=
  Fintype.card_congr [NAME]_equiv

-- Finset bijection for counting argument
theorem [FINSET_CARD] (s t : Finset α) (hs : s.card = t.card) : [CONCLUSION] := by
  obtain ⟨f, hf⟩ := Finset.equivOfCardEq hs
  [USE_BIJECTION f]

-- Group isomorphism
def [GROUP_ISO] : [GROUP_A] ≃* [GROUP_B] where
  toFun   := [FORWARD_MAP]
  invFun  := [INVERSE_MAP]
  left_inv  := [LEFT_INVERSE_PROOF]
  right_inv := [RIGHT_INVERSE_PROOF]
  map_mul' := by intros; [HOMOMORPHISM_PROOF]

-- Injectivity + surjectivity decomposition
theorem [BIJECTIVE_THEOREM] (f : [A] → [B]) : Function.Bijective f := by
  constructor
  · intro a₁ a₂ h; [INJECTIVITY_PROOF]
  · intro b; exact ⟨[PREIMAGE b], by [SURJECTIVITY_PROOF]⟩
```

## Worked Example

Bijection between `Fin (m * n)` and `Fin m × Fin n`:

```lean
import Mathlib

example : Fin (5 * 3) ≃ Fin 5 × Fin 3 :=
  finProdFinEquiv.symm
```

## DAG Node Config Template

```json
{
  "id": "apply_bijection",
  "kind": "skill_apply",
  "label": "Establish bijection/isomorphism to transfer properties",
  "dependsOn": ["[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/bijections_and_isomorphisms/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Mathlib4: `Mathlib.Data.Equiv.Basic`, `Mathlib.Data.Fintype.Card`, `Mathlib.GroupTheory.GroupAction.Basic`.
- Cameron, Peter. *Combinatorics: Topics, Techniques, Algorithms.* Cambridge, 1994 (Ch. 3).
- Lean 4 `Equiv` and `finProdFinEquiv` — https://leanprover-community.github.io/mathlib4_docs.
