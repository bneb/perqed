import Mathlib

example (N p₁ n₁_real n₂_real : ℝ) (n₁ n₂ : ℤ) (hN2_pos : N^2 > 0) :
    p₁ * N ^ 2 + (n₁ : ℝ) + (n₂ : ℝ) / 4 = 
    ((n₁ : ℝ) - n₁_real) + ((n₂ : ℝ) - n₂_real) / 4 →
    p₁ + (n₁ : ℝ) / N ^ 2 + (n₂ : ℝ) / (4 * N ^ 2) = 
    (((n₁ : ℝ) - n₁_real) + ((n₂ : ℝ) - n₂_real) / 4) / N ^ 2 := by
  intro key
  have hN2ne : N ^ 2 ≠ 0 := ne_of_gt hN2_pos
  calc p₁ + (n₁ : ℝ) / N ^ 2 + (n₂ : ℝ) / (4 * N ^ 2)
    _ = p₁ * (N ^ 2 / N ^ 2) + (n₁ : ℝ) / N ^ 2 + (n₂ : ℝ) / (4 * N ^ 2) := by rw [div_self hN2ne, mul_one]
    _ = (p₁ * N ^ 2) / N ^ 2 + (n₁ : ℝ) / N ^ 2 + ((n₂ : ℝ) / 4) / N ^ 2 := by ring
    _ = (p₁ * N ^ 2 + (n₁ : ℝ) + (n₂ : ℝ) / 4) / N ^ 2 := by ring
    _ = (((n₁ : ℝ) - n₁_real) + ((n₂ : ℝ) - n₂_real) / 4) / N ^ 2 := by rw [key]
