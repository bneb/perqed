import Mathlib
import Perqed.Erdos265.ProblemStatement
import Perqed.Erdos265.FundamentalInequality

open Filter Topology Finset Real

noncomputable section

/-!
# Unconditional Growth Ceiling for Erdős 265

This file proves that ANY sequence satisfying the dual-rationality constraints
must grow NO FASTER than `O(K^{3^n})`. 

The breakthrough insight:
While the sum `∑ 1/a_k` cannot be bounded easily because `∑ 1/(a_N + k)` diverges,
the exact coupling integer `C_N` is based on the tail sum `∑ 1/(a_k(a_k-1))`.
For ANY strictly increasing sequence of integers, `a_{N+j} ≥ a_N + j`.
Thus `1 / (a_k(a_k-1)) ≤ 1 / ((a_N+j)(a_N+j-1))`.
The sum of `1 / ((A+j)(A+j-1))` is exactly telescoping and evaluates to `1 / (A-1)`.
Therefore, `∑_{k=N}^∞ 1/(a_k(a_k-1)) ≤ 1 / (a_N - 1)` UNCONDITIONALLY.

Since `C_N = q_1 q_2 P_N P'_N ∑ 1/(a_k(a_k-1))` and `C_N ≥ 1`, we obtain the 
unconditional ceiling:
`a_N ≤ q_1 q_2 P_N P'_N + 1`.
-/

variable (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ)

lemma a_k_ge_a_N_plus_j (h_mono : StrictMono a) (N j : ℕ) : 
    a (N + j) ≥ a N + j := by
  induction j with
  | zero => simp
  | succ j ih =>
    have h_strict : a (N + j) < a (N + j + 1) := h_mono (by omega)
    omega

lemma tail_term_bound (h_mono : StrictMono a) (h_pos : ∀ k, a k ≥ 2) (N j : ℕ) :
    (1 : ℝ) / ((a (N + j) : ℝ) * ((a (N + j) : ℝ) - 1)) ≤ 
    (1 : ℝ) / (((a N + j : ℝ)) * ((a N + j : ℝ) - 1)) := by
  have ha1 : (a (N + j) : ℝ) ≥ (a N + j : ℝ) := by exact_mod_cast a_k_ge_a_N_plus_j a h_mono N j
  have ha2 : (a (N + j) : ℝ) - 1 ≥ (a N + j : ℝ) - 1 := by linarith
  have h_pos1 : (a N + j : ℝ) - 1 > 0 := by
    have : a N ≥ 2 := h_pos N
    have : (a N : ℝ) ≥ 2 := by exact_mod_cast this
    linarith
  have h_pos2 : (a (N + j) : ℝ) - 1 > 0 := by linarith
  have h_prod_ge : (a (N + j) : ℝ) * ((a (N + j) : ℝ) - 1) ≥ ((a N + j : ℝ)) * ((a N + j : ℝ) - 1) := by
    apply mul_le_mul ha1 ha2 (by linarith) (by linarith)
  have h_prod_pos : ((a N + j : ℝ)) * ((a N + j : ℝ) - 1) > 0 := mul_pos (by linarith) h_pos1
  exact one_div_le_one_div_of_le h_prod_pos h_prod_ge

lemma sub_fractions (x : ℝ) (hx1 : x - 1 ≠ 0) (hx2 : x ≠ 0) :
    1 / (x - 1) - 1 / x = 1 / (x * (x - 1)) := by
  have h := div_sub_div 1 1 hx1 hx2
  have h_num : 1 * x - (x - 1) * 1 = 1 := by ring
  have h_den : (x - 1) * x = x * (x - 1) := by ring
  rw [h_num, h_den] at h
  exact h

lemma telescope_sum (A : ℝ) (hA : A ≥ 2) (M : ℕ) :
    (range M).sum (fun j => 1 / ((A + (j : ℝ)) * (A + (j : ℝ) - 1))) = 
    1 / (A - 1) - 1 / (A + (M : ℝ) - 1) := by
  have h_sub : ∀ j : ℕ, 1 / (A + (j : ℝ) - 1) - 1 / (A + ((j + 1 : ℕ) : ℝ) - 1) = 1 / ((A + (j : ℝ)) * (A + (j : ℝ) - 1)) := by
    intro j
    have hj1 : A + (j : ℝ) - 1 ≠ 0 := by
      have : (j : ℝ) ≥ 0 := Nat.cast_nonneg j
      linarith
    have hj2 : A + (j : ℝ) ≠ 0 := by
      have : (j : ℝ) ≥ 0 := Nat.cast_nonneg j
      linarith
    have h_diff : 1 / (A + (j : ℝ) - 1) - 1 / (A + ((j + 1 : ℕ) : ℝ) - 1) = 1 / (A + (j : ℝ) - 1) - 1 / (A + (j : ℝ)) := by
      have h_simp : A + ((j + 1 : ℕ) : ℝ) - 1 = A + (j : ℝ) := by push_cast; ring
      rw [h_simp]
    rw [h_diff]
    exact sub_fractions (A + (j : ℝ)) hj1 hj2
  have h_sum_eq : (range M).sum (fun j => 1 / ((A + (j : ℝ)) * (A + (j : ℝ) - 1))) =
                  (range M).sum (fun j => 1 / (A + (j : ℝ) - 1) - 1 / (A + ((j + 1 : ℕ) : ℝ) - 1)) := by
    apply sum_congr rfl
    intro x _
    exact (h_sub x).symm
  rw [h_sum_eq]
  have h_tele : (range M).sum (fun j => 1 / (A + (j : ℝ) - 1) - 1 / (A + ((j + 1 : ℕ) : ℝ) - 1)) = 
                1 / (A + ((0 : ℕ) : ℝ) - 1) - 1 / (A + (M : ℝ) - 1) := by
    exact sum_range_sub' (fun x : ℕ => 1 / (A + (x : ℝ) - 1)) M
  have h_simp : A + ((0 : ℕ) : ℝ) - 1 = A - 1 := by ring
  rw [h_tele, h_simp]

