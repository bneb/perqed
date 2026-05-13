import Mathlib
import problem_statement
import residual_growth_bound

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

def P1_N (N : ℕ) : ℝ := (range N).prod (fun i => (a i : ℝ))
def P2_N (N : ℕ) : ℝ := (range N).prod (fun i => ((a i : ℝ) - 1))

def R1_val (p₁ : ℤ) (q₁ : ℕ) (N : ℕ) : ℝ := (q₁ : ℝ) * P1_N a N * (p₁ / q₁ - (range N).sum (fun i => 1 / (a i : ℝ)))
def R2_val (p₂ : ℤ) (q₂ : ℕ) (N : ℕ) : ℝ := (q₂ : ℝ) * P2_N a N * (p₂ / q₂ - (range N).sum (fun i => 1 / ((a i : ℝ) - 1)))

def C_val (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ := (q₁ : ℝ) * R2_val a p₂ q₂ N * P1_N a N - (q₂ : ℝ) * R1_val a p₁ q₁ N * P2_N a N

lemma C_val_series_identity (N : ℕ) (hq1 : q₁ > 0) (hq2 : q₂ > 0)
    (hGe2 : ∀ k, a k ≥ 2)
    (hSum1 : HasSum (fun k => 1 / (a k : ℝ)) (p₁ / q₁))
    (hSum2 : HasSum (fun k => 1 / ((a k : ℝ) - 1)) (p₂ / q₂)) :
    C_val a p₁ p₂ q₁ q₂ N = (q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N * 
      ∑' k, (1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ))) := by
  unfold C_val R1_val R2_val
  
  have h_sum1_eq : p₁ / q₁ - (range N).sum (fun i => 1 / (a i : ℝ)) = ∑' k, 1 / (a (k + N) : ℝ) := by
    have h_split := sum_add_tsum_nat_add N hSum1.summable
    linarith [hSum1.tsum_eq]
    
  have h_sum2_eq : p₂ / q₂ - (range N).sum (fun i => 1 / ((a i : ℝ) - 1)) = ∑' k, 1 / ((a (k + N) : ℝ) - 1) := by
    have h_split := sum_add_tsum_nat_add N hSum2.summable
    linarith [hSum2.tsum_eq]
    
  have h_alg : (q₁ : ℝ) * ((q₂ : ℝ) * P2_N a N * (p₂ / q₂ - (range N).sum (fun i => 1 / ((a i : ℝ) - 1)))) * P1_N a N -
               (q₂ : ℝ) * ((q₁ : ℝ) * P1_N a N * (p₁ / q₁ - (range N).sum (fun i => 1 / (a i : ℝ)))) * P2_N a N =
               (q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N * 
                 ((p₂ / q₂ - (range N).sum (fun i => 1 / ((a i : ℝ) - 1))) - (p₁ / q₁ - (range N).sum (fun i => 1 / (a i : ℝ)))) := by ring
                 
  rw [h_alg, h_sum1_eq, h_sum2_eq]
  
  have h_tsum_sub : (∑' k, 1 / ((a (k + N) : ℝ) - 1)) - (∑' k, 1 / (a (k + N) : ℝ)) = 
                    ∑' k, (1 / ((a (k + N) : ℝ) - 1) - 1 / (a (k + N) : ℝ)) := by
    have h_sub_summable := Summable.sub (summable_nat_add_iff N |>.mpr hSum2.summable) (summable_nat_add_iff N |>.mpr hSum1.summable)
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

def P1_N_int (N : ℕ) : ℤ := (range N).prod (fun i => (a i : ℤ))
def P2_N_int (N : ℕ) : ℤ := (range N).prod (fun i => ((a i : ℤ) - 1))

def C_val_int (N : ℕ) : ℤ :=
  (q₁ : ℤ) * tailResidual (fun k => a k - 1) p₂.toNat q₂ N * P1_N_int a N -
  (q₂ : ℤ) * tailResidual a p₁.toNat q₁ N * P2_N_int a N

lemma P1_eq_prefixProduct (N : ℕ) : P1_N a N = (prefixProduct a N : ℝ) := by
  induction N with
  | zero => simp [P1_N, prefixProduct]
  | succ n ih =>
    unfold P1_N at *
    rw [prod_range_succ]
    unfold prefixProduct
    push_cast
    rw [ih]

lemma P2_eq_prefixProduct_shift (N : ℕ) (hGe2 : ∀ k, a k ≥ 2) : P2_N a N = (prefixProduct (fun k => a k - 1) N : ℝ) := by
  induction N with
  | zero => simp [P2_N, prefixProduct]
  | succ n ih =>
    unfold P2_N at *
    rw [prod_range_succ]
    unfold prefixProduct
    have ha_ge1 : a n ≥ 1 := by have := hGe2 n; omega
    have h_sub : (a n : ℝ) - 1 = ((a n - 1 : ℕ) : ℝ) := by
      exact_mod_cast (Nat.cast_sub (R := ℝ) ha_ge1).symm
    rw [h_sub, ih]
    push_cast
    rfl

lemma P1_int_eq (N : ℕ) : (P1_N_int a N : ℝ) = P1_N a N := by
  unfold P1_N_int P1_N
  push_cast
  rfl

lemma P2_int_eq (N : ℕ) (hGe2 : ∀ k, a k ≥ 2) : (P2_N_int a N : ℝ) = P2_N a N := by
  unfold P2_N_int P2_N
  push_cast
  rfl

lemma R1_val_eq_tailResidual (N : ℕ) (hq1 : q₁ > 0) (hp1 : p₁ > 0)
    (hGe2 : ∀ k, a k ≥ 2)
    (hSum1 : HasSum (fun k => 1 / (a k : ℝ)) (p₁ / q₁)) :
    R1_val a p₁ q₁ N = (tailResidual a p₁.toNat q₁ N : ℝ) := by
  have h_pos : ∀ k, a k > 0 := fun k => by have := hGe2 k; omega
  have h_sum1_eq : p₁ / q₁ - (range N).sum (fun i => 1 / (a i : ℝ)) = ∑' k, 1 / (a (k + N) : ℝ) := by
    have h_split := sum_add_tsum_nat_add N hSum1.summable
    linarith [hSum1.tsum_eq]
  unfold R1_val
  rw [h_sum1_eq]
  have h_p1_eq : (p₁.toNat : ℝ) = p₁ := by exact_mod_cast (Int.toNat_of_nonneg (by omega))
  have h_tail := tailResidual_eq_sum a p₁.toNat q₁ hSum1.summable (by
    rw [h_p1_eq]
    exact hSum1.tsum_eq
  ) h_pos (by omega) N
  have h_shift_eq : ∑' (k : ℕ), 1 / (a (N + k) : ℝ) = ∑' (k : ℕ), 1 / (a (k + N) : ℝ) := by
    congr 1
    ext k
    rw [add_comm]
  rw [h_shift_eq] at h_tail
  rw [P1_eq_prefixProduct a N]
  exact h_tail.symm

lemma R2_val_eq_tailResidual (N : ℕ) (hq2 : q₂ > 0) (hp2 : p₂ > 0)
    (hGe2 : ∀ k, a k ≥ 2)
    (hSum2 : HasSum (fun k => 1 / ((a k : ℝ) - 1)) (p₂ / q₂)) :
    R2_val a p₂ q₂ N = (tailResidual (fun k => a k - 1) p₂.toNat q₂ N : ℝ) := by
  have h_pos : ∀ k, a k - 1 > 0 := fun k => by have := hGe2 k; omega
  have h_sum2_eq : p₂ / q₂ - (range N).sum (fun i => 1 / ((a i : ℝ) - 1)) = ∑' k, 1 / ((a (k + N) : ℝ) - 1) := by
    have h_split := sum_add_tsum_nat_add N hSum2.summable
    linarith [hSum2.tsum_eq]
  unfold R2_val
  rw [h_sum2_eq]
  have h_p2_eq : (p₂.toNat : ℝ) = p₂ := by exact_mod_cast (Int.toNat_of_nonneg (by omega))

  have h_sum2_alt : HasSum (fun k => 1 / (((fun j => a j - 1) k : ℕ) : ℝ)) (p₂.toNat / (q₂ : ℝ)) := by
    have h_eq : (fun k => 1 / (((fun j => a j - 1) k : ℕ) : ℝ)) = (fun k => 1 / ((a k : ℝ) - 1)) := by
      ext k
      have ha_ge1 : a k ≥ 1 := by have := hGe2 k; omega
      exact_mod_cast (congrArg (fun x => 1 / x) (Nat.cast_sub (R := ℝ) ha_ge1).symm)
    rw [h_eq]
    have : ((p₂.toNat : ℝ) / q₂) = p₂ / q₂ := by
      rw [h_p2_eq]
    rw [this]
    exact hSum2

  have h_tail := tailResidual_eq_sum (fun k => a k - 1) p₂.toNat q₂ h_sum2_alt.summable h_sum2_alt.tsum_eq h_pos (by omega) N
  
  have h_shift_eq : ∑' (k : ℕ), 1 / (((fun j => a j - 1) (N + k) : ℕ) : ℝ) = ∑' (k : ℕ), 1 / ((a (k + N) : ℝ) - 1) := by
    congr 1
    ext k
    have ha_ge1 : a (k + N) ≥ 1 := by have := hGe2 (k + N); omega
    have h_idx : N + k = k + N := by omega
    have h_eq : (((a (k + N) - 1 : ℕ) : ℝ)) = (a (k + N) : ℝ) - 1 := by exact_mod_cast (Nat.cast_sub (R := ℝ) ha_ge1)
    rw [h_idx]
    rw [h_eq]
    
  rw [h_shift_eq] at h_tail
  have h_P2 : P2_N a N = (prefixProduct (fun k => a k - 1) N : ℝ) := P2_eq_prefixProduct_shift a N hGe2
  rw [h_P2]
  exact h_tail.symm

lemma C_val_eq_C_val_int (N : ℕ) (hq1 : q₁ > 0) (hq2 : q₂ > 0)
    (hp1 : p₁ > 0) (hp2 : p₂ > 0)
    (hGe2 : ∀ k, a k ≥ 2)
    (hSum1 : HasSum (fun k => 1 / (a k : ℝ)) (p₁ / q₁))
    (hSum2 : HasSum (fun k => 1 / ((a k : ℝ) - 1)) (p₂ / q₂)) :
    C_val a p₁ p₂ q₁ q₂ N = (C_val_int a p₁ p₂ q₁ q₂ N : ℝ) := by
  unfold C_val C_val_int
  push_cast
  have hp1_eq : P1_N a N = (P1_N_int a N : ℝ) := (P1_int_eq a N).symm
  have hp2_eq : P2_N a N = (P2_N_int a N : ℝ) := (P2_int_eq a N hGe2).symm
  have hr1_eq : R1_val a p₁ q₁ N = (tailResidual a p₁.toNat q₁ N : ℝ) := R1_val_eq_tailResidual a p₁ q₁ N hq1 hp1 hGe2 hSum1
  have hr2_eq : R2_val a p₂ q₂ N = (tailResidual (fun k => a k - 1) p₂.toNat q₂ N : ℝ) := R2_val_eq_tailResidual a p₂ q₂ N hq2 hp2 hGe2 hSum2
  simp only [hp1_eq, hp2_eq, hr1_eq, hr2_eq]

lemma C_val_pos (N : ℕ) (hq1 : q₁ > 0) (hq2 : q₂ > 0)
    (hGe2 : ∀ k, a k ≥ 2)
    (hSum1 : HasSum (fun k => 1 / (a k : ℝ)) (p₁ / q₁))
    (hSum2 : HasSum (fun k => 1 / ((a k : ℝ) - 1)) (p₂ / q₂)) :
    C_val a p₁ p₂ q₁ q₂ N > 0 := by
  have h_id := C_val_series_identity a p₁ p₂ q₁ q₂ N hq1 hq2 hGe2 hSum1 hSum2
  have hq1_real : (q₁ : ℝ) > 0 := by exact_mod_cast hq1
  have hq2_real : (q₂ : ℝ) > 0 := by exact_mod_cast hq2
  have hp1_pos : P1_N a N > 0 := by
    apply Finset.prod_pos
    intro i _
    have : a i ≥ 2 := hGe2 i
    exact_mod_cast (by omega : a i > 0)
  have hp2_pos : P2_N a N > 0 := by
    apply Finset.prod_pos
    intro i _
    have : a i ≥ 2 := hGe2 i
    have ha_real : (a i : ℝ) ≥ 2 := by exact_mod_cast this
    linarith
  have h_front_pos : (q₁ : ℝ) * (q₂ : ℝ) * P1_N a N * P2_N a N > 0 := by
    positivity
  have h_summable : Summable (fun k => 1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ))) := by
    have h_sub_summable := Summable.sub (summable_nat_add_iff N |>.mpr hSum2.summable) (summable_nat_add_iff N |>.mpr hSum1.summable)
    have h_eq : (fun k => 1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ))) = (fun k => 1 / ((a (k + N) : ℝ) - 1) - 1 / (a (k + N) : ℝ)) := by
      ext k
      have ha_ge2 : a (k + N) ≥ 2 := hGe2 (k + N)
      have ha_real : (a (k + N) : ℝ) ≥ 2 := by exact_mod_cast ha_ge2
      have h_ne1 : (a (k + N) : ℝ) - 1 ≠ 0 := by linarith
      have h_ne2 : (a (k + N) : ℝ) ≠ 0 := by linarith
      exact (div_sub_div 1 1 h_ne1 h_ne2 |>.trans (by ring_nf)).symm
    rw [h_eq]
    exact h_sub_summable
  have h_tsum_pos : ∑' k, (1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ))) > 0 := by
    have h_nonneg : ∀ k, 0 ≤ 1 / (((a (k + N) : ℝ) - 1) * (a (k + N) : ℝ)) := by
      intro k
      have ha_ge2 : a (k + N) ≥ 2 := hGe2 (k + N)
      have ha_real : (a (k + N) : ℝ) ≥ 2 := by exact_mod_cast ha_ge2
      have h_sub_pos : (a (k + N) : ℝ) - 1 > 0 := by linarith
      positivity
    have h_zero_pos : 0 < 1 / (((a (0 + N) : ℝ) - 1) * (a (0 + N) : ℝ)) := by
      have ha_ge2 : a (0 + N) ≥ 2 := hGe2 (0 + N)
      have ha_real : (a (0 + N) : ℝ) ≥ 2 := by exact_mod_cast ha_ge2
      have h_sub_pos : (a (0 + N) : ℝ) - 1 > 0 := by linarith
      positivity
    exact tsum_pos h_summable h_nonneg 0 h_zero_pos
  rw [h_id]
  exact mul_pos h_front_pos h_tsum_pos

lemma C_val_int_ge_1 (N : ℕ) (hq1 : q₁ > 0) (hq2 : q₂ > 0)
    (hp1 : p₁ > 0) (hp2 : p₂ > 0)
    (hGe2 : ∀ k, a k ≥ 2)
    (hSum1 : HasSum (fun k => 1 / (a k : ℝ)) (p₁ / q₁))
    (hSum2 : HasSum (fun k => 1 / ((a k : ℝ) - 1)) (p₂ / q₂)) :
    C_val_int a p₁ p₂ q₁ q₂ N ≥ 1 := by
  have h_pos := C_val_pos a p₁ p₂ q₁ q₂ N hq1 hq2 hGe2 hSum1 hSum2
  have h_eq := C_val_eq_C_val_int a p₁ p₂ q₁ q₂ N hq1 hq2 hp1 hp2 hGe2 hSum1 hSum2
  rw [h_eq] at h_pos
  have h_int_pos : C_val_int a p₁ p₂ q₁ q₂ N > 0 := by exact_mod_cast h_pos
  omega

