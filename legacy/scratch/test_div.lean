import Mathlib

example (N M n₂ : ℝ) (hn₂_sq : n₂ ^ 2 ≤ 49 * M ^ 2) (hN_pos : N > 0) :
    2 * n₂ ^ 2 / (2 * N) ^ 3 ≤ 2 * (49 * M ^ 2) / (2 * N) ^ 3 := by
  have h_2N_pos : (0 : ℝ) ≤ 2 * N := by linarith
  have h_2N3_pos : (0 : ℝ) ≤ (2 * N) ^ 3 := pow_nonneg h_2N_pos 3
  apply div_le_div_of_nonneg_right
  · exact mul_le_mul_of_nonneg_left hn₂_sq (by norm_num)
  · exact h_2N3_pos
