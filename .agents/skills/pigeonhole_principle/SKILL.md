---
name: pigeonhole_principle
description: If n+1 or more objects are placed into n categories, at least one category contains at least two objects; a fundamental combinatorial tool for proving existence of collisions, repeated values, or concentrated structures.
---

# Pigeonhole Principle

## Technique

The pigeonhole principle (Dirichlet's box principle) states: if `|A| > |B|` and `f : A → B`, then `f` is not injective — some element of `B` has at least two preimages. The quantitative extension (strong pigeonhole) says: if `n` items are placed in `k` boxes, some box contains at least `⌈n/k⌉` items.

This principle is deceptively deep. It implies: some two integers in any `n+1` subset of `{1..2n}` are coprime; in any sequence of `n²+1` distinct reals there is a monotone subsequence of length `n+1` (Erdős–Szekeres); in any Ramsey-type argument, one color class is large enough to contain a monochromatic clique.

The Ramsey number lower bound works exactly this way: in a 2-coloring of K_n edges, one color has at least ⌈n(n-1)/4⌉ edges, which by Turán's theorem forces a clique.

## When to Apply

- The goal is `∃ a b, a ≠ b ∧ f(a) = f(b)` (collision existence).
- A counting argument shows there are more objects than containers.
- The proof requires finding a "dense" subset within a large combinatorial object.
- The ARCHITECT's context shows a Ramsey-type problem where one color class must be large.
- Z3 or the SA worker found a high-energy state — the pigeonhole argument explains *why* a witness must exist even if we haven't found it yet.
- A modular arithmetic argument needs: two elements in the same residue class mod n.

## Lean 4 Template

```lean
import Mathlib

-- Basic pigeonhole: injective impossible when domain is larger
theorem pigeonhole_basic {α β : Type*} [Fintype α] [Fintype β]
    (h : Fintype.card β < Fintype.card α) (f : α → β) :
    ¬ Function.Injective f :=
  Fintype.not_injective_of_card_lt f h

-- Finset version: mapping into a smaller set
theorem pigeonhole_finset {α β : Type*} (s : Finset α) (t : Finset β)
    (f : α → β) (hf : ∀ a ∈ s, f a ∈ t) (hcard : t.card < s.card) :
    ∃ x ∈ s, ∃ y ∈ s, x ≠ y ∧ f x = f y :=
  Finset.exists_ne_map_eq_of_card_lt_of_maps_to hcard hf

-- Strong pigeonhole: some box has ≥ ⌈n/k⌉ elements
theorem strong_pigeonhole {α β : Type*} (s : Finset α) (t : Finset β)
    (f : α → β) (hf : ∀ a ∈ s, f a ∈ t) (ht : t.Nonempty) :
    ∃ b ∈ t, t.card * (s.filter (fun a => f a = b)).card ≥ s.card := by
  [AVERAGING_ARGUMENT]

-- Modular pigeonhole: two elements in same mod class
theorem modular_pigeonhole (S : Finset ℕ) (n : ℕ) (hn : 0 < n)
    (hcard : n < S.card) :
    ∃ a ∈ S, ∃ b ∈ S, a ≠ b ∧ a % n = b % n :=
  Finset.exists_ne_map_eq_of_card_lt_of_maps_to
    (by simp [Finset.card_range]; omega)
    (fun a _ => Finset.mem_range.mpr (Nat.mod_lt a hn))
```

## Worked Example

Using pigeonhole to find a monochromatic pair in any 2-coloring of 5 points:

```lean
import Mathlib

-- In a 2-coloring of 5 vertices, some color class has ≥ 3 vertices
theorem ramsey_1_1 (col : Fin 5 → Fin 2) :
    (∃ S : Finset (Fin 5), S.card ≥ 3 ∧ ∀ v ∈ S, col v = 0) ∨
    (∃ S : Finset (Fin 5), S.card ≥ 3 ∧ ∀ v ∈ S, col v = 1) := by
  have h0 := (Finset.univ.filter (fun v => col v = 0)).card
  have h1 := (Finset.univ.filter (fun v => col v = 1)).card
  simp at h0 h1
  omega
```

## DAG Node Config Template

```json
{
  "id": "apply_pigeonhole",
  "kind": "skill_apply",
  "label": "Apply pigeonhole: more objects than containers yields a collision",
  "dependsOn": ["[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/pigeonhole_principle/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Mathlib4: `Mathlib.Data.Finset.Card`, `Finset.exists_ne_map_eq_of_card_lt_of_maps_to`.
- Alon & Spencer. *The Probabilistic Method*, 4th ed. Wiley, 2016 (Ch. 1).
- Erdős, Szekeres. "A Combinatorial Problem in Geometry." *Compositio Math.*, 1935.