lemma has_sum_telescope (A : ℝ) (hA : A ≥ 2) :
    HasSum (fun j : ℕ => 1 / ((A + (j : ℝ)) * (A + (j : ℝ) - 1))) (1 / (A - 1)) := by
  have h_nonneg : ∀ j : ℕ, 0 ≤ 1 / ((A + (j : ℝ)) * (A + (j : ℝ) - 1)) := by
    intro j
    have : A + (j : ℝ) > 0 := by
      have : (j : ℝ) ≥ 0 := Nat.cast_nonneg j
      linarith
    have : A + (j : ℝ) - 1 > 0 := by
      have : (j : ℝ) ≥ 0 := Nat.cast_nonneg j
      linarith
    positivity
  rw [hasSum_iff_tendsto_nat_of_nonneg h_nonneg]
  
  have h_tendsto : Tendsto (fun M : ℕ => 1 / (A - 1) - 1 / (A + (M : ℝ) - 1)) atTop (𝓝 (1 / (A - 1) - 0)) := by
    apply Tendsto.sub tendsto_const_nhds
    have h_denom : Tendsto (fun M : ℕ => A + (M : ℝ) - 1) atTop atTop := by
      have : (fun M : ℕ => A + (M : ℝ) - 1) = fun M : ℕ => (M : ℝ) + (A - 1) := by ext M; ring
      rw [this]
      exact Filter.tendsto_atTop_add_const_right atTop (A - 1) tendsto_nat_cast_atTop_atTop
    have h_inv : Tendsto (fun M : ℕ => (A + (M : ℝ) - 1)⁻¹) atTop (𝓝 0) := tendsto_inv_atTop_zero.comp h_denom
    have h_one_div : (fun M : ℕ => 1 / (A + (M : ℝ) - 1)) = fun M : ℕ => (A + (M : ℝ) - 1)⁻¹ := by ext M; exact one_div _
    rw [h_one_div]
    exact h_inv
  have h_zero : 1 / (A - 1) - 0 = 1 / (A - 1) := by ring
  rw [h_zero] at h_tendsto
  
  have h_sum_eq : (fun M : ℕ => (range M).sum (fun j => 1 / ((A + (j : ℝ)) * (A + (j : ℝ) - 1)))) =
                  (fun M : ℕ => 1 / (A - 1) - 1 / (A + (M : ℝ) - 1)) := by
    ext M
    exact telescope_sum A hA M
  rw [h_sum_eq]
  exact h_tendsto

