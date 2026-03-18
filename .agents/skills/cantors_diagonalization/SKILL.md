---
name: cantors_diagonalization
description: Prove that a set has strictly greater cardinality than its power set, or that certain functions cannot be surjective, by constructing a diagonal element that differs from every element of any proposed enumeration.
---

# Cantor's Diagonalization

## Technique

Diagonalization proves non-enumerability by construction: given any proposed surjection `f : ℕ → S`, construct an element `d ∈ S` that differs from `f(n)` in the `n`-th position. This element `d` cannot be in the range of `f`, contradicting surjectivity.

The technique generalizes: `|A| < |P(A)|` for any set `A` (Cantor's theorem); no Turing machine can solve the Halting problem (the halting problem is undecidable); no computable function can enumerate all computable functions (Kleene's diagonal lemma). Every "self-reference creates a contradiction" argument is a diagonalization.

In Lean 4 / mathlib4, `Cantor.not_surjective` gives the abstract result. For specific applications, the proof constructs the diagonal explicitly as a function `ℕ → Bool` that inverts `f(n)(n)` at each step.

## When to Apply

- The goal is `¬∃ f : ℕ → S, Function.Surjective f` (S is uncountable or larger than ℕ).
- The proof needs `|A| < |P(A)|` (power set is strictly larger).
- A computability argument requires showing no algorithm can solve a given problem.
- The ARCHITECT's context shows a problem about the size of a function space being too large to enumerate.
- A Gödel-type incompleteness argument is needed: no formal system can prove all truths.

## Lean 4 Template

```lean
import Mathlib

-- Cantor's theorem: no surjection A → P(A)
theorem cantor_no_surjection (α : Type*) (f : α → Set α) :
    ¬ Function.Surjective f := by
  intro h
  -- Construct the diagonal set: D = {a | a ∉ f(a)}
  let D := {a | a ∉ f a}
  obtain ⟨d, hd⟩ := h D
  -- d ∈ D ↔ d ∉ f(d) = D: contradiction
  by_cases hdd : d ∈ D
  · exact hdd (hd ▸ hdd)
  · exact hdd (hd ▸ hdd)

-- Uncountability of ℕ → Bool = 2^ℕ
theorem cantor_reals : ¬ Function.Surjective (fun f : ℕ → Bool => (f : ℕ → Bool)) := by
  -- The general result
  exact fun h => Cantor.not_surjective h

-- Abstract diagonal argument template
theorem diagonal_argument {α β : Type*} [Nonempty β] (f : α → α → β)
    (inv : β → β) (h_inv : ∀ b, inv b ≠ b) :
    ¬ Function.Surjective (fun a : α => fun b : α => f a b) := by
  intro hsurj
  -- diagonal: d(a) = inv(f(a)(a))
  let d : α → β := fun a => inv (f a a)
  obtain ⟨a, ha⟩ := hsurj d
  have := h_inv (f a a)
  simp [d, Function.funext_iff] at ha
  exact this (ha a).symm
```

## Worked Example

```lean
import Mathlib

-- ℝ is uncountable (via surjection from ℝ to Set ℝ would violate Cantor)
#check Cardinal.mk_real  -- Cardinal.mk ℝ = 𝔠 (continuum)
#check Cardinal.cantor   -- ∀ a, a < 2 ^ a
```

## DAG Node Config Template

```json
{
  "id": "apply_diagonalization",
  "kind": "skill_apply",
  "label": "Construct diagonal element to refute surjectivity",
  "dependsOn": ["[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/cantors_diagonalization/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Mathlib4: `Mathlib.Logic.Cantor`, `Mathlib.SetTheory.Cardinal.Basic`.
- Cantor, Georg. "Über eine elementare Frage der Mannigfaltigkeitslehre." *JDMV*, 1891.
- Sipser, Michael. *Introduction to the Theory of Computation*, Ch. 4 (undecidability via diagonalization).
