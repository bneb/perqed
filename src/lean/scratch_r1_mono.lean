import Mathlib
import erdos265.erdos265_strict_target
import erdos265.negative_resolution

open Filter Topology Metric Set Finset

def FastGrowth (a : ℕ → ℕ) : Prop :=
  ∀ n, a (n + 1) ≥ (a n) ^ 2 - a n + 1

noncomputable def R₁ (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ) : ℝ :=
  (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) *
    (↑p / ↑q - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ))

theorem R₁_recurrence (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i > 0) :
    R₁ a p q (N + 1) =
      (a N : ℝ) * R₁ a p q N - (q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) := by
  sorry

-- The monotonicity theorem
theorem R₁_monotone_decreasing (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i ≥ 2) (h_fast : FastGrowth a)
    (h_sum : HasSum (fun k => (1 : ℝ) / (a k : ℝ)) (p / q)) (hq : q > 0) :
    R₁ a p q (N + 1) ≤ R₁ a p q N := by
  -- We know sum_N^inf 1/a_k = p/q - sum_0^{N-1} 1/a_k
  have h_tail_sum : HasSum (fun k => (1 : ℝ) / (a (k + N) : ℝ)) 
    (↑p / ↑q - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)) := by
    sorry -- Standard HasSum shift
    
  have h_tail_eq : ↑p / ↑q - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ) = ∑' k, (1 : ℝ) / (a (k + N) : ℝ) := by
    exact h_tail_sum.tsum_eq.symm

  -- Use tail_tsum_bound
  have h_tail_bound := tail_tsum_bound a N h_fast h_pos
  
  -- Rewrite R₁ using tail sum
  have h_R1_eq : R₁ a p q N = (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * ∑' k, (1 : ℝ) / (a (k + N) : ℝ) := by
    unfold R₁
    rw [h_tail_eq]
    
  -- Bound R₁
  have h_prod_pos : (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) > 0 := by
    apply mul_pos
    · exact_mod_cast hq
    · apply prod_pos
      intro i _
      have : (a i : ℝ) ≥ 2 := by exact_mod_cast h_pos i
      linarith
      
  have h_R1_le : R₁ a p q N ≤ (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (1 / ((a N : ℝ) - 1)) := by
    rw [h_R1_eq]
    exact mul_le_mul_of_nonneg_left h_tail_bound (le_of_lt h_prod_pos)
    
  -- Rearrange to R₁ * (a_N - 1) <= q * P_N
  have haN : (a N : ℝ) - 1 > 0 := by
    have : (a N : ℝ) ≥ 2 := by exact_mod_cast h_pos N
    linarith
    
  have h_R1_mul : R₁ a p q N * ((a N : ℝ) - 1) ≤ (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) := by
    have h1 : R₁ a p q N * ((a N : ℝ) - 1) ≤ ((q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (1 / ((a N : ℝ) - 1))) * ((a N : ℝ) - 1) := by
      exact mul_le_mul_of_nonneg_right h_R1_le (le_of_lt haN)
    have h2 : ((q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (1 / ((a N : ℝ) - 1))) * ((a N : ℝ) - 1) = (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) := by
      calc
        ((q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (1 / ((a N : ℝ) - 1))) * ((a N : ℝ) - 1)
        _ = (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * (1 / ((a N : ℝ) - 1) * ((a N : ℝ) - 1)) := by ring
        _ = (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * 1 := by
          congr 1
          exact div_mul_cancel₀ 1 (ne_of_gt haN)
        _ = (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) := by ring
    linarith
    
  -- Now substitute into the recurrence
  have h_rec := R₁_recurrence a p q N (fun i => by
    have := h_pos i
    omega
  )
  
  calc
    R₁ a p q (N + 1) = (a N : ℝ) * R₁ a p q N - (q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) := h_rec
    _ = R₁ a p q N * ((a N : ℝ) - 1) + R₁ a p q N - (q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) := by ring
    _ ≤ (q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) + R₁ a p q N - (q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) := by linarith [h_R1_mul]
    _ = R₁ a p q N := by ring

