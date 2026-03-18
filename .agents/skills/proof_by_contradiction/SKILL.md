---
name: proof_by_contradiction
description: Assume the negation of the goal, derive a logical contradiction (False), and conclude the original statement must be true. Essential for proving existence and irrationality results.
---

# Proof by Contradiction

## Technique

Proof by contradiction (reductio ad absurdum) assumes `¬Q` and derives `False`, thereby establishing `Q`. The method is justified by the law of excluded middle: if `¬Q` leads to a contradiction, then `Q` must hold.

The power of this technique is that `¬Q` adds a new, strong hypothesis to your context. This hypothesis can be combined with existing hypotheses to derive contradictions algebraically (two incompatible bounds), set-theoretically (element membership and exclusion), or cardinality-theoretically (more injections than the domain allows).

In Lean 4, `by_contra h` introduces `h : ¬Q` and sets the goal to `False`. `push_neg h` simplifies `h` by distributing the negation inward (e.g., `¬∀ x, P x` becomes `∃ x, ¬P x`). The proof concludes with `exact absurd [FACT] [h]` or `linarith` when arithmetic closes the contradiction.

## When to Apply

- The goal is an irrationality statement (`¬∃ p q, ...`) or a non-membership claim.
- Assuming `Q` false immediately gives you a strong new hypothesis that breaks an established bound.
- Existence proofs where the witness is hard to construct directly but non-existence leads to an obvious contradiction.
- The problem is a classical theorem that has no known constructive proof (e.g., existence of transcendentals).
- The ARCHITECT's context shows a goal of the form `h : a < b` and `h' : b ≤ a`, or two incompatible cardinality bounds.

## Lean 4 Template

```lean
import Mathlib

-- Basic contradiction
theorem [THEOREM_NAME] ([HYPOTHESES]) : [GOAL] := by
  by_contra h          -- introduces h : ¬[GOAL]
  push_neg at h         -- simplifies the negation if it's a quantified statement
  -- derive a contradiction from h and the hypotheses
  exact absurd [FACT_FROM_HYPS] h

-- Arithmetic contradiction
theorem [THEOREM_NAME]_arith ([HYPOTHESES]) : [INEQUALITY_GOAL] := by
  by_contra h
  push_neg at h          -- h : [OPPOSITE_INEQUALITY]
  have : [INTERMEDIATE] := [LEMMA] [ARGS]
  linarith               -- closes via linear arithmetic contradiction

-- Irrationality / non-membership
theorem sqrt_two_irrational : Irrational (Real.sqrt 2) := by
  rw [irrational_iff_ne_rational]
  intro m n hn h
  -- structural contradiction via 2 ∣ m and 2 ∣ n simultaneously
  sorry
```

## Worked Example

Proving there are infinitely many primes:

```lean
import Mathlib

theorem infinitely_many_primes : ∀ n : ℕ, ∃ p, n < p ∧ Nat.Prime p := by
  intro n
  by_contra h
  push_neg at h
  -- h : ∀ p, Nat.Prime p → p ≤ n
  -- The product (∏ p in primes ≤ n, p) + 1 is not divisible by any prime ≤ n
  have := Nat.exists_infinite_primes (n + 1)
  obtain ⟨p, hp1, hp2⟩ := this
  exact absurd (h p hp2) (by omega)
```

## DAG Node Config Template

```json
{
  "id": "apply_proof_by_contradiction",
  "kind": "skill_apply",
  "label": "Assume negation and derive False",
  "dependsOn": ["[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/proof_by_contradiction/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Lean 4 tactic `by_contra`, `push_neg`, `absurd` — https://leanprover-community.github.io/mathlib4_docs
- Hardy, G.H. *A Mathematician's Apology.* Cambridge, 1940 (classic contradiction proofs).
- Mathlib4: `Mathlib.RingTheory.Algebraic`, `Mathlib.NumberTheory.Primes.Infinite`.
