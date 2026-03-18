---
name: extremal_principle_infinite_descent
description: Find the minimal or maximal element of a non-empty well-ordered subset and derive a contradiction from the assumption that such an element has a predecessor, or use infinite descent to show no minimal counterexample can exist.
---

# Extremal Principle / Infinite Descent

## Technique

The extremal principle selects the extreme (minimum or maximum) element of a non-empty set and exploits properties that only extremal elements must have. Infinite descent, Fermat's version, assumes the smallest counterexample exists and constructs an even smaller one — an impossibility in the natural numbers, completing the proof by contradiction.

Both techniques rely fundamentally on well-ordering: the naturals are well-ordered, so any non-empty subset has a minimum. On `ℕ`, this means any descending sequence must terminate. The technique appears in: Euclidean algorithm termination, Fermat's proof that `x⁴ + y⁴ = z²` has no positive integer solutions, and the proof that `√2` is irrational.

In Lean 4, `Nat.find` returns the minimum witness satisfying a decidable predicate. `Nat.find_spec` gives proof that the minimum satisfies the property. `WellFoundedRelation` provides the general machinery for well-founded recursion and descent arguments.

## When to Apply

- The goal involves natural numbers and a property that "the smallest counterexample" would contradict.
- A sequence or recursion terminates by a decreasing measure (natural number, lexicographic pair).
- An infinite descent argument: assume the smallest n with ¬P(n) exists; derive a smaller one.
- The problem is a Diophantine impossibility: no solution in positive integers.
- The ARCHITECT's context shows a recursion that needs a termination certificate (`termination_by`).

## Lean 4 Template

```lean
import Mathlib

-- Infinite descent via well-founded induction
theorem [THEOREM_NAME] : ∀ n : ℕ, [P n] := by
  intro n
  -- Assume by contradiction the set of counterexamples is non-empty
  by_contra h
  push_neg at h
  -- Take the minimum counterexample
  set m := Nat.find ⟨n, h⟩ with hm_def
  have hm_prop : ¬ [P m] := Nat.find_spec ⟨n, h⟩
  have hm_min : ∀ k < m, [P k] := fun k hk => by
    by_contra hk_neg
    exact absurd hk (Nat.find_min ⟨n, h⟩ hk)
  -- Now derive a smaller counterexample — contradiction with minimality
  [CONSTRUCT_SMALLER_COUNTEREXAMPLE]

-- Extremal element argument on a Finset
theorem extremal_finset {α : Type*} [LinearOrder α] (s : Finset α) (hs : s.Nonempty) :
    ∃ m ∈ s, ∀ x ∈ s, m ≤ x :=
  ⟨s.min' hs, Finset.min'_mem s hs, fun x hx => Finset.min'_le s x hx⟩

-- Well-founded recursion with explicit termination measure
def [RECURSIVE_FN] (n : ℕ) : [RETURN_TYPE] :=
  if h : [BASE_CONDITION n] then [BASE_CASE]
  else [RECURSIVE_CALL (SMALLER_N n)]
  termination_by n
```

## Worked Example

The GCD terminates by infinite descent on the remainder:

```lean
import Mathlib

-- Euclid's algorithm terminates because Nat.mod is strictly decreasing
-- Lean's well-founded recursion handles this automatically:
#eval Nat.gcd 48 18  -- = 6

-- Fermat's infinite descent sketch: no Pythagorean triple with z² = x⁴ + y⁴
theorem no_pythagorean_fourth_powers :
    ∀ x y z : ℕ, 0 < x → 0 < y → 0 < z → x ^ 4 + y ^ 4 ≠ z ^ 2 := by
  sorry -- requires descent on z; classical proof by Fermat
```

## DAG Node Config Template

```json
{
  "id": "apply_extremal_principle",
  "kind": "skill_apply",
  "label": "Take minimum counterexample and derive contradiction via infinite descent",
  "dependsOn": ["[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/extremal_principle_infinite_descent/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Mathlib4: `Mathlib.Data.Nat.Find`, `Mathlib.Order.WellFounded`, `Mathlib.Data.Finset.Lattice`.
- Fermat, Pierre de. On infinite descent (letters to Mersenne, 1640s).
- Hardy & Wright. *An Introduction to the Theory of Numbers*, Ch. 13 (Fermat's Last Theorem, n=4).
