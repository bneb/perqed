import Mathlib
import problem_statement
import residual_growth_bound
import fundamental_inequality

open Filter Topology Finset

variable (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ)

lemma term_split (k : ℕ) (hGe2 : ∀ j, a j ≥ 2) : 
    1 / (((a k : ℝ) - 1) * (a k : ℝ)) = 1 / ((a k : ℝ) - 1) - 1 / (a k : ℝ) := by
  have ha_ge2 : a k ≥ 2 := hGe2 k
  have ha_real : (a k : ℝ) ≥ 2 := by exact_mod_cast ha_ge2
  have h_ne1 : (a k : ℝ) - 1 ≠ 0 := by linarith
  have h_ne2 : (a k : ℝ) ≠ 0 := by linarith
  exact (div_sub_div 1 1 h_ne1 h_ne2 |>.trans (by ring_nf)).symm

lemma strict_mono_inv_bound (k : ℕ) (hMono : StrictMono a) (hGe2 : ∀ j, a j ≥ 2) :
    1 / (a k : ℝ) ≥ 1 / ((a (k + 1) : ℝ) - 1) := by
  have h_strict : a k < a (k + 1) := hMono (Nat.lt_succ_self k)
  have h_le : a k + 1 ≤ a (k + 1) := h_strict
  have h_le_real : (a k : ℝ) + 1 ≤ (a (k + 1) : ℝ) := by exact_mod_cast h_le
  have h_le_real2 : (a k : ℝ) ≤ (a (k + 1) : ℝ) - 1 := by linarith
  have ha_ge2 : a k ≥ 2 := hGe2 k
  have ha_pos : (a k : ℝ) > 0 := by linarith
  have hb_pos : (a (k + 1) : ℝ) - 1 > 0 := by linarith
  exact one_div_le_one_div_of_le ha_pos h_le_real2

lemma partial_sum_bound (m N : ℕ) (hGe2 : ∀ k, a k ≥ 2) (hMono : StrictMono a) :
    (range (m + 1)).sum (fun k => 1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ))) ≤ 1 / ((a N : ℝ) - 1) - 1 / (a (m + N) : ℝ) := by
  induction m with
  | zero =>
    rw [sum_range_one]
    have : 0 + N = N := by omega
    rw [this]
    exact le_of_eq (term_split a N hGe2)
  | succ m ih =>
    rw [sum_range_succ]
    have h_term : 1 / (((a (m + 1 + N) : ℝ) - 1) * (a (m + 1 + N) : ℝ)) = 1 / ((a (m + 1 + N) : ℝ) - 1) - 1 / (a (m + 1 + N) : ℝ) := term_split a (m + 1 + N) hGe2
    rw [h_term]
    have h_le1 : (range (m + 1)).sum (fun k => 1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ))) + (1 / ((a (m + 1 + N) : ℝ) - 1) - 1 / (a (m + 1 + N) : ℝ)) ≤ 
                 1 / ((a N : ℝ) - 1) - 1 / (a (m + N) : ℝ) + (1 / ((a (m + 1 + N) : ℝ) - 1) - 1 / (a (m + 1 + N) : ℝ)) := add_le_add_right ih _
    have h_mono_inv : 1 / ((a (m + 1 + N) : ℝ) - 1) ≤ 1 / (a (m + N) : ℝ) := by
      have : m + 1 + N = m + N + 1 := by omega
      rw [this]
      exact strict_mono_inv_bound a (m + N) hMono hGe2
    linarith

lemma tsum_telescope_bound (N : ℕ) (hGe2 : ∀ k, a k ≥ 2) (hMono : StrictMono a) 
    (hSum1 : HasSum (fun k => 1 / (a k : ℝ)) (p₁ / q₁))
    (hSum2 : HasSum (fun k => 1 / ((a k : ℝ) - 1)) (p₂ / q₂)) :
    ∑' k, (1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ))) ≤ 1 / ((a N : ℝ) - 1) := by
  have h_summable : Summable (fun k => 1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ))) := by
    have h_sub_summable := Summable.sub (summable_nat_add_iff N |>.mpr hSum2.summable) (summable_nat_add_iff N |>.mpr hSum1.summable)
    have h_eq : (fun k => 1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ))) = (fun k => 1 / ((a (k + N) : ℝ) - 1) - 1 / (a (k + N) : ℝ)) := by
      ext k
      exact (term_split a (k + N) hGe2)
    rw [h_eq]
    exact h_sub_summable
    
  have h_tendsto := h_summable.hasSum.tendsto_sum_nat
  have h_le_const : ∀ᶠ m in atTop, (range m).sum (fun k => 1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ))) ≤ 1 / ((a N : ℝ) - 1) := by
    apply eventually_atTop.mpr
    use 1
    intro m hm
    have h_m_pos : m ≥ 1 := hm
    let m' := m - 1
    have hm_eq : m' + 1 = m := by omega
    rw [← hm_eq]
    have h_bound := partial_sum_bound a (m - 1) N hGe2 hMono
    have h_strict_bound : 1 / ((a N : ℝ) - 1) - 1 / (a (m - 1 + N) : ℝ) ≤ 1 / ((a N : ℝ) - 1) := by
      have ha_ge2 : a (m - 1 + N) ≥ 2 := hGe2 (m - 1 + N)
      have ha_real : (a (m - 1 + N) : ℝ) ≥ 2 := by exact_mod_cast ha_ge2
      have ha_pos : 1 / (a (m - 1 + N) : ℝ) > 0 := by positivity
      linarith
    exact le_trans h_bound h_strict_bound
    
  exact le_of_tendsto h_tendsto h_le_const

