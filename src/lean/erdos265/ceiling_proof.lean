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
  unfold c_coeff waste' tail_sum'
  -- log(P·a) = log P + log a = log P + [log(w·q₁) - log(q₁·P·tail)]
  -- = log P + log(a·tail·q₁) - log(q₁·P·tail)
  -- = log P + log(a) + log(tail) + log(q₁) - log(q₁) - log(P) - log(tail)
  -- = log(a). Correct (tautology).
  sorry -- Algebraic simplification of log terms

/-- The ceiling conjecture follows from:
    1. F_recurrence: log P₁ satisfies a linear recurrence with c_k
    2. c_k ≈ -F_{k-1} at waste steps (from R1_from_waste)
    3. The running sum Σ c_j/2^{j+1} converges to 0
    4. log(a_k)/2^k = running_sum + c_k/2^{k+1} → 0
    5. Therefore limsup a_k^{1/2^k} = 1 -/
theorem ceiling_conjecture_outline (a : ℕ → ℕ)
    (h_pos : ∀ i, a i ≥ 2) (h_mono : StrictMono a)
    (h_sum1 : ∃ q₁ : ℚ, HasSum (fun k => (1 : ℝ) / (a k : ℝ)) ↑q₁)
    (h_sum2 : ∃ q₂ : ℚ, HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) ↑q₂) :
    limsup (fun k => (a k : ℝ) ^ (1 / (2 ^ k : ℝ))) atTop ≤ 1 := by
  sorry -- Full proof requires:
        -- (a) Formalizing the running sum analysis
        -- (b) Showing waste steps dominate (only finitely many greedy runs)
        -- (c) Showing each waste step drives running_sum toward 0
        -- All ingredients are now identified and numerically verified.
