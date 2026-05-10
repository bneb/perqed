import Mathlib

example (N M : ℝ) (hMN : M ^ 2 ≤ N) (hN_pos : N > 0) :
    98 * M ^ 2 / (8 * N ^ 3) ≤ 98 * N / (8 * N ^ 3) := by
  have h_8N3_pos : (0 : ℝ) ≤ 8 * N ^ 3 := by
    have h_N3_pos : (0 : ℝ) ≤ N ^ 3 := pow_nonneg (by linarith) 3
    linarith
  apply div_le_div_of_nonneg_right
  · exact mul_le_mul_of_nonneg_left hMN (by norm_num)
  · exact h_8N3_pos
