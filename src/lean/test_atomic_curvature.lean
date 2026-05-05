import Mathlib
import «verified_analytic»

open Filter Topology Metric Finset Real

/-- 
GREEN ATOMIC 1: Scalar Extraction.
Resolved functional application errors via congr_arg.
-/
example (X1 Y1 X2 Y2 : ℝ) (c : Fin 2 → ℝ) (hc : (∑ i : Fin 2, c i • ![(X1, Y1), (X2, Y2)] i) = 0) :
  c 0 * X1 + c 1 * X2 = 0 := by
  have h_fst := congr_arg Prod.fst hc
  simp [Fin.sum_univ_two] at h_fst
  exact h_fst

/--
GREEN ATOMIC 2: Casting Hurdle.
Resolved linarith failure via norm_cast on simple inequality.
-/
example (n : ℕ) (hL : 10 < n) : (n : ℝ) - 1 > 0 := by
  have : 1 < n := by linarith
  have : 1 < (n : ℝ) := by norm_cast
  linarith

/--
GREEN ATOMIC 3: Limit Splitting.
Resolved nhds_prod_eq failure via prod_eq_inf and tendsto_inf.
-/
example (f g : ℕ → ℝ) : Tendsto (fun n => (f n, g n)) atTop (𝓝 (0, 0)) ↔ Tendsto f atTop (𝓝 0) ∧ Tendsto g atTop (𝓝 0) := by
  rw [nhds_prod_eq, prod_eq_inf, tendsto_inf, tendsto_comap_iff, tendsto_comap_iff]
  rfl
