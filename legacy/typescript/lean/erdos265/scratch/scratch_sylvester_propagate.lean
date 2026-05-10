import Mathlib

open Filter Topology Metric Set Finset

noncomputable def tail_sum' (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  S - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)

noncomputable def waste' (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  (a N : ℝ) * tail_sum' a S N

noncomputable def R₁ (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (N : ℕ) : ℝ :=
  (q₁ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * tail_sum' a S N

theorem R1_from_waste (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (k : ℕ)
    (ha : (a k : ℝ) ≠ 0) :
    R₁ a S q₁ (k + 1) =
      (waste' a S k - 1) * ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) := sorry

lemma R1_constant_propagate (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (k : ℕ)
    (ha_pos : ∀ i, (a i : ℝ) > 0)
    (h_eq : R₁ a S q₁ (k + 1) = R₁ a S q₁ k) :
    R₁ a S q₁ (k + 2) = R₁ a S q₁ (k + 1) ↔ (a (k + 1) : ℝ) = (a k : ℝ) * ((a k : ℝ) - 1) + 1 := by
  sorry
