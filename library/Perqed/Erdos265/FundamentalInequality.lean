import Mathlib
import Perqed.Erdos265.ProblemStatement
import Perqed.Erdos265.ResidualGrowthBound

open Filter Topology Finset

/-!
# The Fundamental Inequality of Erdős 265

This file establishes the absolute mathematical bound for any sequence 
satisfying the Erdős 265 dual rationality condition, completely independent 
of whether the sequence is greedy, sub-greedy, or an irregular oscillator.

We define the exact coupling variable $C_N = q_1 R_{shift}(N) P_1(N) - q_2 R_1(N) P_2(N)$
and prove its analytic series representation:
$C_N = q_1 q_2 P_1(N) P_2(N) \sum_{k=N}^\infty \frac{1}{a_k(a_k - 1)}$.

Because $C_N$ is formed from integer residuals, $C_N \in \mathbb{Z}$.
Because the sum is strictly positive, $C_N > 0$.
Thus, $C_N \ge 1$.

This yields the Fundamental Inequality:
$1 \le q_1 q_2 P_1(N) P_2(N) \sum_{k=N}^\infty \frac{1}{a_k(a_k - 1)}$
-/

noncomputable section

variable (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ)

def prefixProdUnshifted (N : ℕ) : ℝ := (range N).prod (fun i => (a i : ℝ))
def prefixProdShifted (N : ℕ) : ℝ := (range N).prod (fun i => ((a i : ℝ) - 1))

def residualUnshifted (p₁ : ℤ) (q₁ : ℕ) (N : ℕ) : ℝ := (q₁ : ℝ) * prefixProdUnshifted a N * (p₁ / q₁ - (range N).sum (fun i => 1 / (a i : ℝ)))
def residualShifted (p₂ : ℤ) (q₂ : ℕ) (N : ℕ) : ℝ := (q₂ : ℝ) * prefixProdShifted a N * (p₂ / q₂ - (range N).sum (fun i => 1 / ((a i : ℝ) - 1)))

def exactCouplingVal (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ := (q₁ : ℝ) * residualShifted a p₂ q₂ N * prefixProdUnshifted a N - (q₂ : ℝ) * residualUnshifted a p₁ q₁ N * prefixProdShifted a N

lemma exact_coupling_series_identity (N : ℕ) (_hq1 : q₁ > 0) (_hq2 : q₂ > 0)
    (hGe2 : ∀ k, a k ≥ 2)
    (hSum1 : HasSum (fun k => 1 / (a k : ℝ)) (p₁ / q₁))
    (hSum2 : HasSum (fun k => 1 / ((a k : ℝ) - 1)) (p₂ / q₂)) :
    exactCouplingVal a p₁ p₂ q₁ q₂ N = (q₁ : ℝ) * (q₂ : ℝ) * prefixProdUnshifted a N * prefixProdShifted a N * 
      ∑' k, (1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ))) := by
  unfold exactCouplingVal residualUnshifted residualShifted
  
  have h_sum1_eq : p₁ / q₁ - (range N).sum (fun i => 1 / (a i : ℝ)) = ∑' k, 1 / (a (k + N) : ℝ) := by
    have h_split := sum_add_tsum_nat_add N hSum1.summable
    linarith [hSum1.tsum_eq]
    
  have h_sum2_eq : p₂ / q₂ - (range N).sum (fun i => 1 / ((a i : ℝ) - 1)) = ∑' k, 1 / ((a (k + N) : ℝ) - 1) := by
    have h_split := sum_add_tsum_nat_add N hSum2.summable
    linarith [hSum2.tsum_eq]
    
  have h_alg : (q₁ : ℝ) * ((q₂ : ℝ) * prefixProdShifted a N * (p₂ / q₂ - (range N).sum (fun i => 1 / ((a i : ℝ) - 1)))) * prefixProdUnshifted a N -
               (q₂ : ℝ) * ((q₁ : ℝ) * prefixProdUnshifted a N * (p₁ / q₁ - (range N).sum (fun i => 1 / (a i : ℝ)))) * prefixProdShifted a N =
               (q₁ : ℝ) * (q₂ : ℝ) * prefixProdUnshifted a N * prefixProdShifted a N * 
                 ((p₂ / q₂ - (range N).sum (fun i => 1 / ((a i : ℝ) - 1))) - (p₁ / q₁ - (range N).sum (fun i => 1 / (a i : ℝ)))) := by ring
                 
  rw [h_alg, h_sum1_eq, h_sum2_eq]
  
  have h_tsum_sub : (∑' k, 1 / ((a (k + N) : ℝ) - 1)) - (∑' k, 1 / (a (k + N) : ℝ)) = 
                    ∑' k, (1 / ((a (k + N) : ℝ) - 1) - 1 / (a (k + N) : ℝ)) := by
    exact (tsum_sub (summable_nat_add_iff N |>.mpr hSum2.summable) (summable_nat_add_iff N |>.mpr hSum1.summable)).symm
    
  rw [h_tsum_sub]
  
  have h_term_eq : ∀ k, 1 / ((a (k + N) : ℝ) - 1) - 1 / (a (k + N) : ℝ) = 1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ)) := by
    intro k
    have ha_ge2 : a (k + N) ≥ 2 := hGe2 (k + N)
    have ha_real : (a (k + N) : ℝ) ≥ 2 := by exact_mod_cast ha_ge2
    have h_ne1 : (a (k + N) : ℝ) - 1 ≠ 0 := by linarith
    have h_ne2 : (a (k + N) : ℝ) ≠ 0 := by linarith
    exact div_sub_div 1 1 h_ne1 h_ne2 |>.trans (by ring_nf)
    
  have h_tsum_eq : (∑' (k : ℕ), (1 / ((a (k + N) : ℝ) - 1) - 1 / (a (k + N) : ℝ))) = ∑' (k : ℕ), 1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ)) := by
    congr 1
    ext k
    exact h_term_eq k
    
  rw [h_tsum_eq]

