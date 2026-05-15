import Mathlib

open Nat

/-- 
Algorithmic Growth Floor:
Using the substitution x_n = a_n - 3 to simplify the induction.
If a_{n+1} ≥ a_n^2 - 2a_n, then x_{n+1} ≥ x_n^2.
-/
theorem growth_floor (a : ℕ → ℕ) (h_start : a 0 ≥ 10) 
  (h_growth : ∀ n, a (n + 1) ≥ a n ^ 2 - 2 * a n) :
  ∀ n, a n ≥ 7 ^ (2 ^ n) + 3 := by
  -- 1. Base bound: a n ≥ 10
  have h10 : ∀ n, a n ≥ 10 := by
    intro n; induction' n with n ih
    · exact h_start
    · have hg := h_growth n
      have h_sq_ge : 2 * a n ≤ a n ^ 2 := by nlinarith
      zify [h_sq_ge] at hg
      have : (a n : ℤ) ≥ 10 := by exact_mod_cast ih
      have : (a n : ℤ)^2 - 2 * (a n : ℤ) ≥ 10 := by nlinarith
      have : (a (n+1) : ℤ) ≥ 10 := this.trans hg
      exact_mod_cast this

  -- 2. Define the shifted sequence x_n = a_n - 3
  let x (n : ℕ) : ℤ := (a n : ℤ) - 3
  
  have hx0_ge : x 0 ≥ 7 := by
    dsimp [x]
    have : (a 0 : ℤ) ≥ 10 := by exact_mod_cast h_start
    linarith

  -- 3. Show x_{n+1} ≥ x_n^2
  have h_x_sq : ∀ n, x (n + 1) ≥ x n ^ 2 := by
    intro n
    dsimp [x]
    have hg := h_growth n
    have h_sq_ge : 2 * a n ≤ a n ^ 2 := by have := h10 n; nlinarith
    zify [h_sq_ge] at hg
    calc (a (n + 1) : ℤ) - 3
      _ ≥ ((a n : ℤ)^2 - 2 * (a n : ℤ)) - 3 := by linarith
      _ = ((a n : ℤ) - 3) * ((a n : ℤ) + 1) := by ring
      _ ≥ ((a n : ℤ) - 3) * ((a n : ℤ) - 3) := by
          have h1 : (a n : ℤ) + 1 ≥ (a n : ℤ) - 3 := by linarith
          have h2 : (a n : ℤ) - 3 ≥ 0 := by have := h10 n; linarith
          apply mul_le_mul_of_nonneg_left h1 h2
      _ = ((a n : ℤ) - 3)^2 := by ring

  -- 4. Induction: x n ≥ (x 0)^(2^n)
  have h_x_bound : ∀ n, x n ≥ ((x 0) : ℤ) ^ (2 ^ n) := by
    intro n
    induction' n with n ih
    · simp
    · calc x (n + 1)
        _ ≥ x n ^ 2 := h_x_sq n
        _ ≥ ((x 0 : ℤ) ^ 2 ^ n) ^ 2 := by
            have hxn_ge_0 : (x 0 : ℤ) ^ 2 ^ n ≥ 0 := by
               apply pow_nonneg; linarith
            apply pow_le_pow_left₀ hxn_ge_0 ih 2
        _ = x 0 ^ (2 ^ n * 2) := by rw [← pow_mul]
        _ = x 0 ^ (2 ^ (n + 1)) := by rw [pow_succ]

  -- 5. Final assembly
  intro n
  have h_final := h_x_bound n
  dsimp [x] at h_final
  
  have : (a n : ℤ) ≥ (7 : ℤ) ^ 2 ^ n + 3 := by
    calc (a n : ℤ)
      _ = x n + 3 := by linarith
      _ ≥ (x 0) ^ 2 ^ n + 3 := by linarith
      _ ≥ (7 : ℤ) ^ 2 ^ n + 3 := by
          have : (x 0 : ℤ) ^ 2 ^ n ≥ (7 : ℤ) ^ 2 ^ n := by
             apply pow_le_pow_left₀ (by norm_num) hx0_ge
          linarith
  
  exact_mod_cast this
