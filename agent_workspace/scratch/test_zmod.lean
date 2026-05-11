import Mathlib

lemma b_mod_four_step (b : ZMod 4) (h : b = 3) : b * b - b + 1 = 3 := by
  rw [h]
  rfl
