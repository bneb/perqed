import Mathlib

def b : ℕ → ℕ
  | 0 => 2
  | n + 1 => b n * b n - b n + 1

def D : ℕ → ℕ
  | 0 => 1
  | n + 1 => Nat.lcm (D n) (b n + 1)

noncomputable def r (n : ℕ) : ℝ :=
  (D n : ℝ) / (b n : ℝ)

lemma b_ge_two (n : ℕ) : 2 ≤ b n := sorry
lemma eight_dvd_D (n : ℕ) (hn : n ≥ 3) : 8 ∣ D n := sorry
lemma b_add_one_mod_four (n : ℕ) (hn : n ≥ 1) : (b n + 1) % 4 = 0 := sorry

lemma b_ge_43 (n : ℕ) (hn : n ≥ 3) : 43 ≤ b n := by
  induction' n, hn using Nat.le_induction with k hk ih
  · rfl
  · dsimp [b]
    have h_sq : 43 * 43 ≤ b k * b k := Nat.mul_self_le_mul_self ih
    have h_sub : 43 * 43 - b k + 1 ≤ b k * b k - b k + 1 := by omega
    have h_bk : b k ≤ b k * b k := Nat.le_mul_self (b k)
    -- Actually 43 <= 43^2 - 43 + 1
    -- So if b k >= 43, b k * b k - b k + 1 >= 43*43 - b k + 1
    -- But we need b k * (b k - 1) + 1 >= 43 * 42 + 1 >= 43
    have h_fact : b k * (b k - 1) + 1 = b k * b k - b k + 1 := by
      have : 1 ≤ b k := by omega
      rw [Nat.mul_sub_left_distrib, Nat.mul_one]
    rw [← h_fact]
    have h_b1 : 42 ≤ b k - 1 := by omega
    have h_mul : 43 * 42 ≤ b k * (b k - 1) := Nat.mul_le_mul ih h_b1
    omega