def prefixProdUnshiftedInt (a : ℕ → ℕ) (N : ℕ) : ℤ := (range N).prod (fun i => (a i : ℤ))
def prefixProdShiftedInt (a : ℕ → ℕ) (N : ℕ) : ℤ := (range N).prod (fun i => ((a i : ℤ) - 1))

def exactCouplingInt (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℤ :=
  (q₁ : ℤ) * tailResidual (fun k => a k - 1) p₂.toNat q₂ N * prefixProdUnshiftedInt a N -
  (q₂ : ℤ) * tailResidual a p₁.toNat q₁ N * prefixProdShiftedInt a N

theorem exact_coupling_recurrence (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) 
    (hGe2 : ∀ k, a k ≥ 2) :
    exactCouplingInt a p₁ p₂ q₁ q₂ (N + 1) = 
      (a N * (a N - 1) : ℤ) * exactCouplingInt a p₁ p₂ q₁ q₂ N - 
      (q₁ * q₂ : ℤ) * prefixProdUnshiftedInt a N * prefixProdShiftedInt a N := by
  unfold exactCouplingInt
  set X_N := (a N * (a N - 1) : ℤ)
  set R1_N := tailResidual a p₁.toNat q₁ N
  set R2_N := tailResidual (fun k => a k - 1) p₂.toNat q₂ N
  set P1_N := prefixProdUnshiftedInt a N
  set P2_N := prefixProdShiftedInt a N
  
  have hR1_succ : tailResidual a p₁.toNat q₁ (N + 1) = (a N : ℤ) * R1_N - (q₁ : ℤ) * P1_N := rfl
  have hR2_succ : tailResidual (fun k => a k - 1) p₂.toNat q₂ (N + 1) = (a N - 1 : ℤ) * R2_N - (q₂ : ℤ) * P2_N := by
    unfold tailResidual
    have h_sub : (fun k => a k - 1) N = a N - 1 := rfl
    rw [h_sub]
    push_cast
    have : prefixProduct (fun k => a k - 1) N = (range N).prod (fun i => a i - 1) := by
      induction' N with n ih
      · simp [prefixProduct]
      · simp [prefixProduct, ih, prod_range_succ]
    rw [this]
    rfl
    
  have hP1_succ : prefixProdUnshiftedInt a (N + 1) = P1_N * (a N : ℤ) := by
    unfold prefixProdUnshiftedInt
    rw [prod_range_succ]
    ring
    
  have hP2_succ : prefixProdShiftedInt a (N + 1) = P2_N * (a N - 1 : ℤ) := by
    unfold prefixProdShiftedInt
    rw [prod_range_succ]
    ring
    
  rw [hR1_succ, hR2_succ, hP1_succ, hP2_succ]
  
  calc
    (q₁ : ℤ) * ((a N - 1 : ℤ) * R2_N - (q₂ : ℤ) * P2_N) * (P1_N * (a N : ℤ)) -
    (q₂ : ℤ) * ((a N : ℤ) * R1_N - (q₁ : ℤ) * P1_N) * (P2_N * (a N - 1 : ℤ))
    _ = (q₁ * R2_N * P1_N * (a N * (a N - 1))) - (q₁ * q₂ * P1_N * P2_N * (a N)) -
        (q₂ * R1_N * P2_N * (a N * (a N - 1))) + (q₁ * q₂ * P1_N * P2_N * (a N - 1)) := by ring
    _ = (a N * (a N - 1)) * (q₁ * R2_N * P1_N - q₂ * R1_N * P2_N) -
        (q₁ * q₂ * P1_N * P2_N) * (a N - (a N - 1)) := by ring
    _ = (a N * (a N - 1)) * (q₁ * R2_N * P1_N - q₂ * R1_N * P2_N) -
        (q₁ * q₂ * P1_N * P2_N) * 1 := by ring
    _ = (a N * (a N - 1) : ℤ) * exactCouplingInt a p₁ p₂ q₁ q₂ N - 
        (q₁ * q₂ : ℤ) * prefixProdUnshiftedInt a N * prefixProdShiftedInt a N := by ring

lemma exact_coupling_int_ge_one (N : ℕ) (hq1 : q₁ > 0) (hq2 : q₂ > 0)
    (hp1 : p₁ > 0) (hp2 : p₂ > 0)
    (hGe2 : ∀ k, a k ≥ 2)
    (hSum1 : HasSum (fun k => 1 / (a k : ℝ)) (p₁ / q₁))
    (hSum2 : HasSum (fun k => 1 / ((a k : ℝ) - 1)) (p₂ / q₂)) :
    exactCouplingInt a p₁ p₂ q₁ q₂ N ≥ 1 := by
  have h_pos := exact_coupling_pos a p₁ p₂ q₁ q₂ N hq1 hq2 hGe2 hSum1 hSum2
  have h_eq := exact_coupling_eq_int a p₁ p₂ q₁ q₂ N hq1 hq2 hp1 hp2 hGe2 hSum1 hSum2
  rw [h_eq] at h_pos
  have h_int_pos : exactCouplingInt a p₁ p₂ q₁ q₂ N > 0 := by exact_mod_cast h_pos
  omega



