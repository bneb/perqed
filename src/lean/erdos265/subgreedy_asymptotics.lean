import Mathlib
import problem_statement

/-!
# Erdős 265: Sub-Greedy Asymptotics

To analyze the sub-greedy domain honestly, we cannot assume algebraic variables
like the exact coupling parameter $C_N$ evaluate precisely to constants. We must
treat the sequence asymptotically.

This file formalizes the convergence of the product ratio $P_2(N)/P_1(N)$,
which evaluates exactly to $\prod_{k=0}^{N-1} (1 - 1/a_k)$. Because $a_k \ge 2$,
the terms $1 - 1/a_k$ lie in $(0, 1)$, making the sequence of partial products
strictly positive and monotonically decreasing.

By the Monotone Convergence Theorem, this sequence MUST converge to a limit $L \ge 0$.
-/

open Filter Topology Finset

/-- The sequence of partial product ratios. -/
noncomputable def prodRatio (a : ℕ → ℕ) (N : ℕ) : ℝ :=
  (Finset.range N).prod (fun i => 1 - 1 / (a i : ℝ))

/-- The terms of the product are in (0, 1] -/
lemma prod_terms_bounds (a : ℕ → ℕ) (hGe2 : ∀ k, a k ≥ 2) (k : ℕ) :
    0 ≤ 1 - 1 / (a k : ℝ) ∧ 1 - 1 / (a k : ℝ) < 1 := by
  have hk : a k ≥ 2 := hGe2 k
  have hk_real : (a k : ℝ) ≥ 2 := by exact_mod_cast hk
  have h_inv_pos : 1 / (a k : ℝ) > 0 := by positivity
  have h_inv_le_one : 1 / (a k : ℝ) ≤ 1 / 2 := by
    exact one_div_le_one_div_of_le (by norm_num) hk_real
  constructor
  · linarith
  · linarith

/-- The partial products are bounded below by 0. -/
lemma prod_ratio_nonneg (a : ℕ → ℕ) (hGe2 : ∀ k, a k ≥ 2) (N : ℕ) :
    0 ≤ prodRatio a N := by
  unfold prodRatio
  apply Finset.prod_nonneg
  intro i _
  exact (prod_terms_bounds a hGe2 i).1

/-- The partial products are monotonically decreasing (antitone). -/
lemma prod_ratio_antitone (a : ℕ → ℕ) (hGe2 : ∀ k, a k ≥ 2) :
    Antitone (prodRatio a) := by
  apply antitone_nat_of_succ_le
  intro n
  have h_eq : prodRatio a (n + 1) = prodRatio a n * (1 - 1 / (a n : ℝ)) := by
    unfold prodRatio
    exact Finset.prod_range_succ (fun i => 1 - 1 / (a i : ℝ)) n
  rw [h_eq]
  have h_nonneg : 0 ≤ prodRatio a n := prod_ratio_nonneg a hGe2 n
  have h_term_bound : 1 - 1 / (a n : ℝ) ≤ 1 := by
    have h_bounds := prod_terms_bounds a hGe2 n
    linarith
  calc
    prodRatio a n * (1 - 1 / (a n : ℝ))
      ≤ prodRatio a n * 1 := mul_le_mul_of_nonneg_left h_term_bound h_nonneg
    _ = prodRatio a n := mul_one _

/-- 
  **The Limit Witness**
  By the Monotone Convergence Theorem, a decreasing sequence bounded below converges.
  This mathematically inhabits the limit $L$ without assuming it.
-/
theorem product_ratio_converges (a : ℕ → ℕ) (hGe2 : ∀ k, a k ≥ 2) :
    ∃ L : ℝ, L ≥ 0 ∧ Tendsto (prodRatio a) atTop (𝓝 L) := by
  have h_bdd : BddBelow (Set.range (prodRatio a)) := by
    use 0
    rintro x ⟨N, rfl⟩
    exact prod_ratio_nonneg a hGe2 N
  have h_anti := prod_ratio_antitone a hGe2
  have h_inf_ge : 0 ≤ iInf (prodRatio a) := by
    apply le_ciInf
    intro N
    exact prod_ratio_nonneg a hGe2 N
  exact ⟨iInf (prodRatio a), h_inf_ge, tendsto_atTop_ciInf h_anti h_bdd⟩
