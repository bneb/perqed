import Mathlib

lemma r_decay_real (r_n r_n1 D_n b_n b_n1 gcd : ℝ)
  (h1 : r_n = D_n / b_n)
  (h2 : r_n1 = D_n * (b_n + 1) / gcd / b_n1)
  (h3 : 4 ≤ gcd)
  (h4 : b_n1 = b_n * b_n - b_n + 1)
  (h5 : 43 ≤ b_n)
  (h6 : 0 < D_n) : r_n1 < r_n / 3 := by
  -- We know gcd >= 4. Since D_n * (b_n + 1) / gcd is monotonically decreasing with gcd, we can bound it.
  have h_b_pos : 0 < b_n := by linarith
  have h_b1_pos : 0 < b_n1 := by nlinarith
  have h_gcd_pos : 0 < gcd := by linarith
  have h7 : D_n * (b_n + 1) / gcd ≤ D_n * (b_n + 1) / 4 := by
    apply div_le_div_of_nonneg_left
    · positivity
    · norm_num
    · exact h3
  have h8 : r_n1 ≤ D_n * (b_n + 1) / 4 / b_n1 := by
    calc
      r_n1 = (D_n * (b_n + 1) / gcd) / b_n1 := by exact h2
      _ ≤ (D_n * (b_n + 1) / 4) / b_n1 := by
        exact div_le_div_of_nonneg_right h7 (by linarith)
  have h9 : (D_n * (b_n + 1) / 4) / b_n1 < (D_n / b_n) / 3 := by
    rw [h4]
    -- cross multiply
    sorry
  sorry
