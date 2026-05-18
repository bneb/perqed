import Mathlib
import Perqed.Erdos265.FundamentalInequality

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
    let N₀ := max (N_prev + 1) (k + 2)
    use N₀
    intro n hn
    induction' n, hn using Nat.le_induction with m hm h_ind
    · -- Base case: n = N₀. Show 2^(k+1) ∣ C N₀
      have h_prev : N₀ - 1 ≥ N_prev := by omega
      have h_k_div : (2 : ℤ) ^ k ∣ C (N₀ - 1) := hN_prev (N₀ - 1) h_prev
      have h_P_div_m : (2 : ℤ) ^ (k + 1) ∣ P (N₀ - 1) := by
        have h_dvd1 : (2 : ℤ) ^ (k + 1) ∣ (2 : ℤ) ^ (N₀ - 1) := pow_dvd_pow 2 (by omega)
        exact dvd_trans h_dvd1 (h_P_div (N₀ - 1))
      rw [show N₀ = (N₀ - 1) + 1 by omega, h_recur (N₀ - 1)]
      have hX_even_m : 2 ∣ X (N₀ - 1) := h_X_even (N₀ - 1)
      have hX_C : (2 : ℤ) ^ (k + 1) ∣ X (N₀ - 1) * C (N₀ - 1) := by
        obtain ⟨x, hx⟩ := hX_even_m
        obtain ⟨c, hc_m⟩ := h_k_div
        use x * c
        calc X (N₀ - 1) * C (N₀ - 1) = (2 * x) * ((2 : ℤ) ^ k * c) := by rw [hx, hc_m]
          _ = (2 : ℤ) ^ (k + 1) * (x * c) := by 
            have h_pow : (2 : ℤ) ^ (k + 1) = (2 : ℤ) ^ k * 2 := by ring
            rw [h_pow]
            ring
      exact dvd_sub hX_C h_P_div_m
    · -- Inductive step: C m → C (m + 1)
      rw [h_recur m]
      have hX_even_m := h_X_even m
      have hP_div_m : (2 : ℤ) ^ (k + 1) ∣ P m := by
        have h_dvd1 : (2 : ℤ) ^ (k + 1) ∣ (2 : ℤ) ^ m := pow_dvd_pow 2 (by omega)
        exact dvd_trans h_dvd1 (h_P_div m)
      have hX_C : (2 : ℤ) ^ (k + 1) ∣ X m * C m := by
        obtain ⟨x, hx⟩ := hX_even_m
        obtain ⟨c, hc_m⟩ := h_ind
        use x * c * 2
        calc X m * C m = (2 * x) * ((2 : ℤ) ^ (k + 1) * c) := by rw [hx, hc_m]
          _ = (2 : ℤ) ^ (k + 1) * (x * c * 2) := by ring
      exact dvd_sub hX_C hP_div_m

/--
  **Frequently Bounded Coupling is Impossible**
  
  If C_N drops below M infinitely often, it contradicts the 
  2-adic divergence v_2(C_N) → ∞, which forces C_N → ∞.
-/
theorem bounded_coupling_impossible (C : ℕ → ℤ) (X : ℕ → ℤ) (P : ℕ → ℤ)
    (h_recur : ∀ N, C (N + 1) = X N * C N - P N)
    (h_X_even : ∀ N, 2 ∣ X N)
    (h_P_div : ∀ N, (2 : ℤ) ^ N ∣ P N)
    (h_pos : ∀ N, C N > 0)
    (M : ℤ)
    (h_bounded : ∃ᶠ N in Filter.atTop, C N ≤ M) : False := by
  have h_M_pos : M > 0 := by
    rw [Filter.frequently_atTop] at h_bounded
    obtain ⟨n, _, hn_bound⟩ := h_bounded 0
    have hC := h_pos n
    linarith

  -- For any k, there exists N₀ such that for all n ≥ N₀, 2^k | C_n
  -- Pick k such that 2^k > M
  have h_tendsto : Filter.Tendsto (fun k => (2 : ℤ) ^ k) Filter.atTop Filter.atTop := 
    tendsto_pow_atTop_atTop_of_one_lt (by norm_num)
  
  have h_large := h_tendsto.eventually (Filter.eventually_gt_atTop M)
  rcases h_large.exists with ⟨k₀, hk₀⟩
  
  obtain ⟨N₀, hN₀⟩ := valuation_divergence C X P h_recur h_X_even h_P_div k₀
  
  -- Since C N ≤ M frequently, there is some n ≥ N₀ with C n ≤ M
  rw [Filter.frequently_atTop] at h_bounded
  obtain ⟨n, hn_ge, hn_bound⟩ := h_bounded N₀
  
  have hdvd := hN₀ n hn_ge
  have hC_pos := h_pos n
  
  have h_le := Int.le_of_dvd hC_pos hdvd
  
  linarith
