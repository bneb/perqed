import Mathlib
import Perqed.Erdos265.ProblemStatement
import Perqed.Erdos265.FundamentalInequality
import Perqed.Erdos265.ResidualGrowthBound

open Filter Topology Finset Real

noncomputable section

/-!
# Diophantine Approximation for Erdős 265

This file explores the analytic number theory / Diophantine approximation 
approach to bounding the growth of sequences with rational reciprocal sums.

The core idea is Liouville's theorem for rational approximation:
A rational number p/q cannot be "too well" approximated by other rationals.
Specifically, if P/Q ≠ p/q, then |p/q - P/Q| ≥ 1 / (q * Q).

For a sequence a_n, the partial sum P_N / Q_N = ∑_{k<N} 1/a_k has denominator
Q_N = ∏_{k<N} a_k.
The error |p/q - P_N/Q_N| is exactly the tail sum S_N = ∑_{k≥N} 1/a_k.

Therefore, if S_N > 0, we must have S_N ≥ 1 / (q * ∏_{k<N} a_k).
Since S_N ≈ 1/a_N (for fast growing sequences), this gives an absolute upper 
bound on a_N in terms of the prefix product: a_N ≲ q * ∏_{k<N} a_k.
This physically prevents growth rates like L^{3^N}.
-/

variable (a : ℕ → ℕ) (p : ℤ) (q : ℕ)



/-- 
  The fundamental Diophantine gap.
  If the infinite series sums to p/q, and the sequence terms are positive,
  then the tail sum is lower-bounded by 1 / (q * ∏_{k<N} a_k).
