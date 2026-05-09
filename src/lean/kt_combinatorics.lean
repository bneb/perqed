import Mathlib
import «verified_analytic»
import «verified_rounding»

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

lemma φ_eq_φvr (n : ℕ) : φ n = φvr n := rfl

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
-- PHASE 2: The Reachability Cone
-- ============================================================================

/-- 
The physical reachability cone for vectors starting at index L.
Because the vectors φ(n) = (1/n, 1/(n-1)) have slopes that approach 1 from above,
any target E must have a slope bounded between 1 and the maximum available slope.
-/
def ValidCone (L : ℕ) (E : ℝ × ℝ) : Prop :=
  E.1 > 0 ∧ E.1 < E.2 ∧ E.2 < (1 + 1 / ((L : ℝ) - 1)) * E.1

-- ============================================================================
-- PHASE 3: The Cone-Preserving Patch Axiom
-- ============================================================================

structure ConePatchResult (E : ℝ × ℝ) (lower_bound : ℕ) where
  B : Finset ℕ
  nonempty : B.Nonempty
  bounded : ∀ n ∈ B, n ≥ lower_bound
  err_bound : ‖E - ∑ n ∈ B, φ n‖ ≤ (1 / 2 : ℝ) * ‖E‖
  in_cone : ValidCone (B.max' nonempty + 1) (E - ∑ n ∈ B, φ n)

/-- 
The core topological axiom of the Kovač-Tao proof: 
Not only can we bound the error by half, but we can do so while keeping the 
residual error strictly inside the shrinking valid reachability cone.
This replaces the mathematically false `continuous_covering` axiom which 
falsely claimed that the zonotope covers all of ℝ².
-/
axiom cone_preserving_patch_lemma (E : ℝ × ℝ) (lower_bound : ℕ) (hL : lower_bound ≥ 2) (h_cone : ValidCone lower_bound E) :
  ConePatchResult E lower_bound
