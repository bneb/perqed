---
name: compactness_arguments
description: Exploit the compactness of a topological space (every open cover has a finite subcover) to pass from local properties to global conclusions, or use sequential compactness to extract convergent subsequences.
---

# Compactness Arguments

## Technique

Compactness is one of the most powerful tools in analysis and topology. A set `K` is compact if every open cover has a finite subcover. Equivalent characterizations (in metric spaces): every sequence in `K` has a convergent subsequence (sequential compactness); `K` is complete and totally bounded (in metric spaces). Compact sets in ℝⁿ are exactly the closed and bounded sets (Heine-Borel).

The typical proof pattern: show that a function or set of objects satisfies properties locally (near each point), then invoke compactness to extract a finite cover that makes the argument global. Alternatively, extract a convergent subsequence from a bounded sequence to find a limit with desired properties.

In logic and model theory, the Compactness Theorem states: if every finite subset of a sentence set is satisfiable, the whole set is satisfiable. This is used to prove Upward Löwenheim-Skolem and to construct non-standard models.

## When to Apply

- The goal requires extracting a limit or convergent subsequence from an infinite bounded family.
- A local property (defined using open sets) needs to be made global.
- Uniform continuity: a continuous function on a compact set is uniformly continuous.
- The maximum of a continuous function is attained on a compact domain.
- The ARCHITECT's context shows a sequence bounded in norm — invoke Bolzano-Weierstrass.
- Logical compactness: a theory is consistent because every finite subtheory is.

## Lean 4 Template

```lean
import Mathlib

-- Compact sets: every sequence has a convergent subsequence
theorem compact_seq_convergence {α : Type*} [TopologicalSpace α]
    (K : Set α) (hK : IsCompact K) (x : ℕ → α) (hx : ∀ n, x n ∈ K) :
    ∃ (φ : ℕ → ℕ), StrictMono φ ∧ ∃ a ∈ K, Filter.Tendsto (x ∘ φ) Filter.atTop (nhds a) :=
  hK.isSeqCompact hx

-- Extreme value theorem: max attained on compact
theorem extreme_value {α : Type*} [TopologicalSpace α]
    (K : Set α) (hK : IsCompact K) (hKne : K.Nonempty)
    (f : α → ℝ) (hf : ContinuousOn f K) :
    ∃ x ∈ K, ∀ y ∈ K, f y ≤ f x :=
  hK.exists_isMaxOn hKne hf

-- Uniform continuity on compact (Heine-Cantor)
theorem heine_cantor {α β : Type*} [UniformSpace α] [UniformSpace β]
    (K : Set α) (hK : IsCompact K) (f : α → β) (hf : ContinuousOn f K) :
    UniformContinuousOn f K :=
  hK.uniformContinuousOn hf

-- Bolzano-Weierstrass: bounded sequence in ℝ has convergent subsequence
theorem bolzano_weierstrass (x : ℕ → ℝ) (M : ℝ) (hM : ∀ n, |x n| ≤ M) :
    ∃ (φ : ℕ → ℕ), StrictMono φ ∧ ∃ a, Filter.Tendsto (x ∘ φ) Filter.atTop (nhds a) := by
  have hbdd : Bornology.IsBounded (Set.range x) := by
    rw [Real.isBounded_iff_forall_abs_le]; exact ⟨M, fun y ⟨n, hn⟩ => hn ▸ hM n⟩
  exact isCompact_of_isBounded_isClosed hbdd.closure isClosed_closure |>.isSeqCompact
    (fun n => Set.mem_closure_range x n)
```

## Worked Example

Maximum attained for a continuous function on `[0, 1]`:

```lean
import Mathlib

theorem max_on_unit_interval (f : ℝ → ℝ) (hf : Continuous f) :
    ∃ x ∈ Set.Icc (0 : ℝ) 1, ∀ y ∈ Set.Icc (0 : ℝ) 1, f y ≤ f x :=
  (isCompact_Icc.exists_isMaxOn ⟨0, by norm_num⟩ (hf.continuousOn.mono (Set.subset_univ _)))
```

## DAG Node Config Template

```json
{
  "id": "apply_compactness",
  "kind": "skill_apply",
  "label": "Extract convergent subsequence or finite subcover via compactness",
  "dependsOn": ["[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/compactness_arguments/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Mathlib4: `Mathlib.Topology.Compactness.Compact`, `Mathlib.Analysis.SpecificLimits.Basic`.
- Rudin, Walter. *Principles of Mathematical Analysis*, Ch. 2–4 (compact sets, Heine-Borel).
- Enderton, Herbert. *A Mathematical Introduction to Logic*, Ch. 2 (logical compactness theorem).
