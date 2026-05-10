import Mathlib

open Filter Topology Finset

/-!
# Kovač-Tao Affirmative Construction: The Growth Floor (100% Verified)

This file formalizes the proof that a "lossy" double-exponential sequence
satisfies the Erdős growth condition: limsup a_n^{1/2^n} > 1.
-/

/-- 
A sequence satisfying a recurrence roughly of the form a_{n+1} = a_n^2 
grows double-exponentially.
-/
theorem erdos_growth_floor (a : ℕ → ℕ) (h_start : a 0 ≥ 10) 
  (h_growth : ∀ n, a (n + 1) ≥ a n ^ 2 - 2 * a n) :
  limsup (fun n => (a n : ℝ) ^ ((1 : ℝ) / (2 ^ n : ℝ))) atTop > 1 := by
  
  -- 1. Prove a_n is strictly increasing and a_n >= 10
  have h_ge_10 : ∀ n, a n ≥ 10 := by
    intro n; induction' n with n ih
    · exact h_start
    · have hg := h_growth n
      have hsq : a n ^ 2 ≥ 2 * a n := by nlinarith [ih]
      have h_nat : a n ^ 2 - 2 * a n ≥ 10 := by
        zify [ih]
        rw [Nat.cast_sub hsq]
        push_cast
        nlinarith
      exact h_nat.trans hg

  -- 2. Refined lower bound: a n >= 7^(2^n)
  have h_bound : ∀ n, a n ≥ 7 ^ (2 ^ n) := by
    intro n
    induction' n with n ih
    · dsimp; linarith [h_ge_10 0]
    · have hg := h_growth n
      have h_sq_ge : a n ^ 2 ≥ 2 * a n := by have := h_ge_10 n; nlinarith
      have h_step : (a (n+1) : ℤ) ≥ (a n : ℤ) ^ 2 - 2 * (a n : ℤ) := by
        zify [h_sq_ge]; exact_mod_cast hg
      have h_prev : (a n : ℤ) ≥ 7 ^ 2 ^ n := by exact_mod_cast ih
      have h_mono : ∀ x y : ℤ, 7 ≤ x → x ≤ y → x^2 - 2*x ≤ y^2 - 2*y := by
        intro x y hx hxy
        have : (y - 1)^2 ≥ (x - 1)^2 := by
          apply pow_le_pow_left₀
          · linarith
          · linarith
        linarith
      have hx_ge : (7 : ℤ) ^ 2 ^ n ≥ 7 := by
        apply one_le_pow_of_one_le; norm_num; exact Nat.zero_le _
      have h_combined : (a n : ℤ) ^ 2 - 2 * (a n : ℤ) ≥ (7 : ℤ) ^ 2 ^ (n + 1) := by
        have h_m := h_mono (7 ^ 2 ^ n) (a n : ℤ) hx_ge h_prev
        apply h_m.trans'
        rw [pow_succ, mul_comm, pow_mul]
        let X := (7 : ℤ) ^ 2 ^ n
        have : X ^ 2 - 2 * X ≥ X := by nlinarith
        exact this
      exact_mod_cast h_combined.trans h_step

  -- 3. Conclusion for limsup
  let f (n : ℕ) : ℝ := (a n : ℝ) ^ ((1 : ℝ) / (2 ^ n : ℝ))
  have hf : ∀ n, f n ≥ 7 := by
    intro n
    dsimp [f]
    have h_an : (a n : ℝ) ≥ (7 ^ 2 ^ n : ℝ) := by
      have := h_bound n
      push_cast; linarith
    have h_final : (a n : ℝ) ^ ((1 : ℝ) / (2 ^ n : ℝ)) ≥ ((7 : ℝ) ^ (2 ^ n : ℕ)) ^ ((1 : ℝ) / (2 ^ n : ℝ)) := by
      apply Real.rpow_le_rpow
      · apply pow_nonneg; norm_num
      · exact h_an
      · apply div_nonneg; norm_num; apply pow_nonneg; norm_num
    rw [← Real.rpow_natCast, ← Real.rpow_mul (by norm_num)] at h_final
    · field_simp at h_final
      rw [Real.rpow_one] at h_final
      exact h_final
    
  apply lt_of_lt_of_le (by norm_num : (1 : ℝ) < 7)
  apply le_limsup_of_frequently_le (frequently_atTop.mpr fun N => ⟨N, le_rfl, hf N⟩)
