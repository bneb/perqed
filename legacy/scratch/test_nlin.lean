import Mathlib

example (x M : ℝ) (h : |x| ≤ 2 * M) : x ^ 2 ≤ 4 * M ^ 2 := by
  calc x ^ 2 = |x| ^ 2 := sq_abs x |>.symm
    _ ≤ (2 * M) ^ 2 := by
      have hM : 0 ≤ 2 * M := le_trans (abs_nonneg _) h
      gcongr
    _ = 4 * M ^ 2 := by ring
