import Mathlib

theorem test_cast (a : ℕ → ℕ) (ha_pos : ∀ n, a n ≥ 2) :
  let x (n : ℕ) : ℕ := a n - 1
  (fun n => (1 : ℝ) / ((a n : ℝ) - 1)) = (fun n => (1 : ℝ) / (x n : ℝ)) := by
  intro x
  ext n
  dsimp [x]
  have h : 1 ≤ a n := by
    have := ha_pos n
    omega
  congr 1
  push_cast
  rw [Nat.cast_sub h]
  push_cast
  rfl
