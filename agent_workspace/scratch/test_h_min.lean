import Mathlib

open Real

lemma h_min (x : ℝ) : x^2 - (5/4) * x + 13/16 ≥ 27/64 := by
  have h_eq : x^2 - (5/4) * x + 13/16 = (x - 5/8)^2 + 27/64 := by ring
  rw [h_eq]
  have h_sq : 0 ≤ (x - 5/8)^2 := sq_nonneg (x - 5/8)
  linarith
