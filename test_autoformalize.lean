import Mathlib

theorem erdos_problem_265_rational_sums_sequence_exists :
  ∃ (a : ℕ → ℤ),
    (StrictMono a) ∧
    (∀ n, a n ≥ 2) ∧
    (Summable (fun n => (1 : ℝ) / (a n : ℝ))) ∧
    (IsRational (∑' n, (1 : ℝ) / (a n : ℝ))) ∧
    (Summable (fun n => (1 : ℝ) / ((a n - 1) : ℝ))) ∧
    (IsRational (∑' n, (1 : ℝ) / ((a n - 1) : ℝ))) := by sorry
