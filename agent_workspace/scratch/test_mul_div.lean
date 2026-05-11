import Mathlib

lemma test_mul_div {a b : ℚ} (ha : a ≠ 0) : (a * b) / a = b := by
  exact mul_div_cancel₀ b ha

lemma test_mul_div2 {a b : ℚ} (hb : b ≠ 0) : (a * b) / b = a := by
  exact mul_div_cancel_right₀ a hb
