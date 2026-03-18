---
name: mathematical_induction
description: Prove a property P(n) holds for all natural numbers by establishing P(0) (base case) and P(n) → P(n+1) (inductive step), with strong induction available when P(k) for all k < n is needed.
---

# Mathematical Induction

## Technique

Standard (weak) induction proves `∀ n : ℕ, P n` by two obligations: establish `P 0` and, assuming `P n` (the inductive hypothesis), derive `P (n + 1)`. This suffices whenever the `(n+1)`-case depends only on the immediately preceding case.

Strong (complete) induction strengthens the hypothesis: assume `∀ k < n, P k` and derive `P n`. This is necessary when the recursive structure of the proof requires more than the previous step — e.g., Fibonacci identities, primality arguments, or structural induction on recursive data types.

In Lean 4, `induction n with | zero => ... | succ n ih => ...` dispatches weak induction. `Nat.strong_induction_on` or `Nat.strongRecOn` are the primitives for strong induction. For structural induction on lists, trees, or inductive types, Lean's `induction` tactic automatically generates the right cases.

## When to Apply

- The goal is of the form `∀ n : ℕ, P n` where `P` involves arithmetic, combinatorial quantities, or recursive sequences.
- There is a visible ordering on the data (natural numbers, list length, tree depth) that decreases toward a base case.
- The problem statement itself contains the phrase "for all n" and the proof of the `n+1`-th case naturally uses the `n`-th.
- Strong induction: the recursion for the `n`-th term references terms earlier than `n-1` (e.g., `fib(n) = fib(n-1) + fib(n-2)`).

## Lean 4 Template

```lean
import Mathlib

-- Weak induction
theorem [THEOREM_NAME] (n : ℕ) : [P n] := by
  induction n with
  | zero   => [BASE_CASE_TACTIC]
  | succ n ih =>
    -- ih : [P n]
    [INDUCTIVE_STEP_TACTIC]

-- Strong induction
theorem [THEOREM_NAME]_strong (n : ℕ) : [P n] := by
  induction n using Nat.strong_induction_on with
  | _ n ih =>
    -- ih : ∀ m < n, [P m]
    [STRONG_INDUCTIVE_STEP]

-- Structural induction on a List
theorem [THEOREM_NAME]_list (l : List α) : [P l] := by
  induction l with
  | nil       => [BASE_CASE]
  | cons x xs ih =>
    -- ih : [P xs]
    [STEP_TACTIC]

-- Two-variable induction (lexicographic)
theorem [THEOREM_NAME]_2d (m n : ℕ) : [P m n] := by
  induction m with
  | zero   => induction n with
    | zero   => [BASE_BASE]
    | succ n ihn => [BASE_SUCC]
  | succ m ihm => [SUCC_CASE]
```

## Worked Example

Proving the closed form for Gauss's sum `∑ k ≤ n, k = n*(n+1)/2`:

```lean
import Mathlib

theorem gauss_sum (n : ℕ) : 2 * ∑ k ∈ Finset.range (n + 1), k = n * (n + 1) := by
  induction n with
  | zero   => simp
  | succ n ih =>
    rw [Finset.sum_range_succ]
    ring_nf
    linarith
```

## DAG Node Config Template

```json
{
  "id": "apply_mathematical_induction",
  "kind": "skill_apply",
  "label": "Prove universal property by induction on n",
  "dependsOn": ["[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/mathematical_induction/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Lean 4 tactic `induction`, `Nat.strong_induction_on` — https://leanprover.github.io/lean4/doc/tactics.html
- Mathlib4: `Mathlib.Data.Nat.Basic`, `Mathlib.Algebra.BigOperators.Basic`.
- Knuth, Donald E. *The Art of Computer Programming*, Vol. 1: Fundamental Algorithms (induction as proof technique).
