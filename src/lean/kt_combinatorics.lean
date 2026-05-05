import Mathlib
import «verified_analytic»

open Filter Topology Metric Finset Real

/-!
# The 2D Combinatorial Axiom: The Kovač-Tao Density Proof
This file charts the 4-phase Additive Combinatorics proof required 
to eliminate the final `sorry` in Erdős 265.
-/

/-- Target vector components -/
noncomputable def φ1 (n : ℕ) : ℝ := 1 / (n : ℝ)
noncomputable def φ2 (n : ℕ) : ℝ := 1 / ((n : ℝ) - 1 : ℝ)
noncomputable def φ (n : ℕ) : ℝ × ℝ := (φ1 n, φ2 n)

-- ============================================================================
-- PHASE 1: The Curvature Lemma (Linear Independence)
-- ============================================================================

lemma lin_indep_of_det_2d {X1 Y1 X2 Y2 : ℝ} (h : X1 * Y2 - Y1 * X2 ≠ 0) :
  LinearIndependent ℝ ![(X1, Y1), (X2, Y2)] := by
  rw [Fintype.linearIndependent_iff]
  intro c hc
  have h_fst := congr_arg Prod.fst hc
  have h_snd := congr_arg Prod.snd hc
  simp [Fin.sum_univ_two] at h_fst h_snd
  
  have h_det : c 0 * (X1 * Y2 - Y1 * X2) = 0 := by
    calc c 0 * (X1 * Y2 - Y1 * X2)
      _ = Y2 * (c 0 * X1) - X2 * (c 0 * Y1) := by ring
      _ = Y2 * (-c 1 * X2) - X2 * (-c 1 * Y2) := by 
          rw [show c 0 * X1 = -c 1 * X2 by linarith [h_fst]]
          rw [show c 0 * Y1 = -c 1 * Y2 by linarith [h_snd]]
      _ = 0 := by ring
      
  have h_c0 : c 0 = 0 := (mul_eq_zero.mp h_det).resolve_right h
  have h_c1 : c 1 = 0 := by
    rw [h_c0, zero_mul, zero_add] at h_fst
    cases em (X2 = 0) with
    | inl hX2_z => 
        rw [h_c0, zero_mul, zero_add] at h_snd
        have hY2_nz : Y2 ≠ 0 := by intro hY2_z; simp [hX2_z, hY2_z] at h
        exact (mul_eq_zero.mp h_snd).resolve_right hY2_nz
    | inr hX2_nz => exact (mul_eq_zero.mp h_fst).resolve_right hX2_nz
    
  intro i
  fin_cases i
  · exact h_c0
  · exact h_c1

