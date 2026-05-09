import Mathlib

open Filter Topology Real

lemma bound_induction (a : ℕ → ℝ) (h_pos : ∀ k, a k ≥ 1) 
    (h_bound : ∀ k, (a (k+1)) ^ (3 : ℝ) ≤ (a k) ^ (4 : ℝ)) :
    ∀ k, a k ≤ (a 0) ^ ((4 / 3 : ℝ) ^ (k : ℝ)) := by
  intro k
  induction' k with k ih
  · simp
  · have h_k_pos : a k ≥ 0 := by linarith [h_pos k]
    have h_k1_pos : a (k+1) ≥ 0 := by linarith [h_pos (k+1)]
    have h_step := h_bound k
    have h_cube_root : (a (k+1)) ≤ (a k) ^ (4 / 3 : ℝ) := by
      have h1 : ((a (k+1)) ^ (3 : ℝ)) ^ (1 / 3 : ℝ) ≤ ((a k) ^ (4 : ℝ)) ^ (1 / 3 : ℝ) := by
        apply Real.rpow_le_rpow (by positivity) h_step (by positivity)
      have eq1 : ((a (k+1)) ^ (3 : ℝ)) ^ (1 / 3 : ℝ) = a (k+1) := by
        rw [← Real.rpow_mul h_k1_pos]
        norm_num
      have eq2 : ((a k) ^ (4 : ℝ)) ^ (1 / 3 : ℝ) = (a k) ^ (4 / 3 : ℝ) := by
        rw [← Real.rpow_mul h_k_pos]
        norm_num
      rwa [eq1, eq2] at h1
    
    have h_a0_pos : a 0 ≥ 0 := by linarith [h_pos 0]
    calc a (k + 1)
      _ ≤ (a k) ^ (4 / 3 : ℝ) := h_cube_root
      _ ≤ ((a 0) ^ ((4 / 3 : ℝ) ^ (k : ℝ))) ^ (4 / 3 : ℝ) := by
          apply Real.rpow_le_rpow (by positivity) ih (by positivity)
      _ = (a 0) ^ (((4 / 3 : ℝ) ^ (k : ℝ)) * (4 / 3 : ℝ)) := by
          rw [← Real.rpow_mul h_a0_pos]
      _ = (a 0) ^ ((4 / 3 : ℝ) ^ (k + 1 : ℝ)) := by
          have eq : ((4 / 3 : ℝ) ^ (k : ℝ)) * (4 / 3 : ℝ) = (4 / 3 : ℝ) ^ (k + 1 : ℝ) := by
            have : (k + 1 : ℝ) = (k : ℝ) + 1 := by push_cast; rfl
            rw [this, Real.rpow_add (by norm_num), Real.rpow_one]
          rw [eq]

lemma tendsto_pow_two_thirds : Tendsto (fun k : ℕ => (2 / 3 : ℝ) ^ (k : ℝ)) atTop (𝓝 0) := by
  have : (fun k : ℕ => (2 / 3 : ℝ) ^ (k : ℝ)) = fun k => ((2 / 3 : ℝ) ^ k : ℝ) := by
    ext k; rw [Real.rpow_natCast]
  rw [this]
  exact tendsto_pow_const_div_const_of_abs_lt_one (by norm_num)

lemma tendsto_a0_pow_two_thirds (a0 : ℝ) (ha0 : a0 > 0) :
    Tendsto (fun k : ℕ => a0 ^ ((2 / 3 : ℝ) ^ (k : ℝ))) atTop (𝓝 1) := by
  have h1 : Tendsto (fun x : ℝ => a0 ^ x) (𝓝 0) (𝓝 1) := by
    have : 1 = a0 ^ (0 : ℝ) := by norm_num
    rw [this]
    exact (continuous_const.rpow continuous_id ha0).tendsto 0
  exact h1.comp tendsto_pow_two_thirds

lemma kt_analytic_ceiling_proof (a : ℕ → ℝ) (h_pos : ∀ k, a k ≥ 1)
    (h_bound : ∀ k, 10000 * (a (k+1)) ^ (3 : ℝ) ≤ (a k) ^ (4 : ℝ)) :
    Tendsto (fun k => (a k) ^ (1 / (2 ^ k : ℝ))) atTop (𝓝 1) := by
  sorry
