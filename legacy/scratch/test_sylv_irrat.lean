import Mathlib

open Filter Topology Finset

axiom sylvester_collapse (a : ℕ → ℕ)
  (h_growth : ∀ n, a (n + 1) ≥ a n ^ 2 - a n + 1)
  (h_pos : ∀ n, a n ≥ 2)
  (q : ℚ) (h_sum : HasSum (fun n => (1 : ℝ) / (a n : ℝ)) (q : ℝ)) :
  ∃ N, ∀ n ≥ N, a (n + 1) = a n ^ 2 - a n + 1

set_option pp.all true

theorem sylvester_offset_irrational (a : ℕ → ℕ)
  (ha_pos : ∀ n, a n ≥ 2)
  (ha_sylv : ∀ n, a (n + 1) = a n ^ 2 - a n + 1) :
  ¬ ∃ q : ℚ, HasSum (fun n => (1 : ℝ) / ((a n : ℝ) - 1)) (q : ℝ) := by
  
  intro h_rat_sum
  rcases h_rat_sum with ⟨q, h_sum⟩
  let x (n : ℕ) : ℕ := a (n + 1) - 1

  have h_sum_x : HasSum (fun n => (1 : ℝ) / (x n : ℝ)) ((q : ℝ) - (1 : ℝ) / ((a 0 : ℝ) - 1)) := by
    have h_eq : (fun n => (1 : ℝ) / (x n : ℝ)) = fun n => (1 : ℝ) / ((a (n + 1) : ℝ) - 1) := by
      sorry
    rw [h_eq]
    have h_sum_add := (hasSum_nat_add_iff' 1).mpr h_sum
    sorry

  sorry
