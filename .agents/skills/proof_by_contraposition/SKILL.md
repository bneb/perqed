---
name: proof_by_contraposition
description: Prove P → Q by instead proving ¬Q → ¬P, which is logically equivalent and often easier when the conclusion's negation yields a stronger hypothesis than the premise.
---

# Proof by Contraposition

## Technique

The contrapositive of `P → Q` is `¬Q → ¬P`, a logically equivalent statement. Proving the contrapositive is often simpler because `¬Q` is a concrete, usable hypothesis ("something measurable fails") whereas `P` might be abstract or opaque.

Unlike contradiction, contraposition is constructive: you only need one implication direction. The proof commits to showing that whenever the conclusion is false, the premise must also be false. This makes it particularly effective for inequalities (if `x ≥ c` then `f(x) ≥ g(c)`), graph theory (if the graph is not connected then some edge set property fails), and divisibility arguments.

In Lean 4, `contrapose` or `contrapose!` rewrites the goal from `P → Q` to `¬Q → ¬P` and brings the negated conclusion into scope. `push_neg` then simplifies `¬Q` to a more usable form.

## When to Apply

- The direct proof `P → Q` lacks a handle: you can't easily construct the conclusion from the hypothesis.
- The negated conclusion `¬Q` is a stronger, more concrete statement (e.g., a strict inequality, a non-membership).
- The problem has a "flavour" of monotonicity: if the output is bounded, the input must be bounded.
- The ARCHITECT's context shows repeated failed attempts constructing the conclusion directly while the negation is obviously manageable.
- The statement involves divisibility, primality, or graph connectivity — these often have clean contrapositive formulations.

## Lean 4 Template

```lean
import Mathlib

-- Basic contrapositive
theorem [THEOREM_NAME] ([HYPOTHESES]) : [P] → [Q] := by
  contrapose!            -- goal becomes ¬[Q] → ¬[P]
  intro h                -- h : ¬[Q], goal : ¬[P]
  -- reason from h to ¬[P]
  [TACTIC_BLOCK]

-- With push_neg to simplify the negated quantifier
theorem [THEOREM_NAME]_quant (f : ℕ → ℕ) : (∀ n, f n ≤ n) → [GOAL] := by
  contrapose!
  push_neg               -- simplifies ¬∀ to ∃ ¬
  intro ⟨n, hn⟩
  [TACTIC_BLOCK]

-- Equivalence: use both directions
theorem [THEOREM_NAME]_iff : [P] ↔ [Q] := by
  constructor
  · intro hp; [FORWARD]
  · contrapose!; intro hnp; [BACKWARD]
```

## Worked Example

Proving: if n² is even then n is even:

```lean
import Mathlib

theorem even_of_sq_even (n : ℤ) (h : Even (n ^ 2)) : Even n := by
  contrapose! h
  -- h : ¬Even n, goal : ¬Even (n ^ 2)
  rw [Int.not_even_iff_odd] at h ⊢
  exact Int.Odd.pow h
```

## DAG Node Config Template

```json
{
  "id": "apply_proof_by_contraposition",
  "kind": "skill_apply",
  "label": "Flip implication to ¬Q → ¬P and prove that instead",
  "dependsOn": ["[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/proof_by_contraposition/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Lean 4 tactics `contrapose`, `contrapose!`, `push_neg` — https://leanprover-community.github.io/mathlib4_docs
- Mathlib4: `Mathlib.Logic.Basic`, `Mathlib.Data.Int.Parity`.
- Velleman, Daniel J. *How to Prove It*, Ch. 2: "Proofs by Contrapositive".
