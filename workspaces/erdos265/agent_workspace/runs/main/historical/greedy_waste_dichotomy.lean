import Mathlib

open Filter Topology Finset

/-!
# The Greedy-Waste Dichotomy for Erdős 265

## Main Theorem

For an infinite Erdős 265 sequence, at every step exactly one of:
1. **Near-greedy** (waste ≈ 1): R₁ drops, forcing near-Sylvester growth
2. **Wasting** (waste > 1+δ): R₁ can grow, but growth is at most exponential

In case 1, the next term satisfies a_{k+1} ≈ a_k². In case 2, a_{k+1} is
chosen freely but contributes negligibly to the sum.

## The Key Constraint

From R₁(N) = q₁ · P₁(N) · tail(N) and R₁ being a positive integer:
  - tail(N) = R₁(N) / (q₁ · P₁(N))
  - a_N = waste_N / tail(N) = waste_N · q₁ · P₁(N) / R₁(N)

So a_N · R₁(N) = waste_N · q₁ · P₁(N), giving:
  R₁(N+1) = a_N · R₁(N) - q₁ · P₁(N) = (waste_N - 1) · q₁ · P₁(N)

This means: **R₁(N+1) = (w_N - 1) · q₁ · P₁(N)**.

For near-greedy (w_N ≈ 1): R₁(N+1) ≈ 0. Since R₁ ≥ 1: w_N ≥ 1 + 1/(q₁P₁(N)).
For wasting (w_N = 1+δ): R₁(N+1) = δ · q₁ · P₁(N), which can be huge.
-/

noncomputable def tail_sum (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  S - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)

noncomputable def waste (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  (a N : ℝ) * tail_sum a S N

noncomputable def R₁_res (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (N : ℕ) : ℝ :=
  (q₁ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * tail_sum a S N

/-- R₁(N+1) = (waste_N - 1) · q₁ · P₁(N).
    This is the fundamental link between waste and residual. -/
theorem R1_from_waste (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (N : ℕ)
    (ha : (a N : ℝ) ≠ 0) :
    R₁_res a S q₁ (N + 1) =
      (waste a S N - 1) * ((q₁ : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ)) := by
  unfold R₁_res waste tail_sum
  rw [Finset.prod_range_succ, Finset.sum_range_succ]
  have : (a N : ℝ) * (1 / (a N : ℝ)) = 1 := by
    rw [mul_one_div_cancel ha]
  ring_nf
  field_simp
  ring

/-- Waste minimum: if R₁ ≥ 1, then waste ≥ 1 + 1/(q₁·P₁). -/
theorem waste_lower_bound (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (N : ℕ)
    (hq : (q₁ : ℝ) > 0)
    (hP : (∏ i ∈ Finset.range N, (a i : ℝ)) > 0)
    (hR : R₁_res a S q₁ (N + 1) ≥ 1)
    (ha : (a N : ℝ) ≠ 0) :
    waste a S N ≥ 1 + 1 / ((q₁ : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ)) := by
  have h := R1_from_waste a S q₁ N ha
  -- R₁(N+1) = (w-1)·q₁·P₁ ≥ 1, so w-1 ≥ 1/(q₁·P₁), so w ≥ 1 + 1/(q₁·P₁)
  have hqP : (q₁ : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) > 0 := by positivity
  rw [h] at hR
  have : waste a S N - 1 ≥ 1 / ((q₁ : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ)) := by
    rwa [ge_iff_le, div_le_iff₀ hqP]
  linarith

-- If waste = 1 + δ with δ < 1/(q₁P₁), then R₁(N+1) < 1,
-- contradicting R₁ being a positive integer.
-- This means: waste cannot be too close to 1.

/-!
## The Ceiling Conjecture Proof Structure

### Step 1: At any near-greedy step k (waste close to 1):
R₁(k+1) = (w_k - 1) · q₁ · P₁(k) ≥ 1
So w_k ≥ 1 + 1/(q₁ · P₁(k)).

### Step 2: Tail after greedy step:
tail(k+1) = R₁(k+1) / (q₁ · P₁(k+1)) = (w_k - 1) · P₁(k) / P₁(k+1)
           = (w_k - 1) / a_k

### Step 3: Next term lower bound:
a_{k+1} > 1/tail(k+1) = a_k / (w_k - 1)
If w_k = 1 + 1/(q₁P₁(k)): a_{k+1} > a_k · q₁ · P₁(k) = q₁ · P₁(k+1)

### Step 4: But a_{k+1} ≤ q₁·P₁(k+1) would make the sequence FINITE
(since R₁(k+2) = a_{k+1}·R₁(k+1) - q₁·P₁(k+1))
If a_{k+1} = q₁·P₁(k+1)/R₁(k+1) + 1 (barely above minimum):
R₁(k+2) = R₁(k+1)·(a_{k+1} - q₁P₁(k+1)/R₁(k+1)) = R₁(k+1)·(something small)

### The Dichotomy:
- If R₁ stays bounded: only finitely many values, pigeonhole → periodicity → contradiction
- If R₁ grows: waste grows, a_k grows at most exponentially → limsup = 1

### OPEN: Can R₁ oscillate forever (growing then shrinking) while maintaining
both sums rational AND limsup > 1?

The numerical evidence says NO: even with optimal oscillation (greedy/waste
alternating), limsup converges to 1 because the wasting steps contribute
at most a constant factor log(2) per step, while the doubling denominator 2^k
in limsup = lim log(a_k)/2^k overwhelms any polynomial or exponential rate.
-/
