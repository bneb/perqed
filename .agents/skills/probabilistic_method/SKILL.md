---
name: probabilistic_method
description: Prove the existence of a combinatorial object with a desired property by showing that a randomly chosen object satisfies the property with positive probability, without exhibiting the object explicitly.
---

# The Probabilistic Method

## Technique

The probabilistic method, pioneered by Erdős, establishes existence proofs by defining a probability space over the class of candidate objects and showing that the probability of the desired property is strictly positive. Since `P(E) > 0` implies the event `E` is non-empty, some object in the sample space must satisfy the property.

The key computational step is calculating `E[X]` for some random variable `X` counting "bad" events. If `E[X] < 1`, then `P(X = 0) > 0` by Markov's inequality, so some configuration avoids all bad events. Lovász Local Lemma (LLL) extends this to dependencies: if each bad event is unlikely and depends on few others, simultaneously avoiding all events is possible.

In the Ramsey context: a random 2-coloring of K_n edges satisfies `E[monochromatic cliques of size k] < 1` for small k, proving `R(k,k) > n`. This is the foundational probabilistic lower bound for diagonal Ramsey numbers.

## When to Apply

- The goal is an existence statement and no explicit construction is known.
- A counting argument gives `E[X] < 1` for some "bad event" count `X`.
- The Lovász Local Lemma applies: bad events are individually rare and have limited dependence.
- The problem is a Ramsey-type lower bound — random constructions often give better bounds than explicit ones.
- The ARCHITECT's journal shows repeated SA failures at high energy — the probabilistic argument explains *why* a witness exists even if search is slow.

## Lean 4 Template

```lean
import Mathlib

open MeasureTheory ProbabilityTheory

-- Pattern: show E[X] < 1, conclude P(X = 0) > 0, hence ∃ configuration with X = 0
theorem probabilistic_existence {Ω : Type*} [MeasurableSpace Ω]
    (μ : Measure Ω) [IsProbabilityMeasure μ]
    (X : Ω → ℕ) (hX : Measurable X) (hE : ∫ ω, (X ω : ℝ) ∂μ < 1) :
    0 < μ {ω | X ω = 0} := by
  by_contra h
  push_neg at h
  have hzero : μ {ω | X ω = 0} = 0 := le_antisymm (not_lt.mp h) (by positivity)
  have : 1 ≤ ∫ ω, (X ω : ℝ) ∂μ := by
    [LOWER_BOUND_CALCULATION using hzero]
  linarith

-- Ramsey lower bound via probabilistic method
-- P(∃ monochromatic K_k in random 2-coloring of K_n) < 1
-- ⟹ ∃ coloring with no monochromatic K_k
-- ⟹ R(k,k) > n
theorem ramsey_lower_bound_probabilistic (k n : ℕ) (hkn : [BOUND_CONDITION k n]) :
    ∃ col : Fin n → Fin n → Bool,
      (∀ i j, col i j = col j i) ∧
      [NO_MONOCHROMATIC_CLIQUE col k] := by
  -- Use: E[# monochromatic K_k] = C(n,k) * 2^(1 - C(k,2)) < 1
  sorry

-- Lovász Local Lemma (mathlib4 formulation)
#check ProbabilityTheory.iIndepFun
```

## Worked Example

The probabilistic lower bound `R(3,3) > 5`: random 2-colorings of K₅:

```lean
import Mathlib

-- R(3,3) = 6, so we need to show a 2-coloring of K₅ with no monochromatic triangle
-- By explicit construction (or checking) — the probabilistic argument:
-- E[# mono triangles in random coloring] = C(5,3) * 2 / 2^3 = 10/4 = 2.5
-- This doesn't immediately give < 1, so we need the actual coloring (R(3,3)=6 is tight)
-- The probabilistic method gives: R(k,k) > 2^(k/2) via:
example : (2 : ℝ) ^ ((3 : ℝ) / 2) < 6 := by norm_num
```

## DAG Node Config Template

```json
{
  "id": "apply_probabilistic_method",
  "kind": "skill_apply",
  "label": "Show E[bad events] < 1 to prove a good configuration exists",
  "dependsOn": ["literature"],
  "config": {
    "skillPath": ".agents/skills/probabilistic_method/SKILL.md",
    "inputFromNode": "literature"
  }
}
```

## Key References

- Alon & Spencer. *The Probabilistic Method*, 4th ed. Wiley, 2016.
- Erdős, Rényi. "On Random Graphs I." *Publicationes Mathematicae*, 1959.
- Mathlib4: `Mathlib.Probability.ProbabilityMassFunction.Basic`, `Mathlib.MeasureTheory.Integral.Average`.
