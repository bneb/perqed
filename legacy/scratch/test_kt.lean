import Mathlib

open Filter Topology Finset

theorem erdos_growth_floor (a : ℕ → ℕ) (h_start : a 0 ≥ 10) 
  (h_growth : ∀ n, a (n + 1) ≥ a n ^ 2 - 2 * a n) :
  limsup (fun n => (a n : ℝ) ^ ((1 : ℝ) / (2 ^ n : ℝ))) atTop > 1 := by
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

  have h_bound_Z : ∀ n, (a n : ℤ) ≥ (7 : ℤ) ^ (2 ^ n : ℕ) + 3 := by
    intro n
    induction' n with n ih
    · have : (a 0 : ℤ) ≥ 10 := by exact_mod_cast h_start
      have h7 : (7 : ℤ) ^ (2 ^ 0 : ℕ) + 3 = 10 := by norm_num
      linarith
    · have h10 := h_ge_10 n
      have hs : 2 * a n ≤ a n ^ 2 := by nlinarith
      have hh := h_growth n
      zify [hs] at hh
      have h_pow : (7 : ℤ) ^ (2 ^ (n + 1) : ℕ) = ((7 : ℤ) ^ (2 ^ n : ℕ)) ^ 2 := by
        have : (2 ^ (n + 1) : ℕ) = (2 ^ n : ℕ) * 2 := by ring
        rw [this, pow_mul]
      have hB_pos : (7 : ℤ) ^ (2 ^ n : ℕ) ≥ 0 := by positivity
      nlinarith [ih, hB_pos]
  sorry
