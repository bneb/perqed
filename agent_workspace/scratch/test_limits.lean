import Mathlib

open Filter Topology

noncomputable section

def prefixProduct (seq : ℕ → ℕ) : ℕ → ℕ
  | 0 => 1
  | n + 1 => prefixProduct seq n * seq n

lemma prefix_limit (seq : ℕ → ℕ) (limitL : ℝ)
    (hLimsup : Tendsto (fun k => (seq k : ℝ) ^ ((1 : ℝ) / 2 ^ k)) atTop (𝓝 limitL)) :
    Tendsto (fun n => (prefixProduct seq n : ℝ) * limitL / (seq n : ℝ)) atTop (𝓝 1) := by
  sorry

lemma tail_sum_limit (seq : ℕ → ℕ) (limitL : ℝ) (hL_gt_1 : limitL > 1)
    (hLimsup : Tendsto (fun k => (seq k : ℝ) ^ ((1 : ℝ) / 2 ^ k)) atTop (𝓝 limitL)) :
    Tendsto (fun n => (seq n : ℝ) * ∑' k, (1 : ℝ) / (seq (n + k) : ℝ)) atTop (𝓝 1) := by
  sorry

theorem test_asymptotic (seq : ℕ → ℕ) (denom : ℕ) (limitL : ℝ) (hL_gt_1 : limitL > 1)
    (hLimsup : Tendsto (fun k => (seq k : ℝ) ^ ((1 : ℝ) / 2 ^ k)) atTop (𝓝 limitL)) 
    (h_pos : ∀ k, (seq k : ℝ) ≠ 0) (hLimitL_ne_zero : limitL ≠ 0) :
    Tendsto (fun n => (denom : ℝ) * (prefixProduct seq n : ℝ) * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ))) atTop (𝓝 (denom / limitL)) := by
  have h1 := prefix_limit seq limitL hLimsup
  have h2 := tail_sum_limit seq limitL hL_gt_1 hLimsup
  
  have h_prod := Tendsto.mul h1 h2
  have h_one_mul_one : (1 : ℝ) * 1 = 1 := by ring
  rw [h_one_mul_one] at h_prod
  
  have h_prod_simp : Tendsto (fun n => (prefixProduct seq n : ℝ) * limitL * ∑' k, (1 : ℝ) / (seq (n + k) : ℝ)) atTop (𝓝 1) := by
    have h_eq : (fun n => ((prefixProduct seq n : ℝ) * limitL / (seq n : ℝ)) * ((seq n : ℝ) * ∑' k, (1 : ℝ) / (seq (n + k) : ℝ))) = 
                (fun n => (prefixProduct seq n : ℝ) * limitL * ∑' k, (1 : ℝ) / (seq (n + k) : ℝ)) := by
      ext n
      have hn_ne_zero := h_pos n
      calc
        ((prefixProduct seq n : ℝ) * limitL / (seq n : ℝ)) * ((seq n : ℝ) * ∑' k, (1 : ℝ) / (seq (n + k) : ℝ))
        _ = ((prefixProduct seq n : ℝ) * limitL) * ((seq n : ℝ)⁻¹) * (seq n : ℝ) * ∑' k, (1 : ℝ) / (seq (n + k) : ℝ) := by
          have h_div : (prefixProduct seq n : ℝ) * limitL / (seq n : ℝ) = (prefixProduct seq n : ℝ) * limitL * (seq n : ℝ)⁻¹ := by rw [div_eq_mul_inv]
          rw [h_div]
          ring
        _ = ((prefixProduct seq n : ℝ) * limitL) * ((seq n : ℝ)⁻¹ * (seq n : ℝ)) * ∑' k, (1 : ℝ) / (seq (n + k) : ℝ) := by ring
        _ = ((prefixProduct seq n : ℝ) * limitL) * 1 * ∑' k, (1 : ℝ) / (seq (n + k) : ℝ) := by rw [inv_mul_cancel hn_ne_zero]
        _ = (prefixProduct seq n : ℝ) * limitL * ∑' k, (1 : ℝ) / (seq (n + k) : ℝ) := by ring
    rw [← h_eq]
    exact h_prod
    
  have h_const_denom : Tendsto (fun (_ : ℕ) => (denom : ℝ) * limitL⁻¹) atTop (𝓝 ((denom : ℝ) * limitL⁻¹)) := tendsto_const_nhds
  
  have h_final_prod := Tendsto.mul h_prod_simp h_const_denom
  have h_one_mul_denom : (1 : ℝ) * ((denom : ℝ) * limitL⁻¹) = (denom : ℝ) * limitL⁻¹ := by ring
  rw [h_one_mul_denom] at h_final_prod
  
  have h_final_eq : (fun n => (prefixProduct seq n : ℝ) * limitL * ∑' k, (1 : ℝ) / (seq (n + k) : ℝ) * ((denom : ℝ) * limitL⁻¹)) = 
                    (fun n => (denom : ℝ) * (prefixProduct seq n : ℝ) * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ))) := by
    ext n
    calc
      (prefixProduct seq n : ℝ) * limitL * ∑' k, (1 : ℝ) / (seq (n + k) : ℝ) * ((denom : ℝ) * limitL⁻¹)
      _ = (denom : ℝ) * (prefixProduct seq n : ℝ) * ∑' k, (1 : ℝ) / (seq (n + k) : ℝ) * (limitL * limitL⁻¹) := by ring
      _ = (denom : ℝ) * (prefixProduct seq n : ℝ) * ∑' k, (1 : ℝ) / (seq (n + k) : ℝ) * 1 := by rw [mul_inv_cancel hLimitL_ne_zero]
      _ = (denom : ℝ) * (prefixProduct seq n : ℝ) * ∑' k, (1 : ℝ) / (seq (n + k) : ℝ) := by ring
      
  have h_final_eq_div : (fun n => (denom : ℝ) * (prefixProduct seq n : ℝ) * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ))) = 
                    (fun n => (denom : ℝ) * (prefixProduct seq n : ℝ) * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ))) := rfl
  
  have h_final_target : (denom : ℝ) * limitL⁻¹ = (denom : ℝ) / limitL := by rw [div_eq_mul_inv]
  
  rw [h_final_target] at h_final_prod
  rw [← h_final_eq]
  exact h_final_prod

end
