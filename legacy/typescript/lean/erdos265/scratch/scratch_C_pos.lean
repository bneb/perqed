import Mathlib

open Filter Topology Metric Set Finset

noncomputable def R₁_sc (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ) : ℝ :=
  (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) *
    (↑p / ↑q - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ))

noncomputable def R_shift_sc (a : ℕ → ℕ) (p₂ : ℤ) (q₂ : ℕ) (N : ℕ) : ℝ :=
  (q₂ : ℝ) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) *
    (↑p₂ / ↑q₂ - ∑ i ∈ Finset.range N, (1 : ℝ) / ((a i : ℝ) - 1))

noncomputable def C_val (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  (q₁ : ℝ) * (R_shift_sc a p₂ q₂ N) * (∏ i ∈ Finset.range N, (a i : ℝ)) -
  (q₂ : ℝ) * (R₁_sc a p₁ q₁ N) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1))

-- Assuming exact sums
lemma C_pos (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (ha : ∀ i, a i ≥ 2)
    (h_sum1 : HasSum (fun k => (1 : ℝ) / (a k : ℝ)) (↑p₁ / ↑q₁))
    (h_sum2 : HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) (↑p₂ / ↑q₂)) :
    C_val a p₁ p₂ q₁ q₂ N > 0 := by
  sorry

-- Assuming C_val is an integer
lemma C_ge_one (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (ha : ∀ i, a i ≥ 2)
    (h_sum1 : HasSum (fun k => (1 : ℝ) / (a k : ℝ)) (↑p₁ / ↑q₁))
    (h_sum2 : HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) (↑p₂ / ↑q₂))
    (h_int : ∃ (Z : ℤ), C_val a p₁ p₂ q₁ q₂ N = (Z : ℝ)) :
    C_val a p₁ p₂ q₁ q₂ N ≥ 1 := by
  sorry
