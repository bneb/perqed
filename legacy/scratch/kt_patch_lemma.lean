import Mathlib

open Filter Topology Metric

/-!
# Kovač-Tao Unified Proof: The Patch Lemma (Density)

This file formalizes the Step Size Bound for the reciprocal vectors.
-/

noncomputable section

/-- 
Lemma: Step Size Bound (Real Version).
For any real number n ≥ 2, the distance between the reciprocal vectors
is bounded by 2/n^2.
-/
lemma phi_step_bound_real (n : ℝ) (hn : n ≥ 2) :
  max |1 / n - 1 / (n + 1)| |1 / (n - 1) - 1 / n| ≤ 2 / n^2 := by
  apply max_le
  · -- dx bound
    have h1 : 0 < n := by linarith
    have h2 : 0 < n + 1 := by linarith
    have h_pos : 0 < 1 / n - 1 / (n + 1) := by
      rw [sub_pos]
      exact (one_div_lt_one_div h2 h1).mpr (by linarith)
    rw [abs_of_pos h_pos]
    field_simp [h1.ne', h2.ne']
    nlinarith
  · -- dy bound
    have h1 : 0 < n := by linarith
    have h2 : 0 < n - 1 := by linarith
    have h_pos : 0 < 1 / (n - 1) - 1 / n := by
      rw [sub_pos]
      exact (one_div_lt_one_div h1 h2).mpr (by linarith)
    rw [abs_of_pos h_pos]
    field_simp [h1.ne', h2.ne']
    nlinarith

/-- The vector of contributions for a single integer n. -/
def φ (n : ℕ) : ℝ × ℝ := (1 / (n : ℝ), 1 / ((n : ℝ) - 1))

/-- 
Lemma: Step Size Bound.
The distance between consecutive vectors φ(n) and φ(n+1) is O(1/n^2).
-/
lemma phi_step_bound (n : ℕ) (hn : n ≥ 2) :
  ‖φ n - φ (n + 1)‖ ≤ 2 / (n : ℝ)^2 := by
  have h_step := phi_step_bound_real (n : ℝ) (by exact_mod_cast hn)
  dsimp [φ, Prod.norm_def]
  have h_id : (n + 1 : ℝ) - 1 = n := by push_cast; ring
  rw [Real.norm_eq_abs, Real.norm_eq_abs, h_id]
  convert h_step using 3
  · field_simp; ring
  · field_simp; ring