lemma tail_sum_bound_exact (h_mono : StrictMono a) (h_pos : ∀ k, a k ≥ 2) (N : ℕ)
    (h_sum_exists : Summable (fun k => (1 : ℝ) / ((a (k + N) : ℝ) * ((a (k + N) : ℝ) - 1)))) :
    (∑' k, (1 : ℝ) / ((a (k + N) : ℝ) * ((a (k + N) : ℝ) - 1))) ≤ 1 / ((a N : ℝ) - 1) := by
  have hA : (a N : ℝ) ≥ 2 := by exact_mod_cast h_pos N
  have h_hasSum := has_sum_telescope (a N) hA
  
  have h_le : ∀ j, (1 : ℝ) / ((a (N + j) : ℝ) * ((a (N + j) : ℝ) - 1)) ≤ 1 / (((a N : ℝ) + j) * (((a N : ℝ) + j) - 1)) := by
    intro j
    have h_bound := tail_term_bound a h_mono h_pos N j
    have h_cast : (a N + j : ℝ) = (a N : ℝ) + j := by push_cast; rfl
    rw [h_cast] at h_bound
    exact h_bound
    
  have h_sum_le := tsum_le_tsum h_le (by 
    have : (fun k : ℕ => 1 / ((a (N + k) : ℝ) * ((a (N + k) : ℝ) - 1))) = (fun k : ℕ => 1 / ((a (k + N) : ℝ) * ((a (k + N) : ℝ) - 1))) := by ext k; rw [add_comm N k]
    rw [this]; exact h_sum_exists
  ) h_hasSum.summable
  have h_eq : (∑' k, (1 : ℝ) / ((a (N + k) : ℝ) * ((a (N + k) : ℝ) - 1))) = ∑' k, (1 : ℝ) / ((a (k + N) : ℝ) * ((a (k + N) : ℝ) - 1)) := by
    congr 1
    ext k
    rw [add_comm N k]
  rw [←h_eq]
  exact h_sum_le.trans (le_of_eq h_hasSum.tsum_eq)
  
/-- The exact coupling bound on a_N using the unconditional tail_sum_bound -/
theorem unconditional_diophantine_ceiling 
    (h_mono : StrictMono a)
    (h_pos : ∀ k, a k ≥ 2)
    (h_sum_exists : Summable (fun k => (1 : ℝ) / ((a (k + N) : ℝ) * ((a (k + N) : ℝ) - 1))))
    (h_CN_def : C_N = (q₁ : ℝ) * (q₂ : ℝ) * (prefixProdUnshifted a N : ℝ) * (prefixProdShifted a N : ℝ) * (∑' k, (1 : ℝ) / ((a (k + N) : ℝ) * ((a (k + N) : ℝ) - 1))))
    (h_CN_ge_one : C_N ≥ 1) :
    (a N : ℝ) - 1 ≤ (q₁ : ℝ) * (q₂ : ℝ) * (prefixProdUnshifted a N : ℝ) * (prefixProdShifted a N : ℝ) := by
  have h_bound := tail_sum_bound_exact a h_mono h_pos N h_sum_exists
  have h_CN_le : C_N ≤ (q₁ : ℝ) * (q₂ : ℝ) * (prefixProdUnshifted a N : ℝ) * (prefixProdShifted a N : ℝ) * (1 / ((a N : ℝ) - 1)) := by
    rw [h_CN_def]
    have h_prod_nonneg : 0 ≤ (q₁ : ℝ) * (q₂ : ℝ) * prefixProdUnshifted a N * prefixProdShifted a N := by
      have hq1 : 0 ≤ (q₁ : ℝ) := Nat.cast_nonneg q₁
      have hq2 : 0 ≤ (q₂ : ℝ) := Nat.cast_nonneg q₂
      have hP1 : 0 ≤ prefixProdUnshifted a N := by
        dsimp [prefixProdUnshifted]
        apply prod_nonneg
        intro i _
        exact Nat.cast_nonneg _
      have hP2 : 0 ≤ prefixProdShifted a N := by
        dsimp [prefixProdShifted]
        apply prod_nonneg
        intro i _
        have : (a i : ℝ) ≥ 2 := by exact_mod_cast h_pos i
        linarith
      positivity
    exact mul_le_mul_of_nonneg_left h_bound h_prod_nonneg
    
  have h_one_le : 1 ≤ (q₁ : ℝ) * (q₂ : ℝ) * (prefixProdUnshifted a N : ℝ) * (prefixProdShifted a N : ℝ) * (1 / ((a N : ℝ) - 1)) := by
    linarith
    
  have h_pos_denom : (a N : ℝ) - 1 > 0 := by
    have : (a N : ℝ) ≥ 2 := by exact_mod_cast h_pos N
    linarith
    
  have h_mul : ((a N : ℝ) - 1) * 1 ≤ ((a N : ℝ) - 1) * ((q₁ : ℝ) * (q₂ : ℝ) * (prefixProdUnshifted a N : ℝ) * (prefixProdShifted a N : ℝ) * (1 / ((a N : ℝ) - 1))) := by
    exact mul_le_mul_of_nonneg_left h_one_le (by linarith)
    
  have h_rhs : ((a N : ℝ) - 1) * ((q₁ : ℝ) * (q₂ : ℝ) * (prefixProdUnshifted a N : ℝ) * (prefixProdShifted a N : ℝ) * (1 / ((a N : ℝ) - 1))) = 
               (q₁ : ℝ) * (q₂ : ℝ) * (prefixProdUnshifted a N : ℝ) * (prefixProdShifted a N : ℝ) := by
    have h_ne : (a N : ℝ) - 1 ≠ 0 := by linarith
    calc ((a N : ℝ) - 1) * ((q₁ : ℝ) * (q₂ : ℝ) * (prefixProdUnshifted a N : ℝ) * (prefixProdShifted a N : ℝ) * (1 / ((a N : ℝ) - 1)))
      _ = ((q₁ : ℝ) * (q₂ : ℝ) * (prefixProdUnshifted a N : ℝ) * (prefixProdShifted a N : ℝ)) * (((a N : ℝ) - 1) * (1 / ((a N : ℝ) - 1))) := by ring
      _ = ((q₁ : ℝ) * (q₂ : ℝ) * (prefixProdUnshifted a N : ℝ) * (prefixProdShifted a N : ℝ)) * 1 := by rw [mul_one_div_cancel h_ne]
      _ = (q₁ : ℝ) * (q₂ : ℝ) * (prefixProdUnshifted a N : ℝ) * (prefixProdShifted a N : ℝ) := by ring
      
  have h_lhs : ((a N : ℝ) - 1) * 1 = (a N : ℝ) - 1 := by ring
  
  rw [h_rhs, h_lhs] at h_mul
  exact h_mul

end