theorem sequence_absolute_upper_bound (N : ℕ) (hq1 : q₁ > 0) (hq2 : q₂ > 0)
    (hp1 : p₁ > 0) (hp2 : p₂ > 0) (hGe2 : ∀ k, a k ≥ 2) (hMono : StrictMono a)
    (hSum1 : HasSum (fun k => 1 / (a k : ℝ)) (p₁ / q₁))
    (hSum2 : HasSum (fun k => 1 / ((a k : ℝ) - 1)) (p₂ / q₂)) :
    (a N : ℝ) - 1 ≤ (q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N := by
  have h_fund := C_val_int_ge_1 a p₁ p₂ q₁ q₂ N hq1 hq2 hp1 hp2 hGe2 hSum1 hSum2
  have h_C_eq := C_val_eq_C_val_int a p₁ p₂ q₁ q₂ N hq1 hq2 hp1 hp2 hGe2 hSum1 hSum2
  have h_fund_real : (C_val_int a p₁ p₂ q₁ q₂ N : ℝ) ≥ 1 := by exact_mod_cast h_fund
  rw [← h_C_eq] at h_fund_real
  have h_C_id := C_val_series_identity a p₁ p₂ q₁ q₂ N hq1 hq2 hGe2 hSum1 hSum2
  rw [h_C_id] at h_fund_real
  
  have h_tsum_bound := tsum_telescope_bound a p₁ p₂ q₁ q₂ N hGe2 hMono hSum1 hSum2
  have h_front_pos : (q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N > 0 := by
    have hp1_pos : P1_N a N > 0 := by
      apply Finset.prod_pos
      intro i _
      have : a i ≥ 2 := hGe2 i
      have ha_real : (a i : ℝ) ≥ 2 := by exact_mod_cast this
      linarith
    have hp2_pos : P2_N a N > 0 := by
      apply Finset.prod_pos
      intro i _
      have : a i ≥ 2 := hGe2 i
      have ha_real : (a i : ℝ) ≥ 2 := by exact_mod_cast this
      linarith
    positivity
    
  have h_mul_bound : (q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N * ∑' k, (1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ))) ≤ 
                     (q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N * (1 / ((a N : ℝ) - 1)) := by
    apply mul_le_mul_of_nonneg_left h_tsum_bound
    exact le_of_lt h_front_pos
    
  have h_bound2 : 1 ≤ (q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N * (1 / ((a N : ℝ) - 1)) := by
    linarith
    
  have haN_pos : (a N : ℝ) - 1 > 0 := by
    have : a N ≥ 2 := hGe2 N
    have ha_real : (a N : ℝ) ≥ 2 := by exact_mod_cast this
    linarith
    
  have h_bound3 : 1 * ((a N : ℝ) - 1) ≤ ((q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N * (1 / ((a N : ℝ) - 1))) * ((a N : ℝ) - 1) := by
    apply mul_le_mul_of_nonneg_right h_bound2
    exact le_of_lt haN_pos
    
  have h_cancel : (1 / ((a N : ℝ) - 1)) * ((a N : ℝ) - 1) = 1 := by
    calc (1 / ((a N : ℝ) - 1)) * ((a N : ℝ) - 1)
      _ = ((a N : ℝ) - 1) / ((a N : ℝ) - 1) := by ring
      _ = 1 := div_self (ne_of_gt haN_pos)
    
  have h_bound4 : (a N : ℝ) - 1 ≤ (q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N := by
    calc (a N : ℝ) - 1
      _ = 1 * ((a N : ℝ) - 1) := by ring
      _ ≤ ((q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N * (1 / ((a N : ℝ) - 1))) * ((a N : ℝ) - 1) := h_bound3
      _ = (q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N * ((1 / (((a N : ℝ) - 1))) * (((a N : ℝ) - 1))) := by ring
      _ = (q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N * 1 := by rw [h_cancel]
      _ = (q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N := by ring
      
  exact h_bound4
