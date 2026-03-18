---
name: direct_proof
description: Construct a proof by directly deriving the conclusion from the hypotheses using definitions, established lemmas, and logical inference, without requiring contradiction or case splits.
---

# Direct Proof

## Technique

A direct proof establishes `P → Q` by assuming `P` holds and then constructing a valid derivation that yields `Q`. The derivation may involve unfolding definitions, applying previously proven lemmas, performing algebraic rewrites, or combining hypotheses via modus ponens.

The key discipline is forward reasoning: every step must follow from what is already available. When the goal is an existential `∃ x, P x`, direct proof provides the witness explicitly. When the goal is a universal `∀ x, P x`, direct proof fixes an arbitrary `x` and reasons to `P x`.

In Lean 4 / mathlib4 this is the default mode: `intro` to bring hypotheses into scope, `apply` or `exact` to discharge subgoals, and `simp` / `ring` / `omega` to close purely computational leaves.

## When to Apply

- The goal follows from a chain of definitions whose unfolding terminates the proof immediately.
- The hypotheses directly provide all required information and only need to be composed.
- A `calc` chain is the cleanest way to expose the derivation to a human reader.
- All other techniques (contradiction, induction) feel unnecessary — the problem statement is essentially a definition unwrapping.
- The ARCHITECT's journal shows no previous direct attempt; the worker stalled while building more complex structure.

## Lean 4 Template

```lean
import Mathlib

-- Direct proof template
theorem [THEOREM_NAME] ([HYPOTHESES]) : [GOAL] := by
  -- Step 1: introduce all universally quantified variables and hypotheses
  intro [VARS] [HYP_NAMES]
  -- Step 2: unfold relevant definitions if needed
  simp only [[DEF_NAMES]]
  -- Step 3: chain lemma applications
  apply [LEMMA_A]
  exact [LEMMA_B] [ARGS]

-- For equalities, prefer a calc block for readability
theorem [THEOREM_NAME]_calc ([HYPOTHESES]) : [LHS] = [RHS] := by
  calc [LHS]
      _ = [INTERMEDIATE_1] := by [TACTIC_1]
      _ = [INTERMEDIATE_2] := by [TACTIC_2]
      _ = [RHS]            := by [TACTIC_3]

-- For existential goals, provide the witness directly
theorem [THEOREM_NAME]_exists : ∃ n : ℕ, [PROPERTY n] := by
  exact ⟨[WITNESS], [PROOF_OF_PROPERTY]⟩
```

## Worked Example

Proving that the sum of two even integers is even:

```lean
import Mathlib

theorem even_add_even (m n : ℤ) (hm : Even m) (hn : Even n) : Even (m + n) := by
  obtain ⟨a, ha⟩ := hm
  obtain ⟨b, hb⟩ := hn
  exact ⟨a + b, by linarith⟩
```

## DAG Node Config Template

```json
{
  "id": "apply_direct_proof",
  "kind": "skill_apply",
  "label": "Attempt direct derivation from hypotheses",
  "dependsOn": ["[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/direct_proof/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Velleman, Daniel J. *How to Prove It: A Structured Approach.* Cambridge, 2019.
- Lean 4 Theorem Proving Reference: `intro`, `apply`, `exact`, `calc` — https://leanprover.github.io/lean4/doc/tactics.html
- Mathlib4 `Algebra.Basic`, `Data.Int.Defs` for integer parity lemmas.
