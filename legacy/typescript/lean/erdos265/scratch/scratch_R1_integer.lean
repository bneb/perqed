import Mathlib

open Filter Topology Metric Set Finset

noncomputable def tail_sum' (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  S - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)

noncomputable def R₁ (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (N : ℕ) : ℝ :=
  (q₁ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * tail_sum' a S N

-- If S = u1 / q1, then R1 is an integer
lemma R1_is_integer (a : ℕ → ℕ) (u₁ : ℤ) (q₁ : ℕ) (N : ℕ)
    (h_S : (u₁ : ℝ) / (q₁ : ℝ) = S) :
    ∃ (Z : ℤ), R₁ a S q₁ N = (Z : ℝ) := by
  sorry
