import Mathlib

lemma mod_test (x : ℕ) (h : x % 4 = 3) : (x + 1) % 4 = 0 := by
  omega
