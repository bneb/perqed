import Mathlib

open Finset

-- Self-contained definitions
noncomputable def R₁_sc (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ) : ℝ :=
  (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) *
    (↑p / ↑q - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ))

-- P_1(N) prefix sum is an integer
lemma prefix_sum_int (a : ℕ → ℕ) (N : ℕ) (h_pos : ∀ i, a i > 0) :
    ∃ (Z : ℤ), (∏ i ∈ Finset.range N, (a i : ℝ)) * (∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)) = (Z : ℝ) := by
  sorry

-- R1_sc is an integer
lemma R1_sc_is_int (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ) (hq : q > 0) (h_pos : ∀ i, a i > 0) :
    ∃ (Z : ℤ), R₁_sc a p q N = (Z : ℝ) := by
  have hq_pos : (q : ℝ) > 0 := by exact_mod_cast hq
  unfold R₁_sc
  rcases prefix_sum_int a N h_pos with ⟨Z_pref, h_pref⟩
  have h1 : (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (↑p / ↑q) = ↑p * (∏ i ∈ Finset.range N, (a i : ℝ)) := by
    calc
      (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (↑p / ↑q) = 
        (q : ℝ) * (↑p / ↑q) * (∏ i ∈ Finset.range N, (a i : ℝ)) := by ring
      _ = ↑p * (∏ i ∈ Finset.range N, (a i : ℝ)) := by rw [mul_div_cancel₀ _ (ne_of_gt hq_pos)]
  
  have h2 : (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)) =
    (q : ℝ) * Z_pref := by
    calc
      (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)) =
        (q : ℝ) * ((∏ i ∈ Finset.range N, (a i : ℝ)) * (∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ))) := by ring
      _ = (q : ℝ) * Z_pref := by rw [h_pref]
      
  use p * (∏ i ∈ Finset.range N, (a i : ℤ)) - (q : ℤ) * Z_pref
  push_cast
  calc
    (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (↑p / ↑q - ∑ i ∈ Finset.range N, 1 / (a i : ℝ))
    _ = (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (↑p / ↑q) - (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (∑ i ∈ Finset.range N, 1 / (a i : ℝ)) := by ring
    _ = ↑p * (∏ i ∈ Finset.range N, (a i : ℝ)) - (q : ℝ) * ↑Z_pref := by rw [h1, h2]
