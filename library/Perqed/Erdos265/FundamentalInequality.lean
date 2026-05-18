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

def exactCouplingReal (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ := (q₁ : ℝ) * residualShifted a p₂ q₂ N * prefixProdUnshifted a N - (q₂ : ℝ) * residualUnshifted a p₁ q₁ N * prefixProdShifted a N

lemma exact_coupling_series_identity (N : ℕ) (_hq1 : q₁ > 0) (_hq2 : q₂ > 0)
    (hGe2 : ∀ k, a k ≥ 2)
    (hSum1 : HasSum (fun k => 1 / (a k : ℝ)) (p₁ / q₁))
    (hSum2 : HasSum (fun k => 1 / ((a k : ℝ) - 1)) (p₂ / q₂)) :
    exactCouplingReal a p₁ p₂ q₁ q₂ N = (q₁ : ℝ) * (q₂ : ℝ) * prefixProdUnshifted a N * prefixProdShifted a N * 
      ∑' k, (1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ))) := by
  unfold exactCouplingReal residualUnshifted residualShifted
  
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

lemma prefixProdUnshiftedInt_succ (a : ℕ → ℕ) (N : ℕ) :
  prefixProdUnshiftedInt a (N + 1) = prefixProdUnshiftedInt a N * (a N : ℤ) := by
  simp [prefixProdUnshiftedInt, prod_range_succ]

lemma prefixProdShiftedInt_succ (a : ℕ → ℕ) (N : ℕ) :
  prefixProdShiftedInt a (N + 1) = prefixProdShiftedInt a N * ((a N : ℤ) - 1) := by
  simp [prefixProdShiftedInt, prod_range_succ]

lemma prefixProduct_eq_unshiftedInt (a : ℕ → ℕ) (N : ℕ) :
  (prefixProduct a N : ℤ) = prefixProdUnshiftedInt a N := by
  induction N with
  | zero => rfl
  | succ N ih =>
    simp only [prefixProduct, prefixProdUnshiftedInt_succ]
    push_cast
    rw [ih]

lemma prefixProduct_eq_shiftedInt (a : ℕ → ℕ) (N : ℕ) (hGe2 : ∀ k, a k ≥ 2) :
  (prefixProduct (fun k => a k - 1) N : ℤ) = prefixProdShiftedInt a N := by
  induction N with
  | zero => rfl
  | succ N ih =>
    simp only [prefixProduct, prefixProdShiftedInt_succ]
    push_cast
    rw [ih]
    have h1 : 1 ≤ a N := by have := hGe2 N; omega
    have h_sub : ((a N - 1 : ℕ) : ℤ) = (a N : ℤ) - 1 := by exact Nat.cast_sub h1
    rw [h_sub]

theorem exact_coupling_recurrence (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) 
    (hGe2 : ∀ k, a k ≥ 2) :
    exactCouplingInt a p₁ p₂ q₁ q₂ (N + 1) = 
      (a N * (a N - 1) : ℤ) * exactCouplingInt a p₁ p₂ q₁ q₂ N - 
      (q₁ * q₂ : ℤ) * prefixProdUnshiftedInt a N * prefixProdShiftedInt a N := by
  unfold exactCouplingInt
  rw [prefixProdUnshiftedInt_succ, prefixProdShiftedInt_succ]
  have h_T1 : tailResidual a (Int.toNat p₁) q₁ (N + 1) = (a N : ℤ) * tailResidual a (Int.toNat p₁) q₁ N - (q₁ : ℤ) * (prefixProduct a N : ℤ) := rfl
  have h_T2 : tailResidual (fun k => a k - 1) (Int.toNat p₂) q₂ (N + 1) = ((a N - 1 : ℕ) : ℤ) * tailResidual (fun k => a k - 1) (Int.toNat p₂) q₂ N - (q₂ : ℤ) * (prefixProduct (fun k => a k - 1) N : ℤ) := rfl
  rw [h_T1, h_T2]
  have h_sub : ((a N - 1 : ℕ) : ℤ) = (a N : ℤ) - 1 := by exact Nat.cast_sub (by have := hGe2 N; omega)
  rw [h_sub]
  rw [prefixProduct_eq_unshiftedInt a N]
  rw [prefixProduct_eq_shiftedInt a N hGe2]
  push_cast
  ring

lemma tail_residual_alg_eq (seq : ℕ → ℕ) (num denom : ℕ) (hDenom : denom > 0) (hPos : ∀ k, seq k > 0) (N : ℕ) :
  (tailResidual seq num denom N : ℝ) = 
  (denom : ℝ) * (prefixProduct seq N : ℝ) * 
  ((num : ℝ) / (denom : ℝ) - (range N).sum (fun i => 1 / (seq i : ℝ))) := by
  induction' N with N ih
  · simp [tailResidual, prefixProduct]
    have hd : (denom : ℝ) ≠ 0 := by exact_mod_cast (ne_of_gt hDenom)
    exact (mul_div_cancel' (num : ℝ) hd).symm
  · simp [tailResidual, prefixProduct, sum_range_succ]
    push_cast
    rw [ih]
    have h_div : (fun x => (seq x : ℝ)⁻¹) = (fun x => 1 / (seq x : ℝ)) := by ext x; exact inv_eq_one_div _
    have h_div_n : ((seq N : ℝ)⁻¹) = 1 / (seq N : ℝ) := inv_eq_one_div _
    rw [h_div, h_div_n]
    have hs : (seq N : ℝ) ≠ 0 := by exact_mod_cast (ne_of_gt (hPos N))
    have h_cancel : (seq N : ℝ) * (1 / (seq N : ℝ)) = 1 := mul_one_div_cancel hs
    calc (seq N : ℝ) * ((denom : ℝ) * (prefixProduct seq N : ℝ) * ((num : ℝ) / (denom : ℝ) - (range N).sum fun i ↦ 1 / (seq i : ℝ))) - (denom : ℝ) * (prefixProduct seq N : ℝ)
      _ = (denom : ℝ) * (prefixProduct seq N : ℝ) * (seq N : ℝ) * ((num : ℝ) / (denom : ℝ) - (range N).sum fun i ↦ 1 / (seq i : ℝ)) - (denom : ℝ) * (prefixProduct seq N : ℝ) * 1 := by ring
      _ = (denom : ℝ) * (prefixProduct seq N : ℝ) * (seq N : ℝ) * ((num : ℝ) / (denom : ℝ) - (range N).sum fun i ↦ 1 / (seq i : ℝ)) - (denom : ℝ) * (prefixProduct seq N : ℝ) * ((seq N : ℝ) * (1 / (seq N : ℝ))) := by rw [h_cancel]
      _ = (denom : ℝ) * ((prefixProduct seq N : ℝ) * (seq N : ℝ)) * ((num : ℝ) / (denom : ℝ) - ((range N).sum (fun i ↦ 1 / (seq i : ℝ)) + 1 / (seq N : ℝ))) := by ring

lemma prefixProduct_eq_prod (seq : ℕ → ℕ) (N : ℕ) :
  (prefixProduct seq N : ℝ) = (range N).prod (fun i => (seq i : ℝ)) := by
  induction' N with N ih
  · simp [prefixProduct]
  · simp only [prefixProduct, prod_range_succ]
    push_cast
    rw [ih]

/-- 
  The exact coupling integer is ≥ 1. 

  This uses the bridge between `exactCouplingReal` (real) and `exactCouplingInt` (integer).
  The series identity shows `exactCouplingReal > 0`, and since it equals an integer, 
  that integer must be ≥ 1.
-/
lemma exact_coupling_int_ge_one (N : ℕ) (hq1 : q₁ > 0) (hq2 : q₂ > 0)
    (hp1 : p₁ > 0) (hp2 : p₂ > 0)
    (hGe2 : ∀ k, a k ≥ 2)
    (hSum1 : HasSum (fun k => 1 / (a k : ℝ)) (p₁ / q₁))
    (hSum2 : HasSum (fun k => 1 / ((a k : ℝ) - 1)) (p₂ / q₂)) :
    exactCouplingInt a p₁ p₂ q₁ q₂ N ≥ 1 := by
  have h_eq : exactCouplingReal a p₁ p₂ q₁ q₂ N = (exactCouplingInt a p₁ p₂ q₁ q₂ N : ℝ) := by
    dsimp only [exactCouplingReal, exactCouplingInt, residualUnshifted, residualShifted]
    have ha : ∀ k, a k > 0 := fun k => by have := hGe2 k; omega
    have ham1 : ∀ k, a k - 1 > 0 := fun k => by have := hGe2 k; omega
    have ht1 := tail_residual_alg_eq a p₁.toNat q₁ hq1 ha N
    have ht2 := tail_residual_alg_eq (fun k => a k - 1) p₂.toNat q₂ hq2 ham1 N
    have hp1_eq : ((p₁.toNat : ℝ) / (q₁ : ℝ)) = p₁ / q₁ := by
      have : (p₁.toNat : ℝ) = p₁ := by exact_mod_cast (Int.toNat_of_nonneg (le_of_lt hp1))
      rw [this]
    have hp2_eq : ((p₂.toNat : ℝ) / (q₂ : ℝ)) = p₂ / q₂ := by
      have : (p₂.toNat : ℝ) = p₂ := by exact_mod_cast (Int.toNat_of_nonneg (le_of_lt hp2))
      rw [this]
    have hP1 : (prefixProduct a N : ℝ) = prefixProdUnshifted a N := by
      dsimp [prefixProdUnshifted]
      exact prefixProduct_eq_prod a N
    have hP2 : (prefixProduct (fun k => a k - 1) N : ℝ) = prefixProdShifted a N := by
      dsimp [prefixProdShifted]
      have h_eq_prod := prefixProduct_eq_prod (fun k => a k - 1) N
      rw [h_eq_prod]
      apply Finset.prod_congr rfl
      intro i _
      have h1 : 1 ≤ a i := by have := hGe2 i; omega
      rw [Nat.cast_sub h1]
      push_cast
      rfl
    have hP1I : (prefixProdUnshiftedInt a N : ℝ) = prefixProdUnshifted a N := by
      dsimp [prefixProdUnshiftedInt, prefixProdUnshifted]
      push_cast
      rfl
    have hP2I : (prefixProdShiftedInt a N : ℝ) = prefixProdShifted a N := by
      dsimp [prefixProdShiftedInt, prefixProdShifted]
      push_cast
      rfl
    push_cast
    rw [ht1, ht2, hp1_eq, hp2_eq, hP1, hP2, hP1I, hP2I]
    have ha_sub : ∀ i, ((a i - 1 : ℕ) : ℝ) = (a i : ℝ) - 1 := fun i => by
      have h1 : 1 ≤ a i := by have := hGe2 i; omega
      rw [Nat.cast_sub h1]
      push_cast
      rfl
    simp_rw [ha_sub]
  -- Use the series identity to show exactCouplingReal > 0
  have h_series := @exact_coupling_series_identity a p₁ p₂ q₁ q₂ N hq1 hq2 hGe2 hSum1 hSum2
  have hq1_pos : (q₁ : ℝ) > 0 := by exact_mod_cast hq1
  have hq2_pos : (q₂ : ℝ) > 0 := by exact_mod_cast hq2
  have hP1_pos : prefixProdUnshifted a N > 0 := by
    simp only [prefixProdUnshifted]
    apply prod_pos
    intro i _
    have : a i ≥ 2 := hGe2 i
    exact_mod_cast (show (0 : ℕ) < a i by omega)
  have hP2_pos : prefixProdShifted a N > 0 := by
    simp only [prefixProdShifted]
    apply prod_pos
    intro i _
    have : (a i : ℝ) ≥ 2 := by exact_mod_cast hGe2 i
    linarith
  have hTail_pos : ∑' k, (1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ))) > 0 := by
    apply tsum_pos
    · apply Summable.of_nonneg_of_le
      · intro k
        apply div_nonneg one_pos.le
        have ha : (a (k + N) : ℝ) ≥ 2 := by exact_mod_cast hGe2 (k + N)
        apply mul_nonneg <;> linarith
      · intro k
        have ha : (a (k + N) : ℝ) ≥ 2 := by exact_mod_cast hGe2 (k + N)
        have h1 : ((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ) ≥ (a (k + N) : ℝ) := by nlinarith
        have h2 : (a (k + N) : ℝ) > 0 := by linarith
        have h3 : ((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ) ≥ (a (k + N) : ℝ) := by nlinarith
        exact one_div_le_one_div_of_le h2 h3
      · exact (summable_nat_add_iff N).mpr hSum1.summable
    · intro k
      apply div_nonneg one_pos.le
      have ha : (a (k + N) : ℝ) ≥ 2 := by exact_mod_cast hGe2 (k + N)
      apply mul_nonneg <;> linarith
    · apply div_pos one_pos
      have ha : (a (N) : ℝ) ≥ 2 := by exact_mod_cast hGe2 N
      have : (0 + N) = N := zero_add N
      rw [this]
      apply mul_pos <;> linarith
  have hVal_pos : exactCouplingReal a p₁ p₂ q₁ q₂ N > 0 := by
    rw [h_series]
    apply mul_pos (mul_pos (mul_pos (mul_pos hq1_pos hq2_pos) hP1_pos) hP2_pos) hTail_pos
  rw [h_eq] at hVal_pos
  have h_int_pos : exactCouplingInt a p₁ p₂ q₁ q₂ N > 0 := by exact_mod_cast hVal_pos
  omega

end
