---
name: epsilon_delta_bounding
description: Prove analytical limits, continuity, and convergence by bounding |f(x) - L| < ε using explicit δ or N witnesses constructed from ε.
---

# Epsilon-Delta Bounding

## Technique

The epsilon-delta method formalizes the intuitive notion of "closeness" in analysis. To prove `lim_{x→a} f(x) = L`, one must exhibit a function `δ(ε) > 0` such that `0 < |x - a| < δ → |f(x) - L| < ε`. The same structure applies to sequences (`|a_n - L| < ε` for all `n ≥ N(ε)`), uniform continuity, and metric space convergence.

The key craft is algebraic: expand `|f(x) - L|` and bound each term using triangle inequality, known bounds on `|x - a|`, and algebraic identities. Ultimately every ε-δ proof reduces to choosing the right `δ` as a function of `ε` and verifying the algebra closes.

In Lean 4 / mathlib4, limits are phrased via `Filter.Tendsto` and `Metric.tendsto_atTop`. The `norm_num`, `positivity`, and `linarith` tactics close arithmetic bounds. `gcongr` propagates monotone inequalities.

## When to Apply

- The goal involves `Continuous f`, `Filter.Tendsto`, `CauchySeq`, or metric convergence.
- The proof requires making a function "close to" a limit by constraining the input.
- A uniform continuity or Lipschitz bound is needed for a subsequent `IsCompact` argument.
- The ARCHITECT's context shows a goal with `‖f x - L‖ < ε` or `dist (f n) L < ε` as the core obligation.
- An intermediate lemma needs: "for sufficiently large n, the sequence stays within a band."

## Lean 4 Template

```lean
import Mathlib

-- Sequential convergence (N-ε style)
theorem [SEQ_THEOREM] (a : ℕ → ℝ) (L : ℝ) : Filter.Tendsto a Filter.atTop (nhds L) := by
  rw [Metric.tendsto_atTop]
  intro ε hε
  -- Exhibit N as a function of ε
  refine ⟨[N_FORMULA ε], fun n hn => ?_⟩
  simp only [Real.dist_eq]
  [BOUND_CALCULATION]
  linarith

-- Continuity at a point (δ-ε style)
theorem [CONT_THEOREM] (f : ℝ → ℝ) (a : ℝ) : ContinuousAt f a := by
  rw [Metric.continuousAt_iff]
  intro ε hε
  refine ⟨[DELTA_FORMULA ε], by positivity, fun x hx => ?_⟩
  simp only [Real.dist_eq] at *
  [BOUND_CALCULATION]
  linarith

-- Uniform continuity
theorem [UNIF_CONT_THEOREM] (f : ℝ → ℝ) : UniformContinuous f := by
  rw [Metric.uniformContinuous_iff]
  intro ε hε
  exact ⟨[DELTA], by positivity, fun x y hxy => by
    simp only [Real.dist_eq] at *
    [UNIFORM_BOUND]; linarith⟩
```

## Worked Example

Proving the constant sequence converges:

```lean
import Mathlib

theorem const_seq_converges (c : ℝ) :
    Filter.Tendsto (fun _ : ℕ => c) Filter.atTop (nhds c) := by
  rw [Metric.tendsto_atTop]
  intro ε hε
  exact ⟨0, fun n _ => by simp [Real.dist_eq, hε]⟩
```

## DAG Node Config Template

```json
{
  "id": "apply_epsilon_delta_bounding",
  "kind": "skill_apply",
  "label": "Bound ‖f(x) - L‖ < ε by constructing explicit δ(ε)",
  "dependsOn": ["[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/epsilon_delta_bounding/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Mathlib4: `Mathlib.Topology.MetricSpace.Basic`, `Mathlib.Analysis.SpecificLimits.Basic`.
- Rudin, Walter. *Principles of Mathematical Analysis*, 3rd ed. McGraw-Hill, 1976 (Ch. 4–7).
- Lean tactic `gcongr` for monotone inequality propagation.
