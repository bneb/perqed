import Mathlib

open Filter Topology Metric

theorem phi_step_bound (n : ℕ) (hn : n ≥ 2) :
  |(1 / (n : ℝ)) - (1 / (n + 1 : ℝ))| ≤ 2 / (n : ℝ)^2 ∧ 
  |(1 / ((n : ℝ) - 1)) - (1 / (n : ℝ))| ≤ 2 / (n : ℝ)^2 := by
  have h_n : (n : ℝ) ≥ 2 := by exact_mod_cast hn
  have h_n_pos : (n : ℝ) > 0 := by linarith
  have h_n1_pos : (n : ℝ) + 1 > 0 := by linarith
  have h_nm1_pos : (n : ℝ) - 1 > 0 := by linarith
  constructor
  · have h_pos : 0 ≤ 1 / (n : ℝ) - 1 / (n + 1 : ℝ) := by
      apply sub_nonneg.mpr
      apply one_div_le_one_div_of_le h_n_pos; linarith
    rw [abs_of_nonneg h_pos]
    field_simp [h_n_pos.ne', h_n1_pos.ne']
    nlinarith
  · have h_pos : 0 ≤ 1 / ((n : ℝ) - 1) - 1 / (n : ℝ) := by
      apply sub_nonneg.mpr
      apply one_div_le_one_div_of_le h_nm1_pos; linarith
    rw [abs_of_nonneg h_pos]
    field_simp [h_n_pos.ne', h_nm1_pos.ne']
    nlinarith
