import Mathlib.Data.Real.Basic
import Mathlib.Analysis.SpecificLimits.Basic
import Mathlib.Order.Monotone.Basic

open Nat BigOperators

theorem erdos_265_rational_sums_sequence_exists :
  ∃ (a : ℕ → ℕ),
    StrictMono a ∧
    (∀ n, a n > 1) ∧
    (∃ q : ℚ, (q : ℝ) = ∑' (n : ℕ), 1 / (a (n+1) : ℝ)) := by sorry
