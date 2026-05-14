import Mathlib

open Nat

/--
  **The 2-Adic Divergence of the Exact Coupling Variable**

  Let `C_N` be a sequence of integers satisfying the sub-greedy pure recurrence:
  `C_{N+2} + X_N^2 C_N = (X_{N+1} + X_N) C_{N+1}`
  where `X_N = a_N(a_N - 1)`.

  Since `a_N` is an integer, `X_N` is always even.
  Therefore, `X_N = 2 * Y_N` for some integer `Y_N`.
  
  Substituting this into the recurrence gives:
  `C_{N+2} + 4 Y_N^2 C_N = 2 (Y_{N+1} + Y_N) C_{N+1}`
  `C_{N+2} = 2 (Y_{N+1} + Y_N) C_{N+1} - 4 Y_N^2 C_N`

  This implies that the 2-adic valuation of `C_N` grows linearly with `N`.
  Specifically, `v_2(C_{N+2}) \ge \min(v_2(C_{N+1}) + 1, v_2(C_N) + 2)`.
  By induction, `v_2(C_N) \ge N - K` for some constant `K`.
  Since `C_N` is a strictly positive integer, it must grow at least exponentially:
  `C_N \ge 2^{N - K}`.
-/

theorem C_valuation_growth (C : ℕ → ℤ) (Y : ℕ → ℤ) 
    (h_recur : ∀ N, C (N + 2) = 2 * (Y (N + 1) + Y N) * C (N + 1) - 4 * Y N ^ 2 * C N) :
    ∀ N, (2 : ℤ) ^ (N / 2) ∣ C N := by
  intro N
  induction' N using Nat.strongInductionOn with n ih
  rcases n with _ | _ | n
  · -- n = 0
    simp
  · -- n = 1
    simp
  · -- n + 2
    have h_n : (2 : ℤ) ^ (n / 2) ∣ C n := ih n (by omega)
    have h_n1 : (2 : ℤ) ^ ((n + 1) / 2) ∣ C (n + 1) := ih (n + 1) (by omega)
    have hr := h_recur n
    
    rcases h_n with ⟨k_n, hk_n⟩
    rcases h_n1 with ⟨k_n1, hk_n1⟩
    
    rw [hk_n, hk_n1] at hr
    
    have h_div_n1 : (2 : ℤ) ^ ((n + 2) / 2) ∣ 2 * (Y (n + 1) + Y n) * ((2 : ℤ) ^ ((n + 1) / 2) * k_n1) := by
      have h_pow : (2 : ℤ) ^ ((n + 2) / 2) ∣ (2 : ℤ) ^ 1 * (2 : ℤ) ^ ((n + 1) / 2) := by
        rw [← pow_add]
        apply pow_dvd_pow
        have h_step : (n + 2) / 2 = n / 2 + 1 := Nat.add_div_right n (by decide)
        have h_step2 : n / 2 ≤ (n + 1) / 2 := Nat.div_le_div_right (by omega)
        linarith
      have h_pow2 : (2 : ℤ) ^ ((n + 2) / 2) ∣ 2 * (2 : ℤ) ^ ((n + 1) / 2) := h_pow
      have h_eq : 2 * (Y (n + 1) + Y n) * ((2 : ℤ) ^ ((n + 1) / 2) * k_n1) = (2 * (2 : ℤ) ^ ((n + 1) / 2)) * ((Y (n + 1) + Y n) * k_n1) := by ring
      rw [h_eq]
      exact dvd_mul_of_dvd_left h_pow2 _

    have h_div_n : (2 : ℤ) ^ ((n + 2) / 2) ∣ 4 * Y n ^ 2 * ((2 : ℤ) ^ (n / 2) * k_n) := by
      have h_pow : (2 : ℤ) ^ ((n + 2) / 2) ∣ (2 : ℤ) ^ 2 * (2 : ℤ) ^ (n / 2) := by
        rw [← pow_add]
        apply pow_dvd_pow
        have h_step : (n + 2) / 2 = n / 2 + 1 := Nat.add_div_right n (by decide)
        linarith
      have h_pow2 : (2 : ℤ) ^ ((n + 2) / 2) ∣ 4 * (2 : ℤ) ^ (n / 2) := by
        have h4 : (4 : ℤ) = (2 : ℤ) ^ 2 := by norm_num
        rw [h4]
        exact h_pow
      have h_eq : 4 * Y n ^ 2 * ((2 : ℤ) ^ (n / 2) * k_n) = (4 * (2 : ℤ) ^ (n / 2)) * (Y n ^ 2 * k_n) := by ring
      rw [h_eq]
      exact dvd_mul_of_dvd_left h_pow2 _

    rw [hr]
    exact dvd_sub h_div_n1 h_div_n

/--
  **The 2-Adic Growth Forces Exponential Bounds**

  Since `C_N` is divisible by `2^{\lfloor N/2 \rfloor}`, if `C_N` is strictly 
  positive, its absolute value must be at least `2^{\lfloor N/2 \rfloor}`.
-/
theorem C_exponential_lower_bound (C : ℕ → ℤ) (Y : ℕ → ℤ) 
    (h_recur : ∀ N, C (N + 2) = 2 * (Y (N + 1) + Y N) * C (N + 1) - 4 * Y N ^ 2 * C N)
    (h_pos : ∀ N, C N > 0) :
    ∀ N, (2 : ℤ) ^ (N / 2) ≤ C N := by
  intro N
  have h_dvd := C_valuation_growth C Y h_recur N
  have h_pos_N := h_pos N
  exact Int.le_of_dvd h_pos_N h_dvd

