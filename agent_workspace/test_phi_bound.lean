import Mathlib

open Complex Real

noncomputable section

def phi (w : ℂ) : ℂ :=
  w^2 / (1 - w + w^2)

def phi_denom_norm_sq (x : ℝ) : ℝ :=
  x^2 - (5/4) * x + 13/16

lemma phi_denom_norm_sq_min (x : ℝ) :
    phi_denom_norm_sq x ≥ 27/64 := by
  have h_eq : x^2 - (5/4) * x + 13/16 = (x - 5/8)^2 + 27/64 := by ring
  unfold phi_denom_norm_sq
  rw [h_eq]
  have h_sq : 0 ≤ (x - 5/8)^2 := sq_nonneg (x - 5/8)
  linarith

lemma phi_invariant_disk_boundary (θ : ℝ) :
    let z : ℂ := (1/2 : ℝ) * (Real.cos θ + Real.sin θ * I)
    normSq (phi z) ≤ 4/27 := by
  intro z
  have hz_re : z.re = (1/2) * Real.cos θ := by dsimp [z]; simp
  have hz_im : z.im = (1/2) * Real.sin θ := by dsimp [z]; simp
  
  have h_normSq_z : normSq z = 1/4 := by
    calc
      normSq z = z.re^2 + z.im^2 := by simp [normSq]; ring
      _ = ((1/2) * Real.cos θ)^2 + ((1/2) * Real.sin θ)^2 := by rw [hz_re, hz_im]
      _ = 1/4 * (Real.cos θ ^ 2 + Real.sin θ ^ 2) := by ring
      _ = 1/4 * 1 := by rw [Real.cos_sq_add_sin_sq]
      _ = 1/4 := by ring
      
  have h_num : normSq (z^2) = 1/16 := by
    have h_z2 : z^2 = z * z := by ring
    rw [h_z2, map_mul normSq z z, h_normSq_z]
    ring
    
  have hw_re : (1 - z + z^2).re = 1 - z.re + z.re^2 - z.im^2 := by
    simp [sq, Complex.mul_re]
    ring
    
  have hw_im : (1 - z + z^2).im = -z.im + 2 * z.re * z.im := by
    simp [sq, Complex.mul_im]
    ring
    
  have h_w_normSq : normSq (1 - z + z^2) = (1 - z.re + z.re^2 - z.im^2)^2 + (-z.im + 2 * z.re * z.im)^2 := by
    calc
      normSq (1 - z + z^2) = (1 - z + z^2).re^2 + (1 - z + z^2).im^2 := by simp [normSq]; ring
      _ = (1 - z.re + z.re^2 - z.im^2)^2 + (-z.im + 2 * z.re * z.im)^2 := by rw [hw_re, hw_im]
      
  have h_im_sq : z.im^2 = 1/4 - z.re^2 := by
    calc
      z.im^2 = (1/2 * Real.sin θ)^2 := by rw [hz_im]
      _ = 1/4 * Real.sin θ ^ 2 := by ring
      _ = 1/4 * (1 - Real.cos θ ^ 2) := by rw [Real.sin_sq]
      _ = 1/4 - 1/4 * Real.cos θ ^ 2 := by ring
      _ = 1/4 - ((1/2) * Real.cos θ)^2 := by ring
      _ = 1/4 - z.re^2 := by rw [hz_re]
      
  have h_alg : (1 - z.re + z.re^2 - z.im^2)^2 + (-z.im + 2 * z.re * z.im)^2 = 
    (1 - z.re + z.re^2 - (1/4 - z.re^2))^2 + (1/4 - z.re^2) * (-1 + 2 * z.re)^2 := by
    calc
      (1 - z.re + z.re^2 - z.im^2)^2 + (-z.im + 2 * z.re * z.im)^2 = 
      (1 - z.re + z.re^2 - (1/4 - z.re^2))^2 + (z.im * (-1 + 2 * z.re))^2 := by
        rw [h_im_sq]
        congr 1
        ring
      _ = (1 - z.re + z.re^2 - (1/4 - z.re^2))^2 + (1/4 - z.re^2) * (-1 + 2 * z.re)^2 := by
        congr 1
        calc
          (z.im * (-1 + 2 * z.re))^2 = z.im^2 * (-1 + 2 * z.re)^2 := by ring
          _ = (1/4 - z.re^2) * (-1 + 2 * z.re)^2 := by rw [h_im_sq]
          
  have h_final_alg : (1 - z.re + z.re^2 - (1/4 - z.re^2))^2 + (1/4 - z.re^2) * (-1 + 2 * z.re)^2 = 
    phi_denom_norm_sq (2 * z.re) := by
    unfold phi_denom_norm_sq
    ring
    
  have h_denom : normSq (1 - z + z^2) = phi_denom_norm_sq (Real.cos θ) := by
    rw [h_w_normSq, h_alg, h_final_alg]
    have h_2zre : 2 * z.re = Real.cos θ := by
      rw [hz_re]
      ring
    rw [h_2zre]
    
  have h_denom_min : normSq (1 - z + z^2) ≥ 27/64 := by
    rw [h_denom]
    exact phi_denom_norm_sq_min (Real.cos θ)
    
  have h_phi : normSq (phi z) = normSq (z^2) / normSq (1 - z + z^2) := by
    dsimp [phi]
    exact map_div₀ normSq (z^2) (1 - z + z^2)
    
  rw [h_phi, h_num]
  have h_pos : (0 : ℝ) < 27/64 := by norm_num
  have h_denom_pos : (0 : ℝ) < normSq (1 - z + z^2) := by linarith
  have h_inv : (normSq (1 - z + z^2))⁻¹ ≤ (27/64 : ℝ)⁻¹ := by
    exact (inv_le_inv h_denom_pos h_pos).mpr h_denom_min
    
  calc
    (1/16 : ℝ) / normSq (1 - z + z^2) = (1/16 : ℝ) * (normSq (1 - z + z^2))⁻¹ := div_eq_mul_inv (1/16) _
    _ ≤ (1/16 : ℝ) * (27/64 : ℝ)⁻¹ := mul_le_mul_of_nonneg_left h_inv (by norm_num)
    _ = (1/16 : ℝ) / (27/64) := (div_eq_mul_inv (1/16) (27/64)).symm
    _ = 4/27 := by norm_num
