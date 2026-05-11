import Mathlib

lemma test_div (A B C : ℝ) (hC : C ≠ 0) (h : A * C = B) : A = B / C := by
  rw [eq_div_iff hC]
  exact h
