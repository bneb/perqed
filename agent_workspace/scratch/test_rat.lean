import Mathlib

lemma test_rat (q : ℚ) : (q : ℝ) * (q.den : ℝ) = (q.num : ℝ) := by
  exact_mod_cast q.mul_den_eq_num
