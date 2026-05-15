import Mathlib

open Filter Topology Finset Metric

/-- 
Algorithmic Convergence Lemma:
If the error in approximating a target vector decays geometrically at each step,
the sequence of partial sums converges to the target.
-/
theorem algorithmic_convergence {E : ℝ × ℝ} {a : ℕ → ℝ × ℝ} 
  (h_decay : ∀ n, ‖E - ∑ i ∈ range (n + 1), a i‖ ≤ (1 / 2 : ℝ) * ‖E - ∑ i ∈ range n, a i‖) :
  HasSum a E := by
  -- Let's define the error sequence
  let e (n : ℕ) := ‖E - ∑ i ∈ range n, a i‖
  
  -- e n ≤ (1/2)^n * e 0
  have h_e_bound : ∀ n, e n ≤ (1 / 2 : ℝ)^n * e 0 := by
    intro n
    induction' n with n ih
    · simp [e]
    · calc e (n + 1)
        _ = ‖E - ∑ i ∈ range (n + 1), a i‖ := rfl
        _ ≤ (1 / 2) * ‖E - ∑ i ∈ range n, a i‖ := h_decay n
        _ = (1 / 2) * e n := rfl
        _ ≤ (1 / 2) * ((1 / 2 : ℝ)^n * e 0) := by 
            apply mul_le_mul_of_nonneg_left ih
            norm_num
        _ = (1 / 2 : ℝ)^(n + 1) * e 0 := by 
            rw [pow_succ]
            ring

  -- Norm of a_n decays geometrically
  have h_a_norm : ∀ n, ‖a n‖ ≤ 3 * (1 / 2 : ℝ)^n * e 0 := by
    intro n
    have h_a_eq : a n = (∑ i ∈ range (n + 1), a i) - (∑ i ∈ range n, a i) := by
      rw [sum_range_succ, add_sub_cancel_left]
    rw [h_a_eq]
    have h_tri : (∑ i ∈ range (n+1), a i) - (∑ i ∈ range n, a i) = 
      (E - ∑ i ∈ range n, a i) - (E - ∑ i ∈ range (n+1), a i) := by ring
    rw [h_tri]
    calc ‖(E - ∑ i ∈ range n, a i) - (E - ∑ i ∈ range (n + 1), a i)‖
      _ ≤ ‖E - ∑ i ∈ range n, a i‖ + ‖E - ∑ i ∈ range (n + 1), a i‖ := norm_sub_le _ _
      _ = e n + e (n + 1) := rfl
      _ ≤ (1/2 : ℝ)^n * e 0 + (1/2 : ℝ)^(n+1) * e 0 := add_le_add (h_e_bound n) (h_e_bound (n+1))
      _ = (1/2 : ℝ)^n * (1 + 1/2) * e 0 := by ring
      _ ≤ (1/2 : ℝ)^n * 3 * e 0 := by 
          apply mul_le_mul_of_nonneg_right
          · apply mul_le_mul_of_nonneg_left (by norm_num) (by apply pow_nonneg; norm_num)
          · exact norm_nonneg _
      _ = 3 * (1/2 : ℝ)^n * e 0 := by ring

  -- Therefore the series is summable in norm
  have h_summable_norm : Summable (fun n => ‖a n‖) := by
    apply Summable.of_norm_bounded (g := fun n => 3 * e 0 * (1 / 2 : ℝ)^n)
    · apply (summable_geometric_of_lt_one (by norm_num) (by norm_num)).mul_left
    · intro n; rw [Real.norm_eq_abs, abs_of_nonneg (norm_nonneg _)]
      calc ‖a n‖
        _ ≤ 3 * (1 / 2 : ℝ)^n * e 0 := h_a_norm n
        _ = 3 * e 0 * (1 / 2 : ℝ)^n := by ring

  -- Final limit conclusion
  apply hasSum_iff_tendsto_nat_of_summable_norm h_summable_norm |>.mpr
  rw [Metric.tendsto_atTop]
  intro ε hε
  have h_lim : Tendsto (fun n => (1 / 2 : ℝ)^n * e 0) atTop (𝓝 0) := by
    have h_base : Tendsto (fun n => (1 / 2 : ℝ)^n) atTop (𝓝 0) := 
      tendsto_pow_atTop_nhds_zero_of_lt_one (by norm_num) (by norm_num)
    have h_mul := h_base.mul_const (e 0)
    rw [zero_mul] at h_mul
    exact h_mul
  obtain ⟨N, hN⟩ := Metric.tendsto_atTop.mp h_lim ε hε
  use N
  intro n hn
  specialize hN n hn
  rw [dist_zero_right, Real.norm_eq_abs, abs_of_nonneg] at hN
  · rw [dist_eq_norm_sub, norm_sub_rev]
    apply (h_e_bound n).trans_lt hN
  · apply mul_nonneg
    · apply pow_nonneg; norm_num
    · exact norm_nonneg _
