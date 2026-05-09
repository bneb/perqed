import Mathlib
import erdos265.erdos265_strict_target
import erdos265.negative_resolution

open Filter Topology Metric Set Finset

theorem shifted_sum_irrational_of_eventually_sylvester (a : ℕ → ℕ)
    (h_pos : ∀ n, a n ≥ 2)
    (h_sylv : ∃ N₀, ∀ N ≥ N₀, a (N + 1) = (a N)^2 - a N + 1) :
    ¬ ∃ (r : ℚ), HasSum (fun n => 1 / ((a n : ℝ) - 1)) (↑r) := by
  rintro ⟨r, h_sum⟩
  rcases h_sylv with ⟨N₀, h_eq⟩
  
  -- Define the shifted sequence
  let b (n : ℕ) := a (n + N₀)
  
  have hb_pos : ∀ n, b n ≥ 2 := fun n => h_pos (n + N₀)
  have hb_sylv : ∀ n, b (n + 1) = (b n)^2 - b n + 1 := by
    intro n
    have hn_eq : n + 1 + N₀ = n + N₀ + 1 := by omega
    change a (n + 1 + N₀) = a (n + N₀)^2 - a (n + N₀) + 1
    rw [hn_eq]
    exact h_eq (n + N₀) (by omega)
    
  -- The tail sum of `a` is the infinite sum of `b`
  have h_tail_sum : HasSum (fun n => 1 / ((b n : ℝ) - 1)) (↑r - ∑ i ∈ Finset.range N₀, 1 / ((a i : ℝ) - 1)) := by
    -- Standard HasSum shift
    sorry
    
  have h_tail_rat : ∃ q : ℚ, ↑q = (↑r : ℝ) - ∑ i ∈ Finset.range N₀, 1 / ((a i : ℝ) - 1) := by
    -- The finite sum is rational, r is rational
    sorry
    
  rcases h_tail_rat with ⟨q, hq⟩
  
  have h_sum_b : ∑' n, 1 / ((b n : ℝ) - 1) = ↑q := by
    rw [hq]
    exact h_tail_sum.tsum_eq
    
  exact sylvester_shifted_irrational b hb_pos hb_sylv ⟨q, h_sum_b⟩
