import Mathlib
import erdos265.erdos265_strict_target
import erdos265.beta2_boundary

open Finset

-- Assuming we have R1_eventually_constant
axiom R₁_eventually_constant_ax (a : ℕ → ℕ) (p : ℤ) (q : ℕ)
    (h_pos : ∀ i, a i ≥ 2) (h_fast : FastGrowth a)
    (h_sum : HasSum (fun k => (1 : ℝ) / (a k : ℝ)) (p / q)) (hq : q > 0) :
    ∃ (N₀ : ℕ), ∀ N ≥ N₀, R₁ a p q (N + 1) = R₁ a p q N

theorem eventually_sylvester (a : ℕ → ℕ) (p : ℤ) (q : ℕ)
    (h_pos : ∀ i, a i ≥ 2) (h_fast : FastGrowth a)
    (h_sum : HasSum (fun k => (1 : ℝ) / (a k : ℝ)) (p / q)) (hq : q > 0) :
    ∃ (N₀ : ℕ), ∀ N ≥ N₀, a (N + 1) = (a N)^2 - a N + 1 := by
  rcases R₁_eventually_constant_ax a p q h_pos h_fast h_sum hq with ⟨N₀, h_const⟩
  use N₀
  intro N hN
  have hN1 : N + 1 ≥ N₀ := by omega
  have h_eqN := h_const N hN
  have h_eqN1 := h_const (N + 1) hN1
  
  have h_recN := R₁_recurrence a p q N (fun i => by
    have := h_pos i
    omega
  )
  have h_recN1 := R₁_recurrence a p q (N + 1) (fun i => by
    have := h_pos i
    omega
  )
  
  -- From h_recN and h_eqN: R(N) = a_N R(N) - q P_N
  have h_relN : (q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) = R₁ a p q N * ((a N : ℝ) - 1) := by
    calc
      (q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) = (a N : ℝ) * R₁ a p q N - R₁ a p q (N + 1) := by linarith [h_recN]
      _ = (a N : ℝ) * R₁ a p q N - R₁ a p q N := by rw [h_eqN]
      _ = R₁ a p q N * ((a N : ℝ) - 1) := by ring
      
  -- From h_recN1 and h_eqN1: R(N+1) = a_{N+1} R(N+1) - q P_{N+1}
  -- Since R(N+1) = R(N) and R(N+2) = R(N+1) = R(N), we have R(N) = a_{N+1} R(N) - q P_{N+1}
  have h_relN1 : (q : ℝ) * ∏ i ∈ Finset.range (N + 1), (a i : ℝ) = R₁ a p q N * ((a (N + 1) : ℝ) - 1) := by
    calc
      (q : ℝ) * ∏ i ∈ Finset.range (N + 1), (a i : ℝ) = (a (N + 1) : ℝ) * R₁ a p q (N + 1) - R₁ a p q (N + 2) := by linarith [h_recN1]
      _ = (a (N + 1) : ℝ) * R₁ a p q N - R₁ a p q N := by rw [h_eqN, h_eqN1]
      _ = R₁ a p q N * ((a (N + 1) : ℝ) - 1) := by ring
      
  -- P_{N+1} = P_N * a_N
  have h_P_step : ∏ i ∈ Finset.range (N + 1), (a i : ℝ) = (∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ) := by
    rw [Finset.prod_range_succ]
    
  -- Substitute h_P_step into h_relN1
  have h_subst : (q : ℝ) * ((∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ)) = R₁ a p q N * ((a (N + 1) : ℝ) - 1) := by
    calc
      (q : ℝ) * ((∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ)) = (q : ℝ) * ∏ i ∈ Finset.range (N + 1), (a i : ℝ) := by rw [← h_P_step]
      _ = R₁ a p q N * ((a (N + 1) : ℝ) - 1) := h_relN1
      
  -- Rewrite LHS using h_relN
  have h_lhs : (q : ℝ) * ((∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ)) = R₁ a p q N * ((a N : ℝ) - 1) * (a N : ℝ) := by
    calc
      (q : ℝ) * ((∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ)) = ((q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ) := by ring
      _ = (R₁ a p q N * ((a N : ℝ) - 1)) * (a N : ℝ) := by rw [h_relN]
      _ = R₁ a p q N * ((a N : ℝ) - 1) * (a N : ℝ) := by ring
      
  -- Combine
  have h_combine : R₁ a p q N * ((a N : ℝ) - 1) * (a N : ℝ) = R₁ a p q N * ((a (N + 1) : ℝ) - 1) := by
    calc
      R₁ a p q N * ((a N : ℝ) - 1) * (a N : ℝ) = (q : ℝ) * ((∏ i ∈ Finset.range N, (a i : ℝ)) * (a N : ℝ)) := h_lhs.symm
      _ = R₁ a p q N * ((a (N + 1) : ℝ) - 1) := h_subst
      
  -- We know R₁ > 0
  have h_R1_pos : R₁ a p q N > 0 := by
    -- From R_1_int > 0
    sorry
    
  -- Cancel R₁
  have h_cancel : ((a N : ℝ) - 1) * (a N : ℝ) = (a (N + 1) : ℝ) - 1 := by
    have h_ne : R₁ a p q N ≠ 0 := ne_of_gt h_R1_pos
    exact mul_left_cancel₀ h_ne h_combine
    
  -- Final algebraic shuffle
  have h_final : (a (N + 1) : ℝ) = (a N : ℝ)^2 - (a N : ℝ) + 1 := by
    calc
      (a (N + 1) : ℝ) = ((a N : ℝ) - 1) * (a N : ℝ) + 1 := by linarith [h_cancel]
      _ = (a N : ℝ)^2 - (a N : ℝ) + 1 := by ring
      
  exact_mod_cast h_final
