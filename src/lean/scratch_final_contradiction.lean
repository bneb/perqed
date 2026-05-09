import Mathlib
import erdos265.erdos265_strict_target
import erdos265.beta2_boundary

open Finset Filter Topology

theorem no_fast_growing_erdos265 (a : ℕ → ℕ)
    (h_pos : ∀ n, a n ≥ 2)
    (h_mono : StrictMono a)
    (h_fast : FastGrowth a)
    (h_erdos : Erdos265_Sequence a) :
    False := by
  rcases h_erdos with ⟨⟨r₁, h_sum1⟩, ⟨r₂, h_sum2⟩⟩
  -- r₁ is a rational p/q
  let p : ℤ := r₁.num
  let q : ℕ := r₁.den
  have hq : q > 0 := r₁.pos
  have h_sum1_pq : HasSum (fun n => 1 / (a n : ℝ)) (p / q) := by
    have : (r₁ : ℝ) = (p / q : ℝ) := by
      push_cast
      exact Rat.cast_def r₁
    rw [← this]
    exact h_sum1
  
  have h_sylv := eventually_sylvester a p q h_pos h_fast h_sum1_pq hq
  have h_irrational := shifted_sum_irrational_of_eventually_sylvester a h_pos h_sylv
  
  -- But we have h_sum2 which says it is rational
  have h_rat : ∃ (r : ℚ), HasSum (fun n => 1 / ((a n : ℝ) - 1)) (↑r) := ⟨r₂, h_sum2⟩
  exact h_irrational h_rat
