import Mathlib
import «verified_analytic»

open Filter Topology Metric Finset Real

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
  -- Extract scalar equations by projecting onto coordinates
  have h_fst := congr_arg Prod.fst hc
  have h_snd := congr_arg Prod.snd hc
  simp [Fin.sum_univ_two, Matrix.cons_val_zero, Matrix.cons_val_one] at h_fst h_snd
  -- h_fst: c 0 * X1 + c 1 * X2 = 0
  -- h_snd: c 0 * Y1 + c 1 * Y2 = 0
  
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

/-- Target 2: Slope Inequality Bridging -/
lemma test_slope_comparison (L M n : ℕ) (hL : 10 < L) (hM : L < M) (hn : L ≤ n ∧ n < M) :
  ((1 : ℝ) + 1 / ((M : ℝ) - 1)) * φ1 n < φ2 n := by
  have h_n_gt1 : 1 < (n : ℝ) := by norm_cast; linarith [hL, hn.1]
  have h_M_gt1 : 1 < (M : ℝ) := by norm_cast; linarith [hL, hM]
  have h_lt : (n : ℝ) < (M : ℝ) := by norm_cast; exact hn.2
  dsimp [φ1, φ2]
  have h_n1_pos : 0 < (n : ℝ) - 1 := by linarith
  have h_M1_pos : 0 < (M : ℝ) - 1 := by linarith
  have h_n_pos : 0 < (n : ℝ) := by linarith
  field_simp [h_n_pos.ne', h_n1_pos.ne', h_M1_pos.ne']
  nlinarith

/-- Target 3: Topological Limit Construction -/
lemma test_topological_limit : Tendsto (fun L : ℕ => φ L) atTop (𝓝 (0, 0)) := by
  have h_nat : Tendsto (fun L : ℕ => (L : ℝ)) atTop atTop := tendsto_natCast_atTop_atTop
  have h1 : Tendsto (fun L : ℕ => φ1 L) atTop (𝓝 0) := by
    unfold φ1; simp_rw [one_div]
    exact tendsto_inv_atTop_zero.comp h_nat
  have h2 : Tendsto (fun L : ℕ => φ2 L) atTop (𝓝 0) := by
    unfold φ2; simp_rw [one_div]
    apply tendsto_inv_atTop_zero.comp
    exact tendsto_atTop_add_const_right _ (-1 : ℝ) h_nat
  
  rw [nhds_prod_eq]
  exact Filter.Tendsto.prod_mk h1 h2
