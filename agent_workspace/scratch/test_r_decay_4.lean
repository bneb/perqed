import Mathlib

lemma r_decay_real (r_n r_n1 D_n b_n b_n1 gcd : ℝ)
  (h1 : r_n = D_n / b_n)
  (h2 : r_n1 = D_n * (b_n + 1) / gcd / b_n1)
  (h3 : 4 ≤ gcd)
  (h4 : b_n1 = b_n * b_n - b_n + 1)
  (h5 : 43 ≤ b_n)
  (h6 : 0 < D_n) : r_n1 < r_n / 3 := by
  have h_b_pos : 0 < b_n := by linarith
  have h_b1_pos : 0 < b_n1 := by nlinarith
  have h_gcd_pos : 0 < gcd := by linarith
  
  -- We want to prove r_n1 < r_n / 3
  -- Which is D_n * (b_n + 1) / (gcd * b_n1) < D_n / (3 * b_n)
  -- Since all are positive, this is equivalent to:
  -- 3 * b_n * (b_n + 1) < gcd * b_n1
  
  -- We know gcd >= 4. So 4 * b_n1 <= gcd * b_n1
  -- We just need 3 * b_n * (b_n + 1) < 4 * b_n1
  
  have h_ineq : 3 * b_n * (b_n + 1) < 4 * b_n1 := by
    calc
      3 * b_n * (b_n + 1) = 3 * b_n * b_n + 3 * b_n := by ring
      _ < 4 * (b_n * b_n - b_n + 1) := by nlinarith
      _ = 4 * b_n1 := by rw [h4]
      
  -- Now we just need to stitch it together with division
  sorry
