---
name: polynomial_time_reductions
description: Prove computational hardness or equivalence by constructing an efficient (polynomial-time) reduction from a known-hard problem to the target problem, establishing NP-hardness or NP-completeness.
---

# Polynomial-Time Reductions

## Technique

A polynomial-time reduction from problem A to problem B (written A ≤_P B) transforms each instance x of A into an instance R(x) of B such that: (1) R is computable in polynomial time, and (2) x is a YES-instance of A if and only if R(x) is a YES-instance of B. If A is NP-hard and A ≤_P B, then B is NP-hard.

The art of reductions is designing R to preserve the YES/NO structure faithfully. Common patterns: Cook-Levin style (reduce SAT → target), gadget reductions (embed subproblem as a local structure), and Karp reductions (decision problem to decision problem).

While Lean 4's `mathlib4` does not yet have a comprehensive complexity theory library, reductions can be formalized via `Computable` functions, `Polynomial` time functions over `Encoding`, or informally stated via `sorry` with the structural argument in comments for the ARCHITECT to use as a guide.

## When to Apply

- The goal is to prove a problem is NP-hard or NP-complete.
- Two computational problems are claimed equivalent in computational complexity.
- The SAT witness returned by Z3 needs to be validated as an efficient certificate.
- A Ramsey lower bound is reformulated as a combinatorial constraint-satisfaction problem for which NP-hardness implies no polynomial algorithm exists.
- The ARCHITECT should use this to explain *why* the search is necessarily hard (exponential lower bound argument).

## Lean 4 Template

```lean
import Mathlib

-- Minimal formalization of a decision problem reduction
-- (Full complexity theory in Lean 4 is an active research area)

-- We model a decision problem as a predicate on encoded strings
def SAT : List Bool → Prop := fun formula => ∃ assignment, [EVALUATE formula assignment]

def [TARGET_PROB] : List Bool → Prop := fun instance => [DECISION PROPERTY instance]

-- The reduction function (computable transformation)
def reduction : List Bool → List Bool := fun x => [GADGET_ENCODING x]

-- Correctness: x is a YES-instance iff reduction(x) is a YES-instance
theorem reduction_correctness (x : List Bool) :
    SAT x ↔ [TARGET_PROB] (reduction x) := by
  constructor
  · intro ⟨assignment, hsat⟩
    [FORWARD_DIRECTION]
  · intro htarget
    [BACKWARD_DIRECTION]

-- In practice: use sorry + comment for NP-hardness arguments
theorem [PROBLEM]_is_NP_hard : [NP_HARD_STATEMENT] := by
  -- Reduce from 3-SAT via the following gadget construction:
  -- [GADGET DESCRIPTION]
  -- Forward: each satisfying assignment induces a valid [TARGET] certificate.
  -- Backward: each [TARGET] solution can be decoded to a SAT assignment.
  sorry
```

## Worked Example

Reduction from 3-colorability to Clique (structural sketch):

```lean
import Mathlib

-- A graph is 3-colorable iff its complement has no 4-clique: FALSE in general,
-- but here we sketch the structural reduction pattern.
def threeColorable (G : SimpleGraph V) : Prop :=
  ∃ col : V → Fin 3, ∀ v w, G.Adj v w → col v ≠ col w

-- Reduction target: clique of size k exists
def hasClique (G : SimpleGraph V) (k : ℕ) : Prop :=
  ∃ s : Finset V, s.card = k ∧ G.IsClique s

-- The reduction theorem would state: threeColorable G ↔ hasClique (complement G) 4
-- In practice, this is not true as stated — the actual reduction is more subtle.
-- The template shows the structural form the ARCHITECT should fill.
theorem reduction_sketch (G : SimpleGraph V) :
    threeColorable G → ¬ hasClique Gᶜ 4 := by
  sorry
```

## DAG Node Config Template

```json
{
  "id": "apply_polynomial_reduction",
  "kind": "skill_apply",
  "label": "Establish NP-hardness via polynomial-time reduction from 3-SAT",
  "dependsOn": ["[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/polynomial_time_reductions/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Cook, Stephen A. "The Complexity of Theorem-Proving Procedures." *STOC*, 1971.
- Sipser, Michael. *Introduction to the Theory of Computation*, 3rd ed. Cengage, 2012 (Ch. 7).
- Mathlib4: `Mathlib.Computability.Encoding`, `Mathlib.Computability.TuringMachine`.
