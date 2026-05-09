import Mathlib
import erdos265.beta2_boundary

open Finset

theorem R₁_recurrence_proof (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i > 0) :
    R₁ a p q (N + 1) =
      (a N : ℝ) * R₁ a p q N - (q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) := by
  unfold R₁
  rw [prod_range_succ, sum_range_succ]
  have haN : (a N : ℝ) ≠ 0 := by
    have := h_pos N
    norm_cast
    omega
  calc
    (q : ℝ) * ((∏ x ∈ Finset.range N, (a x : ℝ)) * (a N : ℝ)) *
        (↑p / ↑q - (∑ x ∈ Finset.range N, 1 / (a x : ℝ) + 1 / (a N : ℝ)))
    _ = (a N : ℝ) * ((q : ℝ) * (∏ x ∈ Finset.range N, (a x : ℝ)) * (↑p / ↑q - ∑ x ∈ Finset.range N, 1 / (a x : ℝ)))
        - (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * ((a N : ℝ) * (1 / (a N : ℝ))) := by ring
    _ = (a N : ℝ) * ((q : ℝ) * (∏ x ∈ Finset.range N, (a x : ℝ)) * (↑p / ↑q - ∑ x ∈ Finset.range N, 1 / (a x : ℝ)))
        - (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * 1 := by rw [mul_one_div_cancel haN]
    _ = (a N : ℝ) * ((q : ℝ) * (∏ x ∈ Finset.range N, (a x : ℝ)) * (↑p / ↑q - ∑ x ∈ Finset.range N, 1 / (a x : ℝ)))
        - (q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) := by ring
