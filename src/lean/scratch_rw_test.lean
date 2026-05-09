import Mathlib

lemma rw_test (R : ℕ → ℝ) (N : ℕ) (h1 : R (N + 1) = R N) (h2 : R (N + 2) = R (N + 1)) :
  R (N + 1) - R (N + 2) = R N - R N := by
  rw [h1, h2, h1]