lemma r_decay (n : ℕ) (hn : n ≥ 3) : r (n + 1) < r n / 3 := by
  have h_b_pos : (0 : ℝ) < b n := by
    have h := b_ge_two n
    have h2 : (2 : ℝ) ≤ (b n : ℝ) := by exact_mod_cast h
    linarith
  have h_b1_pos : (0 : ℝ) < b (n + 1) := by
    have h := b_ge_two (n + 1)
    have h2 : (2 : ℝ) ≤ (b (n + 1) : ℝ) := by exact_mod_cast h
    linarith
  
  have h_dvd1 : 4 ∣ D n := by
    have h8 := eight_dvd_D n hn
    exact dvd_trans (by decide) h8
  have h_dvd2 : 4 ∣ (b n + 1) := by
    have hn1 : n ≥ 1 := by omega
    have hmod := b_add_one_mod_four n hn1
    exact Nat.dvd_of_mod_eq_zero hmod
  have h_gcd : 4 ∣ Nat.gcd (D n) (b n + 1) := Nat.dvd_gcd h_dvd1 h_dvd2
  have h_gcd_ge : 4 ≤ Nat.gcd (D n) (b n + 1) := by
    have h_pos : 0 < Nat.gcd (D n) (b n + 1) := by
      apply Nat.gcd_pos_of_pos_right
      have := b_ge_two n
      omega
    exact Nat.le_of_dvd h_pos h_gcd
  
  have h_lcm : Nat.gcd (D n) (b n + 1) * D (n + 1) = D n * (b n + 1) := by
    dsimp [D]
    exact Nat.gcd_mul_lcm (D n) (b n + 1)
    
  have h_lcm_real : ((Nat.gcd (D n) (b n + 1) : ℝ)) * (D (n + 1) : ℝ) = (D n : ℝ) * ((b n : ℝ) + 1) := by
    have h_cast : ((Nat.gcd (D n) (b n + 1) * D (n + 1) : ℕ) : ℝ) = ((D n * (b n + 1) : ℕ) : ℝ) := by
      rw [h_lcm]
    push_cast at h_cast
    exact h_cast

  have h_D_pos : (0 : ℝ) < D n := by
    -- D n >= 1
    sorry
    
  have h_gcd_real : (4 : ℝ) ≤ (Nat.gcd (D n) (b n + 1) : ℝ) := by exact_mod_cast h_gcd_ge

  have h_b_ge_43 : (43 : ℝ) ≤ (b n : ℝ) := by
    have h := b_ge_43 n hn
    exact_mod_cast h

  have h_b_step : (b (n+1) : ℝ) = (b n : ℝ) * (b n : ℝ) - (b n : ℝ) + 1 := by
    have h_ge : b n ≤ b n * b n := Nat.le_mul_self (b n)
    calc
      (b (n+1) : ℝ) = ↑(b n * b n - b n + 1) := by rfl
      _ = ↑(b n * b n - b n) + 1 := by push_cast; rfl
      _ = ↑(b n * b n) - ↑(b n) + 1 := by rw [Nat.cast_sub h_ge]
      _ = (b n : ℝ) * (b n : ℝ) - (b n : ℝ) + 1 := by push_cast; rfl

  dsimp [r]
  
  have h_D1 : (D (n+1) : ℝ) = (D n : ℝ) * ((b n : ℝ) + 1) / (Nat.gcd (D n) (b n + 1) : ℝ) := by
    rw [← h_lcm_real]
    have h_gcd_nz : (Nat.gcd (D n) (b n + 1) : ℝ) ≠ 0 := by linarith
    exact mul_div_cancel_left₀ (↑(D (n + 1))) h_gcd_nz |>.symm

  rw [h_D1]
  
  -- We want to prove ((D_n * (b_n + 1) / gcd) / b_n1) < (D_n / b_n) / 3
  -- Equivalent to (b_n + 1) / (gcd * b_n1) < 1 / (3 * b_n)
  
  have h_target : ((b n : ℝ) + 1) / ((Nat.gcd (D n) (b n + 1) : ℝ) * (b (n+1) : ℝ)) < 1 / (3 * (b n : ℝ)) := by
    -- 3 * b_n * (b_n + 1) < gcd * b_n1
    have h_ineq : 3 * (b n : ℝ) * ((b n : ℝ) + 1) < 4 * (b (n+1) : ℝ) := by
      calc
        3 * (b n : ℝ) * ((b n : ℝ) + 1) = 3 * (b n : ℝ) * (b n : ℝ) + 3 * (b n : ℝ) := by ring
        _ < 4 * ((b n : ℝ) * (b n : ℝ) - (b n : ℝ) + 1) := by nlinarith
        _ = 4 * (b (n+1) : ℝ) := by rw [← h_b_step]
    have h_ineq2 : 3 * (b n : ℝ) * ((b n : ℝ) + 1) < (Nat.gcd (D n) (b n + 1) : ℝ) * (b (n+1) : ℝ) := by
      calc
        3 * (b n : ℝ) * ((b n : ℝ) + 1) < 4 * (b (n+1) : ℝ) := h_ineq
        _ ≤ (Nat.gcd (D n) (b n + 1) : ℝ) * (b (n+1) : ℝ) := by
          apply mul_le_mul_of_nonneg_right h_gcd_real (by linarith)
    
    -- Now cross-divide
    rw [div_lt_div_iff₀]
    · linarith
    · have h_gcd_pos : (0 : ℝ) < Nat.gcd (D n) (b n + 1) := by linarith
      positivity
    · positivity
  
  -- We have ((b_n + 1) / (gcd * b_n1)) < 1 / (3 * b_n). Multiply by D_n > 0.
  calc
    (D n : ℝ) * ((b n : ℝ) + 1) / (Nat.gcd (D n) (b n + 1) : ℝ) / (b (n + 1) : ℝ) =
      (D n : ℝ) * (((b n : ℝ) + 1) / ((Nat.gcd (D n) (b n + 1) : ℝ) * (b (n+1) : ℝ))) := by ring
    _ < (D n : ℝ) * (1 / (3 * (b n : ℝ))) := by
      apply mul_lt_mul_of_pos_left h_target h_D_pos
    _ = (D n : ℝ) / (b n : ℝ) / 3 := by ring
