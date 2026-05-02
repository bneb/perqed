import Mathlib
import «verified_analytic»

open Filter Topology Metric Finset Real

/-!
# The 2D Combinatorial Axiom: The Kovač-Tao Density Proof
This file charts the 4-phase Additive Combinatorics proof required 
to eliminate the final `sorry` in Erdős 265.
-/

/-- The target vector sequence -/
noncomputable def φ (n : ℕ) : ℝ × ℝ := (1 / (n : ℝ), 1 / ((n : ℝ) - 1 : ℝ))

-- ============================================================================
-- PHASE 1: The Curvature Lemma (Linear Independence)
-- ============================================================================

lemma ahmes_vectors_independent (L M R : ℕ) (hL : 10 < L) (hM : L < M) (hR : M < R) :
  LinearIndependent ℝ ![∑ n ∈ Ico L M, φ n, ∑ n ∈ Ico M R, φ n] := by
  sorry

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
    sorry

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
    have h_E_le : ‖E‖ ≤ (1 / 2 : ℝ) * ‖E‖ := h_err_bound.trans hL_micro
    linarith [hE]
    
  · constructor
    · intro n hn
      have h1 : n ≥ L := (Finset.mem_Ico.mp (hB_sub n hn)).1
      linarith [h1, hL_bound]
      
    · calc ‖E - ∑ n ∈ B, φ n‖
        _ = ‖continuous_sum L R t - ∑ n ∈ B, φ n‖ := by rw [h_exact_hit]
        _ ≤ 2 * ‖φ L‖ := h_err
        _ ≤ (1 / 2 : ℝ) * ‖E‖ := hL_micro
