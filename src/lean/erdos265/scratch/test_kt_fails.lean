import Mathlib

def KT_Approximation_Compatible (a : ℕ → ℕ) : Prop :=
  ∀ k, 50 / (a k : ℝ) ^ 2 ≤ (a (k+1) : ℝ) ^ (1/2 : ℝ) / (2 * (a (k+1) : ℝ) ^ 2)

lemma kt_algorithm_fails_at_beta_2 (a : ℕ → ℕ) 
    (h_growth : ∀ k, (a (k+1) : ℝ) ≥ (a k : ℝ) ^ 2)
    (h_large : ∃ K, (a K : ℝ) > 10000) :
    ¬ KT_Approximation_Compatible a := by
  intro h_kt
  obtain ⟨K, hK⟩ := h_large
  have h_bound := h_kt K
  have haK_pos : (a K : ℝ) > 0 := by linarith
  have haK_sq_pos : (a K : ℝ) ^ 2 > 0 := by positivity
  have haK1_ge : (a (K+1) : ℝ) ≥ (a K : ℝ) ^ 2 := h_growth K
  have haK1_pos : (a (K+1) : ℝ) > 0 := by linarith
  have haK1_sq_pos : (a (K+1) : ℝ) ^ 2 > 0 := by positivity
  
  have h1 : (0 : ℝ) ≤ 50 / (a K : ℝ) ^ 2 := by positivity
  have h2 : (0 : ℝ) ≤ (a (K+1) : ℝ) ^ (1/2 : ℝ) / (2 * (a (K+1) : ℝ) ^ 2) := by positivity
  have h3 : (50 / (a K : ℝ) ^ 2) ^ 2 ≤ ((a (K+1) : ℝ) ^ (1/2 : ℝ) / (2 * (a (K+1) : ℝ) ^ 2)) ^ 2 := by
    nlinarith [sq_le_sq.mpr (by
      rw [abs_of_nonneg h1, abs_of_nonneg h2]
      exact h_bound)]
  
  have h4 : ((a (K+1) : ℝ) ^ (1/2 : ℝ)) ^ 2 = (a (K+1) : ℝ) := by
    rw [← Real.rpow_mul (by positivity)]
    have : (1/2 : ℝ) * 2 = 1 := by norm_num
    rw [this, Real.rpow_one]
  
  have h5 : ((a (K+1) : ℝ) ^ (1/2 : ℝ) / (2 * (a (K+1) : ℝ) ^ 2)) ^ 2 = (a (K+1) : ℝ) / (4 * (a (K+1) : ℝ) ^ 4) := by
    calc ((a (K+1) : ℝ) ^ (1/2 : ℝ) / (2 * (a (K+1) : ℝ) ^ 2)) ^ 2
      _ = ((a (K+1) : ℝ) ^ (1/2 : ℝ)) ^ 2 / (2 * (a (K+1) : ℝ) ^ 2) ^ 2 := div_pow _ _ 2
      _ = (a (K+1) : ℝ) / (2 * (a (K+1) : ℝ) ^ 2) ^ 2 := by rw [h4]
      _ = (a (K+1) : ℝ) / (4 * (a (K+1) : ℝ) ^ 4) := by ring
  
  have h6 : (50 / (a K : ℝ) ^ 2) ^ 2 = 2500 / (a K : ℝ) ^ 4 := by ring
  
  have h7 : 2500 / (a K : ℝ) ^ 4 ≤ (a (K+1) : ℝ) / (4 * (a (K+1) : ℝ) ^ 4) := by
    linarith [h3, h4, h5, h6]
    
  have h8 : 10000 * (a (K+1) : ℝ) ^ 3 ≤ (a K : ℝ) ^ 4 := by
    -- 2500 / a_K^4 <= a_{K+1} / (4 a_{K+1}^4)
    have h_cross : 2500 * (4 * (a (K+1) : ℝ) ^ 4) ≤ (a K : ℝ) ^ 4 * (a (K+1) : ℝ) := by
      exact (div_le_div_iff₀ (by positivity) (by positivity)).mp h7
    -- 10000 a_{K+1}^4 <= a_K^4 a_{K+1}
    -- divide by a_{K+1}
    have h_div : 10000 * (a (K+1) : ℝ) ^ 4 / (a (K+1) : ℝ) ≤ (a K : ℝ) ^ 4 * (a (K+1) : ℝ) / (a (K+1) : ℝ) := by
      exact div_le_div_of_nonneg_right (by linarith [h_cross]) (by positivity)
    have eq1 : 10000 * (a (K+1) : ℝ) ^ 4 / (a (K+1) : ℝ) = 10000 * (a (K+1) : ℝ) ^ 3 := by
      have : (a (K+1) : ℝ) ^ 4 = (a (K+1) : ℝ) ^ 3 * (a (K+1) : ℝ) := by ring
      rw [this]
      have : 10000 * ((a (K+1) : ℝ) ^ 3 * (a (K+1) : ℝ)) / (a (K+1) : ℝ) = (10000 * (a (K+1) : ℝ) ^ 3) * ((a (K+1) : ℝ) / (a (K+1) : ℝ)) := by ring
      rw [this, div_self (by positivity)]
      ring
    have eq2 : (a K : ℝ) ^ 4 * (a (K+1) : ℝ) / (a (K+1) : ℝ) = (a K : ℝ) ^ 4 := by
      have : (a K : ℝ) ^ 4 * (a (K+1) : ℝ) / (a (K+1) : ℝ) = (a K : ℝ) ^ 4 * ((a (K+1) : ℝ) / (a (K+1) : ℝ)) := by ring
      rw [this, div_self (by positivity)]
      ring
    linarith [h_div, eq1, eq2]

  have h9 : (a (K+1) : ℝ) ^ 3 ≥ (a K : ℝ) ^ 6 := by
    calc (a (K+1) : ℝ) ^ 3 ≥ ((a K : ℝ) ^ 2) ^ 3 := by gcongr
      _ = (a K : ℝ) ^ 6 := by ring
      
  have h10 : 10000 * (a K : ℝ) ^ 6 ≤ (a K : ℝ) ^ 4 := by linarith [h8, h9]
  
  have h11 : 10000 * (a K : ℝ) ^ 2 ≤ 1 := by
    have h_div2 : 10000 * (a K : ℝ) ^ 6 / (a K : ℝ) ^ 4 ≤ (a K : ℝ) ^ 4 / (a K : ℝ) ^ 4 := by
      exact div_le_div_of_nonneg_right h10 (by positivity)
    have eq3 : 10000 * (a K : ℝ) ^ 6 / (a K : ℝ) ^ 4 = 10000 * (a K : ℝ) ^ 2 := by
      have : (a K : ℝ) ^ 6 = (a K : ℝ) ^ 2 * (a K : ℝ) ^ 4 := by ring
      rw [this]
      have : 10000 * ((a K : ℝ) ^ 2 * (a K : ℝ) ^ 4) / (a K : ℝ) ^ 4 = (10000 * (a K : ℝ) ^ 2) * ((a K : ℝ) ^ 4 / (a K : ℝ) ^ 4) := by ring
      rw [this, div_self (by positivity)]
      ring
    have eq4 : (a K : ℝ) ^ 4 / (a K : ℝ) ^ 4 = 1 := div_self (by positivity)
    linarith [h_div2, eq3, eq4]
      
  have h12 : 10000 * (a K : ℝ) ^ 2 > 10000 * 10000 ^ 2 := by
    gcongr
    exact hK
    
  linarith [h11, h12]