lemma slope_early (L M : ℕ) (hL : 10 < L) (hM : L < M) :
  ((1 : ℝ) + 1 / ((M : ℝ) - 1)) * (∑ n ∈ Ico L M, φ1 n) < 
  ∑ n ∈ Ico L M, φ2 n := by
  rw [mul_sum]
  apply sum_lt_sum
  · intro n hn; simp at hn
    dsimp [φ1, φ2]
    have h_n_pos : (n : ℝ) > 0 := by exact_mod_cast (show n > 0 by linarith [hL, hn.1])
    have h_nM_pos : (M : ℝ) - 1 > 0 := by apply sub_pos.mpr; exact_mod_cast (show 1 < M by linarith [hL, hM])
    have h_nn_pos : (n : ℝ) - 1 > 0 := by apply sub_pos.mpr; exact_mod_cast (show 1 < n by linarith [hL, hn.1])
    have h_lt : (n : ℝ) < (M : ℝ) := by exact_mod_cast hn.2
    field_simp [h_n_pos.ne', h_nM_pos.ne', h_nn_pos.ne']
    nlinarith
  · use L
    simp; constructor
    · exact hM
    · dsimp [φ1, φ2]
      have h_L_pos : (L : ℝ) > 0 := by exact_mod_cast (show L > 0 by linarith)
      have h_nM_pos : (M : ℝ) - 1 > 0 := by apply sub_pos.mpr; exact_mod_cast (show 1 < M by linarith [hL, hM])
      have h_nL_pos : (L : ℝ) - 1 > 0 := by apply sub_pos.mpr; exact_mod_cast (show 1 < L by linarith)
      have h_lt : (L : ℝ) < (M : ℝ) := by exact_mod_cast hM
      field_simp [h_L_pos.ne', h_nM_pos.ne', h_nL_pos.ne']
      nlinarith

lemma slope_late (M R : ℕ) (hM : 10 < M) (hR : M < R) :
  ∑ n ∈ Ico M R, φ2 n ≤ 
  ((1 : ℝ) + 1 / ((M : ℝ) - 1)) * (∑ n ∈ Ico M R, φ1 n) := by
  rw [mul_sum]
  apply sum_le_sum
  intro n hn; simp at hn
  dsimp [φ1, φ2]
  have h_n_pos : (n : ℝ) > 0 := by exact_mod_cast (show n > 0 by linarith [hM, hn.1])
  have h_nM_pos : (M : ℝ) - 1 > 0 := by apply sub_pos.mpr; exact_mod_cast (show 1 < M by linarith [hM])
  have h_nn_pos : (n : ℝ) - 1 > 0 := by apply sub_pos.mpr; exact_mod_cast (show 1 < n by linarith [hM, hn.1])
  have h_le : (M : ℝ) ≤ (n : ℝ) := by exact_mod_cast hn.1
  field_simp [h_n_pos.ne', h_nM_pos.ne', h_nn_pos.ne']
  nlinarith

lemma ahmes_vectors_independent (L M R : ℕ) (hL : 10 < L) (hM : L < M) (hR : M < R) :
  LinearIndependent ℝ ![∑ n ∈ Ico L M, φ n, ∑ n ∈ Ico M R, φ n] := by
  let X1 := ∑ n ∈ Ico L M, φ1 n
  let Y1 := ∑ n ∈ Ico L M, φ2 n
  let X2 := ∑ n ∈ Ico M R, φ1 n
  let Y2 := ∑ n ∈ Ico M R, φ2 n
  
  have hX1 : 0 < X1 := by
    apply sum_pos
    · intro n hn; simp at hn; dsimp [φ1]; apply one_div_pos.mpr; exact_mod_cast (show n > 0 by linarith)
    · use L; simp; exact hM
  have hX2 : 0 < X2 := by
    apply sum_pos
    · intro n hn; simp at hn; dsimp [φ1]; apply one_div_pos.mpr; exact_mod_cast (show n > 0 by linarith)
    · use M; simp; exact hR

  have h_s1 := slope_early L M hL hM
  have h_s2 := slope_late M R (hL.trans hM) hR
  
  have h_det_nz : X1 * Y2 - Y1 * X2 ≠ 0 := by
    have : X1 * Y2 < Y1 * X2 := by
      calc X1 * Y2
        _ ≤ X1 * (((1 : ℝ) + 1 / (↑M - 1)) * X2) := mul_le_mul_of_nonneg_left h_s2 hX1.le
        _ = ((1 : ℝ) + 1 / (↑M - 1)) * X1 * X2 := by ring
        _ < Y1 * X2 := by nlinarith [h_s1, hX2]
    linarith

  have h_v1 : (∑ n ∈ Ico L M, φ n) = (X1, Y1) := by
    apply Prod.ext
    · rw [Prod.fst_sum]; simp [φ, φ1, X1]
    · rw [Prod.snd_sum]; simp [φ, φ2, Y1]
  have h_v2 : (∑ n ∈ Ico M R, φ n) = (X2, Y2) := by
    apply Prod.ext
    · rw [Prod.fst_sum]; simp [φ, φ1, X2]
    · rw [Prod.snd_sum]; simp [φ, φ2, Y2]

  rw [h_v1, h_v2]
  exact lin_indep_of_det_2d h_det_nz

-- ============================================================================
-- PHASE 2: Continuous Relaxation (The Zonotope)
-- ============================================================================

noncomputable def continuous_sum (L R : ℕ) (t : ℕ → ℝ) : ℝ × ℝ :=
  ∑ n ∈ Ico L R, t n • φ n

lemma continuous_covering (E : ℝ × ℝ) (L : ℕ) (hE : ‖E‖ > 0) :
  ∃ (R : ℕ) (t : ℕ → ℝ), 
    R > L ∧ 
    (∀ n, t n ∈ Set.Icc 0 1) ∧ 
    continuous_sum L R t = E := by
  sorry

-- ============================================================================
-- PHASE 3: The Discrete-Continuous Bridge (Discrepancy Theory)
-- ============================================================================

lemma discrete_rounding_bound (L R : ℕ) (t : ℕ → ℝ) (ht : ∀ n, t n ∈ Set.Icc 0 1) :
  ∃ (B : Finset ℕ), 
    (∀ n ∈ B, n ∈ Ico L R) ∧ 
    ‖continuous_sum L R t - ∑ n ∈ B, φ n‖ ≤ 2 * ‖φ L‖ := by
  sorry

-- ============================================================================
-- PHASE 4: The Combinatorial Axiom (Synthesis)
-- ============================================================================

theorem combinatorial_patch_lemma_2d_proved (E : ℝ × ℝ) (lower_bound : ℕ) (hE : ‖E‖ > 0) :
  ∃ (B : Finset ℕ), 
    B.Nonempty ∧
    (∀ n ∈ B, n ≥ lower_bound) ∧ 
    ‖E - ∑ n ∈ B, φ n‖ ≤ (1 / 2 : ℝ) * ‖E‖ := by
  
  -- Step 1: Force L to be massively large so vector size is microscopic.
  have h_norm_phi : Tendsto (fun L : ℕ => 2 * ‖φ L‖) atTop (𝓝 0) := by
    have h_nat : Tendsto (fun L : ℕ => (L : ℝ)) atTop atTop := tendsto_natCast_atTop_atTop
    have h1 : Tendsto (fun L : ℕ => (L : ℝ)⁻¹) atTop (𝓝 0) := tendsto_inv_atTop_zero.comp h_nat
    have h2 : Tendsto (fun L : ℕ => ((L : ℝ) - 1)⁻¹) atTop (𝓝 0) := by
       apply tendsto_inv_atTop_zero.comp
       exact tendsto_atTop_add_const_right _ (-1 : ℝ) h_nat
    
    have h_phi : Tendsto (fun L : ℕ => φ L) atTop (𝓝 (0, 0)) := by
       rw [nhds_prod_eq, prod_eq_inf, tendsto_inf]
       constructor
       · rw [tendsto_comap_iff]
         convert h1 using 1
         funext L; dsimp [φ, φ1]; rw [one_div]
       · rw [tendsto_comap_iff]
         convert h2 using 1
         funext L; dsimp [φ, φ2]; rw [one_div]
    
    have h_norm := h_phi.norm
    simp at h_norm
    convert h_norm.const_mul 2
    simp

  have h_target_pos : 0 < (1 / 2 : ℝ) * ‖E‖ := mul_pos (by norm_num) hE
  obtain ⟨N, hN⟩ := Metric.tendsto_atTop.mp h_norm_phi ((1 / 2 : ℝ) * ‖E‖) h_target_pos
  
  let L := max N lower_bound
  have hL_bound : L ≥ lower_bound := le_max_right N lower_bound
  
  have hL_micro : 2 * ‖φ L‖ ≤ (1 / 2 : ℝ) * ‖E‖ := by
    have h_dist := hN L (le_max_left N lower_bound)
    rw [dist_zero_right, Real.norm_eq_abs] at h_dist
    have h_pos : 2 * ‖φ L‖ ≥ 0 := by positivity
    rw [abs_of_nonneg h_pos] at h_dist
    exact h_dist.le

  -- Step 2: Continuous Reachability
  obtain ⟨R, t, hR_gt, ht_bounds, h_exact_hit⟩ := continuous_covering E L hE
  
  -- Step 3: Apply the Discrete Rounding Lemma
  obtain ⟨B, hB_sub, h_err⟩ := discrete_rounding_bound L R t ht_bounds
  
  -- Step 4: Final Synthesis
  use B
  constructor
  · by_contra h_empty
    rw [Finset.not_nonempty_iff_eq_empty] at h_empty
    have h_err_bound := h_err
    rw [h_exact_hit] at h_err_bound
    rw [h_empty, Finset.sum_empty, sub_zero] at h_err_bound
    have h_micro_strict : 2 * ‖φ L‖ < (1 / 2 : ℝ) * ‖E‖ := by
      have h_dist := hN L (le_max_left N lower_bound)
      rw [dist_zero_right, Real.norm_eq_abs] at h_dist
      have h_pos : 2 * ‖φ L‖ ≥ 0 := by positivity
      rwa [abs_of_nonneg h_pos] at h_dist
    linarith [hE]
    
  · constructor
    · intro n hn
      have h1 : n ≥ L := (Finset.mem_Ico.mp (hB_sub n hn)).1
      linarith
    · calc ‖E - ∑ n ∈ B, φ n‖
        _ = ‖continuous_sum L R t - ∑ n ∈ B, φ n‖ := by rw [h_exact_hit]
        _ ≤ 2 * ‖φ L‖ := h_err
        _ ≤ (1 / 2 : ℝ) * ‖E‖ := hL_micro
