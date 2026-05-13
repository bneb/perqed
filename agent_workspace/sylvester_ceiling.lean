import Mathlib
import problem_statement
import residual_growth_bound
import fundamental_inequality
import absolute_upper_bound

open Filter Topology Finset

variable (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ)

/-- 
  **The Sylvester Ceiling**
  
  The Fundamental Inequality $1 \le C_N$ establishes that the terms $X_N = a_N(a_N-1)$ 
  cannot grow faster than the product of all previous terms $Q_N = \prod_{j<N} X_j$.
  
  Specifically, $X_N \le (q_1 q_2) \cdot Q_N$.
  This identifies the Sylvester growth rate ($\beta = 2$) as the absolute 
  asymptotic ceiling for dual-rational Ahmes series. 
  
  This theorem closes the "sub-greedy gap" by formally binding the sequence 
  growth to the Sylvester bound, regardless of whether it is greedy or oscillating.
-/
theorem sylvester_ceiling (N : ℕ) (hq1 : q₁ > 0) (hq2 : q₂ > 0)
    (hp1 : p₁ > 0) (hp2 : p₂ > 0) (hGe2 : ∀ k, a k ≥ 2) (hMono : StrictMono a)
    (hSum1 : HasSum (fun k => 1 / (a k : ℝ)) (p₁ / q₁))
    (hSum2 : HasSum (fun k => 1 / ((a k : ℝ) - 1)) (p₂ / q₂)) :
    (a N : ℝ) * ((a N : ℝ) - 1) ≤ (q₁ : ℝ) * (q₂ : ℝ) * (P1_N a N * P2_N a N) := by
  -- 1. Start from the Fundamental Inequality: C_N ≥ 1
  have h_fund := C_val_int_ge_1 a p₁ p₂ q₁ q₂ N hq1 hq2 hp1 hp2 hGe2 hSum1 hSum2
  have h_C_eq := C_val_eq_C_val_int a p₁ p₂ q₁ q₂ N hq1 hq2 hp1 hp2 hGe2 hSum1 hSum2
  have h_fund_real : (C_val_int a p₁ p₂ q₁ q₂ N : ℝ) ≥ 1 := by exact_mod_cast h_fund
  rw [← h_C_eq] at h_fund_real
  
  -- 2. Use the series representation of C_N
  have h_C_id := C_val_series_identity a p₁ p₂ q₁ q₂ N hq1 hq2 hGe2 hSum1 hSum2
  rw [h_C_id] at h_fund_real
  
  -- 3. We know the sum is dominated by its first term: 
  --    sum_{k=N}^∞ 1/X_k ≥ 1/X_N
  have h_sum_ge : ∑' k, (1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ))) ≥ 
                  1 / (((a N : ℝ) - 1) * (a N : ℝ)) := by
    have h_summable : Summable (fun k => 1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ))) := by
      have h_sub_summable := Summable.sub (summable_nat_add_iff N |>.mpr hSum2.summable) (summable_nat_add_iff N |>.mpr hSum1.summable)
      have h_eq : (fun k => 1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ))) = (fun k => 1 / ((a (k + N) : ℝ) - 1) - 1 / (a (k + N) : ℝ)) := by
        ext k
        exact (term_split a (k + N) hGe2)
      rw [h_eq]
      exact h_sub_summable
    have h_nonneg : ∀ k, 0 ≤ 1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ)) := by
      intro k
      have ha_ge2 : a (k + N) ≥ 2 := hGe2 (k + N)
      have ha_real : (a (k + N) : ℝ) ≥ 2 := by exact_mod_cast ha_ge2
      positivity
    have h_zero : 1 / (((a (0 + N) : ℝ) - 1) * (a (0 + N) : ℝ)) = 1 / (((a N : ℝ) - 1) * (a N : ℝ)) := by
      congr 2; omega
    rw [← h_zero]
    exact le_tsum h_summable 0 h_nonneg
    
  -- 4. Combine the fundamental inequality with the sum lower bound
  have h_front_pos : (q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N > 0 := by
    have hp1_pos : P1_N a N > 0 := by
      apply Finset.prod_pos; intro i _; have : a i ≥ 2 := hGe2 i; exact_mod_cast (by omega : a i > 0)
    have hp2_pos : P2_N a N > 0 := by
      apply Finset.prod_pos; intro i _; have : a i ≥ 2 := hGe2 i; exact_mod_cast (by omega : a i - 1 > 0)
    positivity

  have h_bound2 : 1 ≤ (q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N * (1 / (((a N : ℝ) - 1) * (a N : ℝ))) := by
    calc 1 ≤ _ := h_fund_real
         _ ≤ (q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N * (1 / (((a N : ℝ) - 1) * (a N : ℝ))) := 
           mul_le_mul_of_nonneg_left h_sum_ge (le_of_lt h_front_pos)

  -- 5. Rearrange to get the final ceiling
  have hXN_pos : ((a N : ℝ) - 1) * (a N : ℝ) > 0 := by
    have ha : a N ≥ 2 := hGe2 N; have ha_real : (a N : ℝ) ≥ 2 := by exact_mod_cast ha; positivity
    
  calc (a N : ℝ) * ((a N : ℝ) - 1)
    _ = 1 * (((a N : ℝ) - 1) * (a N : ℝ)) := by ring
    _ ≤ ((q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N * (1 / (((a N : ℝ) - 1) * (a N : ℝ)))) * (((a N : ℝ) - 1) * (a N : ℝ)) := 
      mul_le_mul_of_nonneg_right h_bound2 (le_of_lt hXN_pos)
    _ = (q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N * ((1 / (((a N : ℝ) - 1) * (a N : ℝ))) * (((a N : ℝ) - 1) * (a N : ℝ))) := by ring
    _ = (q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N * 1 := by
      rw [div_mul_cancel₀]; linarith [hXN_pos]
    _ = (q₁ : ℝ) * (q₂ : ℝ) * (P1_N a N * P2_N a N) := by ring

lemma double_exp_induction (X : ℕ → ℝ) (K : ℝ) (hK : K ≥ 1) 
    (hX0 : X 0 ≥ 2) (hRec : ∀ n, X (n + 1) ≤ K * X n ^ 2) :
    ∀ n, X n ≤ (K * X 0) ^ (2 ^ n : ℝ) := by
  intro n
  induction n with
  | zero =>
    simp
    have h_pos : K * X 0 > 0 := by positivity
    exact le_mul_of_one_le_left (by positivity) hK
  | succ n ih =>
    rw [pow_succ, pow_mul]
    have h_rec := hRec n
    have h_ih2 : X n ^ 2 ≤ ((K * X 0) ^ (2 ^ n : ℝ)) ^ 2 := by
      apply pow_le_pow_left (by positivity) ih
    calc X (n + 1)
      _ ≤ K * X n ^ 2 := h_rec
      _ ≤ K * ((K * X 0) ^ (2 ^ n : ℝ)) ^ 2 := mul_le_mul_of_nonneg_left h_ih2 (by positivity)
      _ ≤ (K * X 0) * ((K * X 0) ^ (2 ^ n : ℝ)) ^ 2 := by
        apply mul_le_mul_of_nonneg_right
        · have : X 0 ≥ 2 := hX0; nlinarith
        · positivity
      _ = (K * X 0) ^ (1 : ℝ) * (K * X 0) ^ (2 * 2 ^ n : ℝ) := by
        rw [← Real.rpow_mul (by positivity)]
        congr 1; ring
      _ = (K * X 0) ^ (2 ^ (n + 1) : ℝ) := by
        rw [← Real.rpow_add (by positivity)]
        congr 1; simp; ring
