import Mathlib

open Complex

lemma div_div_cancel_test (S Y : ℂ) (hS : S ≠ 0) (hY : Y ≠ 0) : (1 / S) / (Y / S) = 1 / Y := by
  calc
    (1 / S) / (Y / S) = (1 / S) * S / Y := by rw [div_div_eq_mul_div]
    _ = 1 / Y := by rw [div_mul_cancel 1 hS]

