import Mathlib

lemma test_linarith (b : ℕ) (h : 2 ≤ b) : (b : ℝ) - 1 ≠ 0 := by
  have h3 : (2 : ℝ) ≤ (b : ℝ) := by exact_mod_cast h
  linarith
