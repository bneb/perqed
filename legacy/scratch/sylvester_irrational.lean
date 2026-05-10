import Mathlib

open Filter Topology Finset Metric

/-- 
Lemma 2: The "Kill Shot"
If a sequence x satisfies x_{n+1} = x_n^2 - x_n + 1, then its reciprocal sum is irrational.
Actually, we prove the specific variant needed for the Erdős problem:
The sum Σ 1/(x_n) + 1/(x_n-1) is irrational for shifted sequences.
-/
theorem sylvester_offset_irrational (x : ℕ → ℕ) 
  (h_start : x 0 ≥ 3)
  (h_rec : ∀ n, x (n + 1) = x n ^ 2 - x n + 1) :
  Irrational (∑' n, (1 : ℝ) / (x n : ℝ)) := by
  
  -- 1. Relation to the Sylvester sequence
  -- 1/x_n = 1/(x_n - 1) - 1/(x_{n+1} - 1)
  have h_telescope : ∀ n, (1 : ℝ) / (x n : ℝ) = (1 : ℝ) / (x n - 1 : ℝ) - (1 : ℝ) / (x (n + 1) - 1 : ℝ) := by
    intro n
    have hx_ge_3 : x n ≥ 3 := by
      induction' n with n ih
      · exact h_start
      · rw [h_rec n]; nlinarith
    have h1 : (x n : ℝ) ≠ 0 := by exact_mod_cast (hx_ge_3.trans_le' (by norm_num))
    have h2 : (x n - 1 : ℝ) ≠ 0 := by exact_mod_cast ((hx_ge_3.trans_le' (by norm_num)) - 1 ≥ 1)
    have h3 : (x (n + 1) - 1 : ℝ) ≠ 0 := by 
      have : x (n+1) ≥ 7 := by rw [h_rec n]; nlinarith
      exact_mod_cast (this - 1 ≥ 6)
    field_simp
    rw [h_rec n]
    push_cast
    ring

  -- 2. The sum telescopes to 1/(x 0 - 1)
  have h_summable : Summable (fun n => (1 : ℝ) / (x n : ℝ)) := by
    apply Summable.of_norm_bounded (g := fun n => (1/2 : ℝ)^n)
    · apply summable_geometric_of_lt_one (by norm_num) (by norm_num)
    · intro n; rw [Real.norm_eq_abs, abs_of_nonneg (by positivity)]
      -- a_n grows double-exponentially, so 1/a_n < (1/2)^n
      have hx_grow : x n ≥ 3^(2^n) := by
        induction' n with n ih
        · simp; exact h_start
        · rw [h_rec n]
          calc (x n ^ 2 - x n + 1 : ℕ)
            _ ≥ (x n - 1)^2 + 1 := by nlinarith
            _ ≥ (3^(2^n) - 1)^2 + 1 := by 
                apply add_le_add_right
                apply pow_le_pow_left₀ (by linarith) (by linarith)
            _ ≥ 3^(2^(n+1)) := by
                let B := (3 : ℕ)^(2^n)
                have : B ≥ 3 := one_le_pow (2^n) 3 (by norm_num) |>.trans (by norm_num)
                nlinarith
      have : (x n : ℝ) ≥ (3 : ℝ)^(2^n) := by exact_mod_cast hx_grow
      have : (3 : ℝ)^(2^n) ≥ (2 : ℝ)^n := by
        calc (3 : ℝ)^2^n ≥ 3^n := pow_le_pow_right₀ (by norm_num) (Nat.le_pow_self (by norm_num) n)
          _ ≥ 2^n := pow_le_pow_left₀ (by norm_num) (by norm_num) n
      apply one_div_le_one_div_of_le (by positivity)
      exact this.trans hx_grow -- Wait, x_n >= 3^2^n >= 2^n

  -- 3. The value of the sum is exactly 1/(x 0 - 1)
  have h_sum_val : ∑' n, (1 : ℝ) / (x n : ℝ) = 1 / (x 0 - 1 : ℝ) := by
    apply sum_telescope''
    · intro n; exact h_telescope n
    · -- Limit of 1/(x n - 1) is 0
      have : Tendsto (fun n => (x n : ℝ)) atTop atTop := by
        apply tendsto_nat_cast_atTop_atTop.comp
        apply (tendsto_pow_atTop_atTop_of_one_lt (by norm_num)).comp
        apply (tendsto_pow_atTop_atTop_of_one_lt (by norm_num))
        -- Wait, this is getting complex, let's use the bound
      apply tendsto_of_tendsto_of_tendsto_of_le_of_le' (tendsto_const_nhds (a := 0))
      · intro n; positivity
      · intro n; 
        have : x n ≥ 3 := by induction' n with n ih; exact h_start; rw [h_rec n]; nlinarith
        apply one_div_le_one_div_of_le (by exact_mod_cast (this - 1 ≥ 2))
        exact_mod_cast (this - 1 ≥ 1) -- Use the x_n grow bound
      · -- Limit of 1/x_n is 0 via grow bound
        sorry -- Placeholder for limit

  -- 4. Irrationality of 1/(x 0 - 1) ?? 
  -- WAIT: 1/(x 0 - 1) is RATIONAL if x 0 is an integer!
  -- I misunderstood the Kill Shot. Let's re-read the Tao-Kovac paper.
  -- The Kill Shot is NOT about the Sylvester sum being irrational.
  -- It's about the FACT that if the sum is rational, it MUST be a Sylvester sum.
  -- And we want to show it's NOT a Sylvester sum.
  
  sorry
