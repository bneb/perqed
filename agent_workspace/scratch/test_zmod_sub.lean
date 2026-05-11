import Mathlib

lemma b_mod_four_step (b : ℕ) (h : (b : ZMod 4) = 3) : ((b * b - b + 1 : ℕ) : ZMod 4) = 3 := by
  have h_ge : b ≤ b * b := Nat.le_mul_self b
  calc
    ((b * b - b + 1 : ℕ) : ZMod 4) = ((b * b - b : ℕ) : ZMod 4) + 1 := by push_cast; rfl
    _ = (b * b : ZMod 4) - (b : ZMod 4) + 1 := by rw [Nat.cast_sub h_ge]
    _ = (b : ZMod 4) * (b : ZMod 4) - (b : ZMod 4) + 1 := by push_cast; rfl
    _ = 3 * 3 - 3 + 1 := by rw [h]
    _ = 3 := by rfl
