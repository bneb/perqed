import Mathlib

open Complex

def b : ℕ → ℕ
  | 0 => 2
  | n + 1 => b n * b n - b n + 1

def phi (w : ℂ) : ℂ :=
  w^2 / (1 - w + w^2)

lemma phi_orbit (k : ℕ) : phi (1 / (b k : ℂ)) = 1 / (b (k + 1) : ℂ) := by
  dsimp [phi]
  have h_eq : (b (k + 1) : ℂ) = (b k : ℂ) * (b k : ℂ) - (b k : ℂ) + 1 := by
    have h_ge : b k ≤ b k * b k := Nat.le_mul_self (b k)
    calc
      (b (k + 1) : ℂ) = ↑(b k * b k - b k + 1) := by rfl
      _ = ↑(b k * b k - b k) + 1 := by push_cast; rfl
      _ = ↑(b k * b k) - ↑(b k) + 1 := by rw [Nat.cast_sub h_ge]
      _ = (b k : ℂ) * (b k : ℂ) - (b k : ℂ) + 1 := by push_cast; rfl
  rw [h_eq]
  have hb : (b k : ℂ) ≠ 0 := by sorry
  have h_num : (1 / (b k : ℂ))^2 = 1 / ((b k : ℂ) * (b k : ℂ)) := by ring
  rw [h_num]
  sorry

