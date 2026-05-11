import Mathlib

lemma test_norm_num : |(1/3 : ℝ)| < 1 := by
  rw [abs_lt]
  constructor
  · norm_num
  · norm_num