-/
theorem diophantine_tail_bound (hq : q > 0) (hp : p > 0) (N : ℕ)
    (hGe2 : ∀ k, a k ≥ 2)
    (hSum : HasSum (fun k => (1 : ℝ) / (a k : ℝ)) (p / (q : ℝ))) :
    (∑' k, (1 : ℝ) / (a (k + N) : ℝ)) ≥ 1 / ((q : ℝ) * (prefixProdUnshifted a N : ℝ)) := by
  have hNum : p.toNat > 0 := by
    have h_eq : (p.toNat : ℤ) = p := Int.toNat_of_nonneg (le_of_lt hp)
    omega
  
  have ht_pos : tailResidual a p.toNat q N > 0 := by
    apply tailResidual_pos_inductive a p.toNat q hGe2
    · exact hNum
    · exact hq
    · have h_eq : (p.toNat : ℝ) = p := by exact_mod_cast (Int.toNat_of_nonneg (le_of_lt hp))
      rw [h_eq]
      exact hSum
  
  have hSum_val : ∑' k, 1 / (a k : ℝ) = (p.toNat : ℝ) / q := by
    have h_eq : (p.toNat : ℝ) = p := by exact_mod_cast (Int.toNat_of_nonneg (le_of_lt hp))
    rw [h_eq]
    exact hSum.tsum_eq

  have h_eq := tail_residual_eq_sum a p.toNat q hSum.summable hSum_val
    (fun k => by have := hGe2 k; omega) (by omega) N
  
  have ht_ge_1 : (tailResidual a p.toNat q N : ℝ) ≥ 1 := by
    have : tailResidual a p.toNat q N ≥ 1 := ht_pos
    exact_mod_cast this
  
  have h_prefix_eq : (prefixProduct a N : ℝ) = prefixProdUnshifted a N := by
    dsimp [prefixProdUnshifted]
    exact prefixProduct_eq_prod a N

  have h_denom_pos : (q : ℝ) > 0 := by exact_mod_cast hq
  have h_prefix_pos : (prefixProduct a N : ℝ) > 0 := by
    exact_mod_cast prefixProduct_pos a (fun k => by have := hGe2 k; omega) N
  
  have h_mul_pos : (q : ℝ) * (prefixProduct a N : ℝ) > 0 := mul_pos h_denom_pos h_prefix_pos
  
  have h_comm : (∑' (k : ℕ), 1 / (a (k + N) : ℝ)) = (∑' (k : ℕ), 1 / (a (N + k) : ℝ)) := by
    congr 1
    ext k
    rw [add_comm k N]

  rw [h_eq] at ht_ge_1
  
  have h_bound : 1 / ((q : ℝ) * (prefixProduct a N : ℝ)) ≤ ∑' (k : ℕ), 1 / (a (N + k) : ℝ) := by
    calc 1 / ((q : ℝ) * (prefixProduct a N : ℝ))
      _ = 1 * (1 / ((q : ℝ) * (prefixProduct a N : ℝ))) := by ring
      _ ≤ ((q : ℝ) * (prefixProduct a N : ℝ) * ∑' (k : ℕ), 1 / (a (N + k) : ℝ)) * (1 / ((q : ℝ) * (prefixProduct a N : ℝ))) := by
          apply mul_le_mul_of_nonneg_right ht_ge_1 (by positivity)
      _ = ∑' (k : ℕ), 1 / (a (N + k) : ℝ) := by
          rw [mul_comm, ← mul_assoc]
          have h_cancel : (1 / ((q : ℝ) * (prefixProduct a N : ℝ))) * ((q : ℝ) * (prefixProduct a N : ℝ)) = 1 :=
            div_mul_cancel 1 (ne_of_gt h_mul_pos)
          rw [h_cancel, one_mul]
  
  rw [h_prefix_eq] at h_bound
  rw [h_comm]
  exact h_bound

/--
  **The Absolute Growth Ceiling**
  
  If a sequence has a rational reciprocal sum, and its terms grow fast enough 
  such that the tail sum is bounded by the telescoping bound `1 / (a_N - 1)` 
  (which is true for any sequence satisfying `a_{k+1} ≥ a_k^2 - a_k + 1`), 
  then the terms are absolutely bounded by the Diophantine gap.
  
  Specifically, `a_N ≤ q * ∏_{k<N} a_k + 1`.
  
  This prevents any sequence from maintaining a double-exponential growth rate
  with exponent `c > 2` (e.g. `K^{3^N}`), because `q * ∏_{k<N} a_k` only grows 
  at exponent `2^N`.
-/
theorem fast_growth_ceiling (hq : q > 0) (hp : p > 0) (N : ℕ)
    (hGe2 : ∀ k, a k ≥ 2)
    (hSum : HasSum (fun k => (1 : ℝ) / (a k : ℝ)) (p / (q : ℝ)))
    (hFast : (∑' k, (1 : ℝ) / (a (k + N) : ℝ)) ≤ 1 / ((a N : ℝ) - 1)) :
    (a N : ℝ) ≤ (q : ℝ) * (prefixProdUnshifted a N : ℝ) + 1 := by
  have h_gap := diophantine_tail_bound a p q hq hp N hGe2 hSum
  have h_squeeze := le_trans h_gap hFast
  
  have h_denom_pos : (q : ℝ) > 0 := by exact_mod_cast hq
  have h_prefix_pos : (prefixProduct a N : ℝ) > 0 := by
    exact_mod_cast prefixProduct_pos a (fun k => by have := hGe2 k; omega) N
  have h_qP_pos : (q : ℝ) * (prefixProdUnshifted a N : ℝ) > 0 := by
    have h_prefix_eq : (prefixProduct a N : ℝ) = prefixProdUnshifted a N := by
      dsimp [prefixProdUnshifted]
      exact prefixProduct_eq_prod a N
    rw [← h_prefix_eq]
    exact mul_pos h_denom_pos h_prefix_pos
    
  have h_aN_pos : (a N : ℝ) - 1 > 0 := by
    have : a N ≥ 2 := hGe2 N
    have h2 : (a N : ℝ) ≥ 2 := by exact_mod_cast this
    linarith

  have h_inv := (one_div_le_one_div h_qP_pos h_aN_pos).mp h_squeeze
  linarith

end

section Entrypoints

/-!
## Honest Entrypoints from Erdős 265 Problem Statement

These theorems connect the Diophantine machinery directly to the 
`Erdos265Sequence` and `DualRational` definitions.
-/

/--
  **UNCONDITIONAL — Erdős 265 Diophantine Lower Bound**
  
  For any sequence satisfying the Erdős 265 baseline (a_k ≥ 2, ∑ 1/a_k ∈ ℚ),
  the tail sum is bounded below by 1/(q · ∏_{k<N} a_k) where q is the 
  denominator of the rational sum.
  
  This is a purely number-theoretic fact: rational numbers cannot be too well 
  approximated by their partial sums.
  
  **No hypotheses beyond the Erdős 265 baseline.**
-/
theorem erdos265_diophantine_lower_bound (a : ℕ → ℕ) (h : Erdos265Sequence a) (N : ℕ) :
    ∃ (q : ℕ), q > 0 ∧ 
    (∑' k, (1 : ℝ) / (a (k + N) : ℝ)) ≥ 1 / ((q : ℝ) * (prefixProdUnshifted a N : ℝ)) := by
  obtain ⟨hGe2, ⟨r, hSum⟩⟩ := h
  use r.den
  constructor
  · exact r.den_pos
  · have hp : r.num > 0 := by
      have hq_pos : (r : ℝ) > 0 := by
        have hSummable := hSum.summable
        have h_nonneg : ∀ k, (0 : ℝ) ≤ (1 : ℝ) / (a k : ℝ) := fun k => by positivity
        have h0_pos : (0 : ℝ) < (1 : ℝ) / (a 0 : ℝ) := by
          apply div_pos zero_lt_one
          have : a 0 ≥ 2 := hGe2 0
          exact_mod_cast (show (0 : ℕ) < a 0 by omega)
        have h_tsum_pos : (0 : ℝ) < ∑' k, (1 : ℝ) / (a k : ℝ) := 
          tsum_pos hSummable h_nonneg 0 h0_pos
        rw [hSum.tsum_eq] at h_tsum_pos
        exact h_tsum_pos
      exact_mod_cast (Rat.num_pos.mpr (by exact_mod_cast hq_pos))
    have hSum_cast : HasSum (fun k => (1 : ℝ) / (a k : ℝ)) (r.num / (r.den : ℝ)) := by
      have : (r : ℝ) = (r.num : ℝ) / (r.den : ℝ) := by
        rw [Rat.cast_def]
      rw [this] at hSum
      exact hSum
    exact diophantine_tail_bound a r.num r.den r.den_pos hp N hGe2 hSum_cast

/--
  **CONDITIONAL — Erdős 265 Growth Ceiling**
  
  For any Erdős 265 sequence, IF the tail sum decays fast enough that 
  `∑_{k≥N} 1/a_k ≤ 1/(a_N - 1)` at index N (which holds when the sequence 
  is in the greedy regime or grows at least doubly-exponentially), 
  THEN `a_N ≤ q · ∏_{k<N} a_k + 1`.
  
  **OPEN HYPOTHESIS**: `hFast` is NOT unconditionally discharged. 
  It holds for greedy sequences (where we already have a stronger result)
  and for sequences with `a_{k+1} ≥ a_k² - a_k + 1`, but it is not known 
  to hold for all sequences with `limsup > 1`.
  
  This theorem should be read as: "Fast growth + rational sum → bounded by 
  prefix product." The remaining gap is proving that `limsup > 1` forces 
  the fast-decay tail condition.
-/
theorem erdos265_growth_ceiling (a : ℕ → ℕ) (h : Erdos265Sequence a) (N : ℕ)
    (hFast : (∑' k, (1 : ℝ) / (a (k + N) : ℝ)) ≤ 1 / ((a N : ℝ) - 1)) :
    ∃ (q : ℕ), q > 0 ∧ 
    (a N : ℝ) ≤ (q : ℝ) * (prefixProdUnshifted a N : ℝ) + 1 := by
  obtain ⟨hGe2, ⟨r, hSum⟩⟩ := h
  use r.den
  constructor
  · exact r.den_pos
  · have hp : r.num > 0 := by
      have hq_pos : (r : ℝ) > 0 := by
        have hSummable := hSum.summable
        have h_nonneg : ∀ k, (0 : ℝ) ≤ (1 : ℝ) / (a k : ℝ) := fun k => by positivity
        have h0_pos : (0 : ℝ) < (1 : ℝ) / (a 0 : ℝ) := by
          apply div_pos zero_lt_one
          have : a 0 ≥ 2 := hGe2 0
          exact_mod_cast (show (0 : ℕ) < a 0 by omega)
        have h_tsum_pos : (0 : ℝ) < ∑' k, (1 : ℝ) / (a k : ℝ) := 
          tsum_pos hSummable h_nonneg 0 h0_pos
        rw [hSum.tsum_eq] at h_tsum_pos
        exact h_tsum_pos
      exact_mod_cast (Rat.num_pos.mpr (by exact_mod_cast hq_pos))
    have hSum_cast : HasSum (fun k => (1 : ℝ) / (a k : ℝ)) (r.num / (r.den : ℝ)) := by
      have : (r : ℝ) = (r.num : ℝ) / (r.den : ℝ) := by
        rw [Rat.cast_def]
      rw [this] at hSum
      exact hSum
    exact fast_growth_ceiling a r.num r.den r.den_pos hp N hGe2 hSum_cast hFast

end Entrypoints
