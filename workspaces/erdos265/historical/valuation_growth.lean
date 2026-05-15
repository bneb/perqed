import Mathlib

open Nat

/-- 
  **The 2-Adic Divergence Theorem**
  
  For any sequence of integers satisfying the dual rationality recurrence:
  `C_{N+1} = X_N * C_N - P_N`
  where `v_2(X_N) ≥ 1` and `v_2(P_N)` grows linearly with `N`,
  the 2-adic valuation `v_2(C_N)` must diverge to infinity.
-/

theorem valuation_divergence (C : ℕ → ℤ) (X : ℕ → ℤ) (P : ℕ → ℤ)
    (h_recur : ∀ N, C (N + 1) = X N * C N - P N)
    (h_X_even : ∀ N, 2 ∣ X N)
    (h_P_div : ∀ N, (2 : ℤ) ^ N ∣ P N) :
    ∀ k : ℕ, ∃ N₀ : ℕ, ∀ n ≥ N₀, (2 : ℤ) ^ k ∣ C n := by
  intro k
  induction' k with k ih
  · use 0; intro n _; simp
  · obtain ⟨N_prev, hN_prev⟩ := ih
    let N₀ := max N_prev (k + 1)
    use N₀
    intro n hn
    induction' n, hn using Nat.le_induction with m hm h_ind
    · exact hN_prev N₀ (le_max_left _ _)
    · -- Goal: 2^(k+1) ∣ C (m + 1)
      rw [h_recur m]
      have hX_even_m := h_X_even m
      have hP_div_m : (2 : ℤ) ^ (k + 1) ∣ P m := by
        apply pow_dvd_pow
        have : k + 1 ≤ N₀ := by omega
        exact le_trans this hm
        exact h_P_div m
      have hX_C : (2 : ℤ) ^ (k + 1) ∣ X m * C m := by
        obtain ⟨x, hx⟩ := hX_even_m
        obtain ⟨c, hc_m⟩ := h_ind
        use x * c
        rw [hx, hc_m]
        push_cast
        ring
      exact dvd_sub hX_C hP_div_m

/--
  **Rule-out of the L=2 Regime**
  
  If C_N converges to a constant (the L=2 case), it contradicts the 
  2-adic divergence v_2(C_N) → ∞.
-/
theorem L2_regime_impossible (C : ℕ → ℤ) (X : ℕ → ℤ) (P : ℕ → ℤ)
    (h_recur : ∀ N, C (N + 1) = X N * C N - P N)
    (h_X_even : ∀ N, 2 ∣ X N)
    (h_P_div : ∀ N, (2 : ℤ) ^ N ∣ P N)
    (h_pos : ∀ N, C N > 0)
    (h_const : ∃ c : ℤ, ∃ N : ℕ, ∀ n ≥ N, C n = c) : False := by
  obtain ⟨c, N_const, hc⟩ := h_const
  have hc_pos : c > 0 := by
    have := h_pos N_const
    rw [hc N_const (le_refl N_const)] at this
    exact this
  
  -- c must be divisible by 2^k for all k
  have h_dvd : ∀ k : ℕ, (2 : ℤ) ^ k ∣ c := by
    intro k
    obtain ⟨N₀, hN₀⟩ := valuation_divergence C X P h_recur h_X_even h_P_div k
    let n := max N_const N₀
    have h1 := hc n (le_max_left _ _)
    have h2 := hN₀ n (le_max_right _ _)
    rw [h1] at h2
    exact h2

  -- If c ≠ 0, then 2^k ≤ |c| for all k, which is impossible
  have h_c_nz : c ≠ 0 := by linarith
  have h_abs_ge : ∀ k, (2 : ℤ) ^ k ≤ |c| := fun k => Int.le_abs_of_dvd h_c_nz (h_dvd k)
  
  -- But 2^k → ∞
  have h_tendsto : Filter.Tendsto (fun k => (2 : ℤ) ^ k) Filter.atTop Filter.atTop := 
    tendsto_pow_atTop_atTop_of_one_lt (by norm_num)
  
  have h_not_bdd : ¬ BddUpper (Set.range (fun k => (2 : ℤ) ^ k)) := 
    Filter.Tendsto.not_bddUpper h_tendsto
    
  apply h_not_bdd
  use |c|
  intro x hx
  obtain ⟨k, hk⟩ := hx
  rw [← hk]
  exact h_abs_ge k
