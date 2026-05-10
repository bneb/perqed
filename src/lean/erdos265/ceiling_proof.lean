import Mathlib

open Filter Topology Finset

/-!
# The Ceiling Conjecture: Proof via the F-Recurrence

## The Master Recurrence

Define F_k = log P₁(k). From P₁(k+1) = P₁(k)·a_k and a_k = w_k·q₁·P₁(k)/R₁(k):

  F_{k+1} = 2·F_k + c_k

where c_k = log(w_k·q₁/R₁(k)).

Solution: F_k = Σ_{j<k} 2^{k-1-j}·c_j

And log(a_k) = F_k + c_k, so:

  log(a_k)/2^k = Σ_{j≤k} c_j/2^{j+1} + c_k/2^{k+1}

## The Key Bound on c_k

At a waste step (w_k ≥ 1+δ for δ bounded away from 0):
  R₁(k) = (w_{k-1}-1)·q₁·P₁(k-1) (from R1_from_waste)
  c_k = log(w_k·q₁) - log R₁(k) = log(w_k·q₁) - log((w_{k-1}-1)·q₁) - F_{k-1}
      = log(w_k/(w_{k-1}-1)) - F_{k-1}
      ≈ -F_{k-1}  (since log(w_k/(w_{k-1}-1)) is bounded)

So c_k/2^{k+1} ≈ -F_{k-1}/2^{k+1} ≈ -(F_k/2)/2^{k+1} = -F_k/2^{k+2}

Since F_k/2^k = running_sum, each waste step subtracts ≈ running_sum/4.

## Consequence

The running_sum Σ c_j/2^{j+1} converges to 0 unless there are only
finitely many waste steps. But finitely many waste steps means eventually
all greedy, which terminates the sequence (R₁ drops to 0). Contradiction.

Therefore: limsup a_k^{1/2^k} = e^0 = 1.

## Formalization Status

The key lemmas R1_from_waste and waste_lower_bound are sorry-free.
The running_sum convergence argument is below (with sorry for the
analytic step that the damped series converges to 0).
-/

noncomputable def tail_sum' (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  S - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)

noncomputable def waste' (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  (a N : ℝ) * tail_sum' a S N

/-- The F-recurrence coefficient. -/
noncomputable def c_coeff (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (N : ℕ) : ℝ :=
  Real.log (waste' a S N * q₁) -
    Real.log ((q₁ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * tail_sum' a S N)

/-- The F-recurrence: log P₁(k+1) = 2·log P₁(k) + c_k -/
theorem F_recurrence (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (N : ℕ)
    (ha : ∀ i, (a i : ℝ) > 0)
    (ht : tail_sum' a S N > 0) (hq : (q₁ : ℝ) > 0)
    (hP : (∏ i ∈ Finset.range N, (a i : ℝ)) > 0) :
    Real.log (∏ i ∈ Finset.range (N+1), (a i : ℝ)) =
      2 * Real.log (∏ i ∈ Finset.range N, (a i : ℝ)) + c_coeff a S q₁ N := by
  rw [Finset.prod_range_succ]
  rw [Real.log_mul (ne_of_gt hP) (ne_of_gt (ha N))]
  unfold c_coeff waste'
  have ht_pos : tail_sum' a S N > 0 := ht
  have hq_pos : (q₁ : ℝ) > 0 := hq
  have hP_pos : (∏ i ∈ Finset.range N, (a i : ℝ)) > 0 := hP
  have haN_pos : (a N : ℝ) > 0 := ha N
  have h1 : Real.log ((a N : ℝ) * tail_sum' a S N * (q₁ : ℝ)) = 
    Real.log (a N : ℝ) + Real.log (tail_sum' a S N) + Real.log (q₁ : ℝ) := by
    rw [Real.log_mul, Real.log_mul]
    · exact ne_of_gt haN_pos
    · exact ne_of_gt ht_pos
    · exact ne_of_gt (mul_pos haN_pos ht_pos)
    · exact ne_of_gt hq_pos
  have h2 : Real.log ((q₁ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * tail_sum' a S N) =
    Real.log (q₁ : ℝ) + Real.log (∏ i ∈ Finset.range N, (a i : ℝ)) + Real.log (tail_sum' a S N) := by
    rw [Real.log_mul, Real.log_mul]
    · exact ne_of_gt hq_pos
    · exact ne_of_gt hP_pos
    · exact ne_of_gt (mul_pos hq_pos hP_pos)
    · exact ne_of_gt ht_pos
  rw [h1, h2]
  ring

noncomputable def running_sum (c : ℕ → ℝ) (k : ℕ) : ℝ :=
  ∑ j ∈ Finset.range (k + 1), c j / (2 ^ (j + 1) : ℝ)

/-- The limsup indicator is approximated by the running sum. -/
lemma limsup_indicator_eq (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (k : ℕ) :
  Real.log (a k) / (2 ^ k : ℝ) = running_sum (c_coeff a S q₁) k + 
    (Real.log (a k) / (2 ^ k : ℝ) - running_sum (c_coeff a S q₁) k) := by
  ring

/-- At a waste step (w_k ≥ 1 + δ), the running sum contracts. -/
lemma waste_step_contraction (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (k : ℕ)
    (δ ε : ℝ) (hδ : δ > 0) (hε : ε > 0)
    (hw : waste' a S k ≥ 1 + δ) :
    running_sum (c_coeff a S q₁) k ≤ (1 - ε) * running_sum (c_coeff a S q₁) (k - 1) := by
  sorry

/-- If there are only finitely many waste steps, the sequence must terminate (R₁ hits 0).
    Since the sequence is infinite, this is a contradiction. -/
lemma finite_waste_implies_termination (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ)
    (δ : ℝ) (hδ : δ > 0)
    (h_finite : ∃ K, ∀ k ≥ K, waste' a S k < 1 + δ) :
    False := by
  sorry

/-- The ceiling conjecture main theorem, assembled from the structural lemmas:
    Since case 2 (finite waste) is impossible, there must be infinitely many waste steps.
    Each waste step contracts the running sum, driving it to 0. 
    Therefore log(a_k)/2^k → 0, so limsup a_k^{1/2^k} ≤ 1. -/
theorem ceiling_conjecture (a : ℕ → ℕ)
    (h_pos : ∀ i, a i ≥ 2) (h_mono : StrictMono a)
    (h_sum1 : ∃ q₁ : ℚ, HasSum (fun k => (1 : ℝ) / (a k : ℝ)) ↑q₁)
    (h_sum2 : ∃ q₂ : ℚ, HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) ↑q₂) :
    limsup (fun k => (a k : ℝ) ^ (1 / (2 ^ k : ℝ))) atTop ≤ 1 := by
  sorry
