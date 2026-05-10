import Mathlib
import erdos265.erdos265_strict_target
import erdos265.beta2_boundary
import erdos265.negative_resolution

open Filter Topology Metric Set Finset

/-!
# Erdős Problem #265 — The Open Gap

This file identifies and decomposes the **actual open mathematical content**
needed to resolve Erdős Problem #265 (the ceiling conjecture).

## What is known (formalized in this project)

1. **`sylvester_shifted_irrational`** (`negative_resolution.lean`):
   If a sequence satisfies the exact Sylvester recurrence
   `a_{n+1} = a_n² - a_n + 1` with `a_n ≥ 2`, then `∑ 1/(a_n - 1)` is irrational.
   (This is the Erdős–Straus irrationality criterion.)

2. **`eventually_sylvester`** (`beta2_boundary.lean`):
   If a sequence satisfies `FastGrowth` (`a_{n+1} ≥ a_n² - a_n + 1` at every step)
   AND `∑ 1/a_n` is rational, then eventually the sequence satisfies the
   exact Sylvester recurrence.

3. **`no_fast_growing_erdos265`** (`beta2_boundary.lean`):
   Combining (1) and (2): no sequence satisfying `FastGrowth` can be an
   Erdős 265 sequence (i.e., have both sums rational).

## What is open

The ceiling conjecture asks: does every Erdős 265 sequence satisfy
`limsup a_k^{1/2^k} ≤ 1`?

## Strategy status

- **Strategy A** (limsup > 1 → eventual FastGrowth): Likely FALSE.
  A sparse-spike sequence refutes the pointwise implication.

- **Strategy C** (generalize Erdős–Straus): DEAD.
  Numerically verified FALSE at threshold α = 1.5.
  The denominator q_n² overwhelms a_{n+1} for any α below
  the Sylvester constant (~1.597). The Erdős–Straus criterion
  only uses ONE rationality condition; Problem 265 requires BOTH.

- **Strategy D** (contrapositive growth bound): Viable fallback.
  Uses only ∑ 1/aₖ rationality.

- **Strategy E** (coupled residual system): PRIMARY ATTACK.
  Uses BOTH rationality conditions simultaneously.
  This is the distinctive feature of Problem 265.
-/

-- ============================================================================
-- STRATEGY E: Coupled Residual System (PRIMARY ATTACK)
-- ============================================================================

/-!
## Strategy E: The Coupled Residual System

The defining feature of Problem 265 is that BOTH sums are rational:
  S₁ = ∑ 1/aₖ = p₁/q₁
  S₂ = ∑ 1/(aₖ-1) = p₂/q₂

This creates TWO integer residuals:
  R₁(N) = q₁ · ∏_{k<N} aₖ · (S₁ - partial_sum₁(N))  ∈ {1, ..., q₁}
  R_shift(N) = q₂ · ∏_{k<N}(aₖ-1) · (S₂ - partial_sum₂(N))  ∈ {1, ..., q₂}

Both satisfy recurrences driven by aₙ:
  R₁(N+1) = aₙ · R₁(N) - q₁ · P₁(N)
  R_shift(N+1) = (aₙ-1) · R_shift(N) - q₂ · P₂(N)

where P₁(N) = ∏_{k<N} aₖ, P₂(N) = ∏_{k<N}(aₖ-1).

**The coupling constraint**: Since both expressions give aₙ:
  aₙ = (R₁(N+1) + q₁·P₁(N)) / R₁(N)
  aₙ = 1 + (R_shift(N+1) + q₂·P₂(N)) / R_shift(N)

Equating:
  R_shift(N)·(R₁(N+1) + q₁·P₁(N)) - R₁(N)·(R_shift(N+1) + q₂·P₂(N)) = R₁(N)·R_shift(N)

This says:
  q₁·R_shift(N)·P₁(N) - q₂·R₁(N)·P₂(N) = R₁(N)·R_shift(N) - R_shift(N)·R₁(N+1) + R₁(N)·R_shift(N+1)

The LHS involves growing products P₁, P₂. The RHS is bounded (all R values ≤ max(q₁,q₂)).
So the LHS must also be bounded, which forces the ratio P₂/P₁ to track a specific rational.
-/

/-- The shifted residual R_shift(N) = q₂ · ∏(aₖ-1) · tail₂(N). -/
noncomputable def R_shift (a : ℕ → ℕ) (p₂ : ℤ) (q₂ : ℕ) (N : ℕ) : ℝ :=
  (q₂ : ℝ) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) *
    (↑p₂ / ↑q₂ - ∑ i ∈ Finset.range N, (1 : ℝ) / ((a i : ℝ) - 1))

/-- The shifted partial product P₂(N) = ∏_{k<N}(aₖ-1). -/
def P₂_N (a : ℕ → ℕ) (N : ℕ) : ℕ := ∏ i ∈ Finset.range N, (a i - 1)

-- ============================================================================
-- Sub-problem E.1: R_shift recurrence (analogous to R₁_recurrence)
-- ============================================================================

/-- R_shift satisfies: R_shift(N+1) = (aₙ-1) · R_shift(N) - q₂ · P₂(N). -/
theorem R_shift_recurrence (a : ℕ → ℕ) (p₂ : ℤ) (q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i ≥ 2) :
    R_shift a p₂ q₂ (N + 1) =
      ((a N : ℝ) - 1) * R_shift a p₂ q₂ N -
      (q₂ : ℝ) * ∏ i ∈ Finset.range N, ((a i : ℝ) - 1) := by
  unfold R_shift
  rw [prod_range_succ, sum_range_succ]
  have haN : (a N : ℝ) - 1 ≠ 0 := by
    have : (a N : ℝ) ≥ 2 := by exact_mod_cast h_pos N
    linarith
  calc
    (q₂ : ℝ) * ((∏ x ∈ Finset.range N, ((a x : ℝ) - 1)) * ((a N : ℝ) - 1)) *
        (↑p₂ / ↑q₂ - (∑ x ∈ Finset.range N, 1 / ((a x : ℝ) - 1) + 1 / ((a N : ℝ) - 1)))
    _ = ((a N : ℝ) - 1) * ((q₂ : ℝ) * (∏ x ∈ Finset.range N, ((a x : ℝ) - 1)) * (↑p₂ / ↑q₂ - ∑ x ∈ Finset.range N, 1 / ((a x : ℝ) - 1)))
        - (q₂ : ℝ) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) * (((a N : ℝ) - 1) * (1 / ((a N : ℝ) - 1))) := by ring
    _ = ((a N : ℝ) - 1) * ((q₂ : ℝ) * (∏ x ∈ Finset.range N, ((a x : ℝ) - 1)) * (↑p₂ / ↑q₂ - ∑ x ∈ Finset.range N, 1 / ((a x : ℝ) - 1)))
        - (q₂ : ℝ) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) * 1 := by rw [mul_one_div_cancel haN]
    _ = ((a N : ℝ) - 1) * ((q₂ : ℝ) * (∏ x ∈ Finset.range N, ((a x : ℝ) - 1)) * (↑p₂ / ↑q₂ - ∑ x ∈ Finset.range N, 1 / ((a x : ℝ) - 1)))
        - (q₂ : ℝ) * ∏ i ∈ Finset.range N, ((a i : ℝ) - 1) := by ring

-- ============================================================================
-- Sub-problem E.2: The Coupling Constraint (THE KEY NEW LEMMA)
-- ============================================================================

/--
**THE COUPLING IDENTITY** (new mathematical content).

The quantity C(N) = q₁·R_shift(N)·P₁(N) - q₂·R₁(N)·P₂(N) satisfies:
  C(N) = R₁(N)·R_shift(N) + R₁(N)·R_shift(N+1) - R_shift(N)·R₁(N+1)

This is derived by subtracting the two expressions for aₙ:
  aₙ = (R₁(N+1) + q₁·P₁(N)) / R₁(N)
  aₙ - 1 = (R_shift(N+1) + q₂·P₂(N)) / R_shift(N)

STATUS: Pure algebra. NOVELTY FLAG: known technique, new application.
-/
theorem coupling_identity (a : ℕ → ℕ) (p₁ : ℤ) (q₁ : ℕ) (p₂ : ℤ) (q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i ≥ 2) :
    (q₁ : ℝ) * (R_shift a p₂ q₂ N) * (∏ i ∈ Finset.range N, (a i : ℝ)) -
    (q₂ : ℝ) * (R₁ a p₁ q₁ N) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) =
    (R₁ a p₁ q₁ N) * (R_shift a p₂ q₂ N) +
    (R₁ a p₁ q₁ N) * (R_shift a p₂ q₂ (N + 1)) -
    (R_shift a p₂ q₂ N) * (R₁ a p₁ q₁ (N + 1)) := by
  -- Expand using recurrences:
  -- R₁(N+1) = aₙ·R₁(N) - q₁·P₁(N)   ⟹  q₁·P₁(N) = aₙ·R₁(N) - R₁(N+1)
  -- R_shift(N+1) = (aₙ-1)·R_shift(N) - q₂·P₂(N)  ⟹  q₂·P₂(N) = (aₙ-1)·R_shift(N) - R_shift(N+1)
  have h_pos' : ∀ i, a i > 0 := fun i => by have := h_pos i; omega
  have h_rec1 := R₁_recurrence a p₁ q₁ N h_pos'
  have h_rec2 := R_shift_recurrence a p₂ q₂ N h_pos
  -- From recurrences: q₁·P₁(N) = aₙ·R₁(N) - R₁(N+1)
  have h_q1P1 : (q₁ : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) =
    (a N : ℝ) * R₁ a p₁ q₁ N - R₁ a p₁ q₁ (N + 1) := by linarith
  -- q₂·P₂(N) = (aₙ-1)·R_shift(N) - R_shift(N+1)
  have h_q2P2 : (q₂ : ℝ) * ∏ i ∈ Finset.range N, ((a i : ℝ) - 1) =
    ((a N : ℝ) - 1) * R_shift a p₂ q₂ N - R_shift a p₂ q₂ (N + 1) := by linarith
  -- LHS = q₁·R_shift·P₁ - q₂·R₁·P₂
  --      = R_shift·(aₙ·R₁ - R₁(N+1)) - R₁·((aₙ-1)·R_shift - R_shift(N+1))
  --      = R_shift·aₙ·R₁ - R_shift·R₁(N+1) - R₁·aₙ·R_shift + R₁·R_shift + R₁·R_shift(N+1)
  --      = R₁·R_shift + R₁·R_shift(N+1) - R_shift·R₁(N+1) = RHS  ✓
  calc
    (q₁ : ℝ) * (R_shift a p₂ q₂ N) * (∏ i ∈ Finset.range N, (a i : ℝ)) -
    (q₂ : ℝ) * (R₁ a p₁ q₁ N) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1))
    _ = (R_shift a p₂ q₂ N) * ((a N : ℝ) * R₁ a p₁ q₁ N - R₁ a p₁ q₁ (N + 1)) -
        (R₁ a p₁ q₁ N) * (((a N : ℝ) - 1) * R_shift a p₂ q₂ N - R_shift a p₂ q₂ (N + 1)) := by
      rw [← h_q1P1, ← h_q2P2]; ring
    _ = (R₁ a p₁ q₁ N) * (R_shift a p₂ q₂ N) +
        (R₁ a p₁ q₁ N) * (R_shift a p₂ q₂ (N + 1)) -
        (R_shift a p₂ q₂ N) * (R₁ a p₁ q₁ (N + 1)) := by ring

-- ============================================================================
-- Sub-problem E.2b: Growth Constraint (corollary of recurrence)
-- ============================================================================

/--
**GROWTH CONSTRAINT**: aₙ is determined by R₁(N) and R₁(N+1).

From the R₁ recurrence: aₙ = (R₁(N+1) + q₁·P₁(N)) / R₁(N).
Since R₁(N+1) ∈ [1, q₁], this constrains aₙ to the interval
  [q₁·P₁(N)/R₁(N), (q₁·P₁(N) + q₁)/R₁(N)]
which has width q₁/R₁(N).

Similarly from R_shift: aₙ - 1 = (R_shift(N+1) + q₂·P₂(N)) / R_shift(N).

STATUS: Direct from recurrence. Sorry-free.
-/
theorem a_from_residual (a : ℕ → ℕ) (p₁ : ℤ) (q₁ : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i > 0)
    (h_ne : R₁ a p₁ q₁ N ≠ 0) :
    (a N : ℝ) = (R₁ a p₁ q₁ (N + 1) + (q₁ : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ)) /
      R₁ a p₁ q₁ N := by
  have h_rec := R₁_recurrence a p₁ q₁ N h_pos
  -- From R₁(N+1) = aₙ·R₁(N) - q₁·P₁(N), so aₙ·R₁(N) = R₁(N+1) + q₁·P₁(N)
  field_simp
  linarith

/-- aₙ - 1 = (R_shift(N+1) + q₂·P₂(N)) / R_shift(N). -/
theorem a_from_shift_residual (a : ℕ → ℕ) (p₂ : ℤ) (q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i ≥ 2)
    (h_ne : R_shift a p₂ q₂ N ≠ 0) :
    (a N : ℝ) - 1 = (R_shift a p₂ q₂ (N + 1) + (q₂ : ℝ) * ∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) /
      R_shift a p₂ q₂ N := by
  have h_rec := R_shift_recurrence a p₂ q₂ N h_pos
  field_simp
  linarith
/-
**COUPLED GROWTH CONSTRAINT**: The coupling identity + both recurrences
give a relationship between consecutive aₙ values.

From coupling_identity at N and N+1, we can derive:
  (a_{N+1} - 1) · R_shift(N) · R₁(N) = R₁(N) · R_shift(N+1) + q₂ · R₁(N) · P₂(N)
  aₙ · R₁(N) · R_shift(N) = R_shift(N) · R₁(N+1) + q₁ · R_shift(N) · P₁(N)

The ratio P₂(N+1)/P₁(N+1) = P₂(N)·(aₙ-1) / (P₁(N)·aₙ) = (P₂(N)/P₁(N)) · (aₙ-1)/aₙ.

Combined with the coupling identity, this gives a recurrence for the
ratio q₁·R_shift/R₁ which must remain consistent with P₂/P₁.

STATUS: This is the key structural insight. It shows that if aₙ grows
too fast (faster than Sylvester), the coupling identity is violated
because P₂/P₁ deviates from the ratio forced by R_shift/R₁.
-/

/--
**RATIO TRACKING**: The product ratio P₂(N)/P₁(N) satisfies a constraint
derived from the coupling identity. Specifically:

  q₁·R_shift(N) - q₂·R₁(N)·(P₂(N)/P₁(N)) = (bounded) / P₁(N)

This is the coupling identity divided by P₁(N). It shows that
P₂(N)/P₁(N) must approximate q₁·R_shift(N)/(q₂·R₁(N)) with
error O(1/P₁(N)), which vanishes as P₁(N) → ∞.

Since R₁ ∈ [1,q₁] and R_shift ∈ [1,q₂], the product ratio
can only approximate finitely many rational values.

STATUS: Sorry-free corollary of coupling_identity.
-/
theorem ratio_tracking (a : ℕ → ℕ) (p₁ : ℤ) (q₁ : ℕ) (p₂ : ℤ) (q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i ≥ 2)
    (hP1 : (∏ i ∈ Finset.range N, (a i : ℝ)) ≠ 0) :
    (q₁ : ℝ) * (R_shift a p₂ q₂ N) -
    (q₂ : ℝ) * (R₁ a p₁ q₁ N) *
      ((∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) / (∏ i ∈ Finset.range N, (a i : ℝ))) =
    ((R₁ a p₁ q₁ N) * (R_shift a p₂ q₂ N) +
     (R₁ a p₁ q₁ N) * (R_shift a p₂ q₂ (N + 1)) -
     (R_shift a p₂ q₂ N) * (R₁ a p₁ q₁ (N + 1))) /
    (∏ i ∈ Finset.range N, (a i : ℝ)) := by
  have h_ci := coupling_identity a p₁ q₁ p₂ q₂ N h_pos
  -- coupling_identity: q₁·R_shift·P₁ - q₂·R₁·P₂ = RHS
  -- Divide both sides by P₁:
  field_simp
  linarith

-- ============================================================================
-- Sub-problem E.2c: Pigeonhole on residual pairs
-- ============================================================================

/--
**PIGEONHOLE ON RESIDUAL PAIRS**: The pair (R₁(N), R_shift(N))
takes values in {1,...,q₁} × {1,...,q₂}, so it must repeat.

At the repeating indices M < N:
  R₁(M) = R₁(N) and R_shift(M) = R_shift(N)

From coupling_identity at both M and N:
  q₁·R_shift(M)·P₁(M) - q₂·R₁(M)·P₂(M) = C(M)  (bounded)
  q₁·R_shift(N)·P₁(N) - q₂·R₁(N)·P₂(N) = C(N)  (bounded)

Since R₁(M)=R₁(N) and R_shift(M)=R_shift(N):
  q₁·R_shift·(P₁(N) - P₁(M)) = q₂·R₁·(P₂(N) - P₂(M)) + O(q₁·q₂)

This constrains the GROWTH of P₁ and P₂ between the repeat indices.

STATUS: Pigeonhole step needs R₁ ∈ [1,q₁] (which has plumbing sorries).
        The coupling consequence is sorry-free once pigeonhole is given.
-/
theorem residual_pair_repeats (a : ℕ → ℕ) (p₁ : ℤ) (q₁ : ℕ) (p₂ : ℤ) (q₂ : ℕ)
    (h_pos : ∀ i, a i ≥ 2)
    (hR1_bdd : ∀ N, R₁ a p₁ q₁ N ∈ Set.Icc (1 : ℝ) q₁)
    (hRs_bdd : ∀ N, R_shift a p₂ q₂ N ∈ Set.Icc (1 : ℝ) q₂) :
    ∃ M N : ℕ, M < N ∧
      R₁ a p₁ q₁ M = R₁ a p₁ q₁ N ∧
      R_shift a p₂ q₂ M = R_shift a p₂ q₂ N := by
  sorry -- Pigeonhole on finite set {1,...,q₁}×{1,...,q₂}
  -- (needs integrality of R₁, R_shift which is in beta2_boundary)

/--
**COUPLING AT REPEAT**: When residual pairs repeat at M < N,
the coupling identity gives a constraint on the growth between M and N.

This is a direct subtraction of coupling_identity at N and M.

STATUS: Sorry-free given the two coupling identities.
-/
theorem coupling_at_repeat (a : ℕ → ℕ) (p₁ : ℤ) (q₁ : ℕ) (p₂ : ℤ) (q₂ : ℕ)
    (M N : ℕ) (h_pos : ∀ i, a i ≥ 2)
    (h_r1_eq : R₁ a p₁ q₁ M = R₁ a p₁ q₁ N)
    (h_rs_eq : R_shift a p₂ q₂ M = R_shift a p₂ q₂ N) :
    (q₁ : ℝ) * (R_shift a p₂ q₂ N) *
      ((∏ i ∈ Finset.range N, (a i : ℝ)) - ∏ i ∈ Finset.range M, (a i : ℝ)) =
    (q₂ : ℝ) * (R₁ a p₁ q₁ N) *
      ((∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) - ∏ i ∈ Finset.range M, ((a i : ℝ) - 1)) +
    ((R₁ a p₁ q₁ N) * (R_shift a p₂ q₂ (N + 1)) -
     (R_shift a p₂ q₂ N) * (R₁ a p₁ q₁ (N + 1))) -
    ((R₁ a p₁ q₁ M) * (R_shift a p₂ q₂ (M + 1)) -
     (R_shift a p₂ q₂ M) * (R₁ a p₁ q₁ (M + 1))) := by
  have hM := coupling_identity a p₁ q₁ p₂ q₂ M h_pos
  have hN := coupling_identity a p₁ q₁ p₂ q₂ N h_pos
  rw [h_r1_eq, h_rs_eq] at hM
  -- Now hN and hM both use R₁ at N and R_shift at N.
  -- hN: q₁·Rs·P1_N - q₂·R1·P2_N = R1·Rs + R1·Rs_{N+1} - Rs·R1_{N+1}
  -- hM: q₁·Rs·P1_M - q₂·R1·P2_M = R1·Rs + R1·Rs_{M+1} - Rs·R1_{M+1}
  have key : (q₁ : ℝ) * (R_shift a p₂ q₂ N) * (∏ i ∈ Finset.range N, (a i : ℝ)) -
      (q₂ : ℝ) * (R₁ a p₁ q₁ N) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) -
      ((q₁ : ℝ) * (R_shift a p₂ q₂ N) * (∏ i ∈ Finset.range M, (a i : ℝ)) -
       (q₂ : ℝ) * (R₁ a p₁ q₁ N) * (∏ i ∈ Finset.range M, ((a i : ℝ) - 1))) =
      (q₁ : ℝ) * (R_shift a p₂ q₂ N) *
        ((∏ i ∈ Finset.range N, (a i : ℝ)) - ∏ i ∈ Finset.range M, (a i : ℝ)) -
      (q₂ : ℝ) * (R₁ a p₁ q₁ N) *
        ((∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) - ∏ i ∈ Finset.range M, ((a i : ℝ) - 1)) := by ring
  -- hN - hM gives: (LHS_N - LHS_M) = (RHS_N - RHS_M)
  -- where LHS_N - LHS_M is factored by key
  -- and RHS_N - RHS_M is the goal's RHS (after the R₁·R_shift terms cancel via h_r1_eq, h_rs_eq)
  have diff_eq : (q₁ : ℝ) * (R_shift a p₂ q₂ N) * (∏ i ∈ Finset.range N, (a i : ℝ)) -
      (q₂ : ℝ) * (R₁ a p₁ q₁ N) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) -
      ((q₁ : ℝ) * (R_shift a p₂ q₂ N) * (∏ i ∈ Finset.range M, (a i : ℝ)) -
       (q₂ : ℝ) * (R₁ a p₁ q₁ N) * (∏ i ∈ Finset.range M, ((a i : ℝ) - 1))) =
      ((R₁ a p₁ q₁ N) * (R_shift a p₂ q₂ (N + 1)) -
       (R_shift a p₂ q₂ N) * (R₁ a p₁ q₁ (N + 1))) -
      ((R₁ a p₁ q₁ N) * (R_shift a p₂ q₂ (M + 1)) -
       (R_shift a p₂ q₂ N) * (R₁ a p₁ q₁ (M + 1))) := by linarith
  linarith
-- Sub-problem E.3: Growth bound from coupling (THE OPEN CORE)
-- ============================================================================

/--
**THE OPEN CORE**: The coupling constraint forces slow growth.

If the coupling C(N) = q₁·R_shift·P₁ - q₂·R₁·P₂ is bounded, then:

The ratio P₂(N)/P₁(N) = ∏(aₖ-1)/∏aₖ = ∏(1 - 1/aₖ)
must track q₁·R_shift(N) / (q₂·R₁(N)) up to O(1/P₁(N)) error.

Since R₁, R_shift take finitely many values, P₂/P₁ can only approximate
finitely many rationals. But P₂/P₁ = ∏(1 - 1/aₖ), and if aₖ grows
doubly exponentially, this product converges. The constraint forces
the partial products to "lock onto" a specific rational trajectory,
which constrains how fast aₖ can grow.

This is the GENUINELY OPEN mathematical content.
STATUS: UNSOLVED. This is where new ideas are needed.
-/
theorem coupling_forces_slow_growth
    (a : ℕ → ℕ) (h_erdos : Erdos265_Sequence a) :
    limsup (fun k => (a k : ℝ) ^ (1 / (2 ^ k : ℝ))) atTop ≤ 1 := by
  sorry -- THE OPEN PROBLEM

/-!
## Decomposition of E.3

Even if we can't solve E.3 directly, we can decompose it further:
-/

/--
**E.3a**: The product ratio ∏(1 - 1/aₖ) converges to a limit L.

For any sequence with ∑ 1/aₖ < ∞ (which follows from a_k ≥ 2
and strict monotonicity), the product ∏(1 - 1/aₖ) converges.
This is a standard result from infinite product theory.

STATUS: Known result, should be provable from Mathlib.
-/
theorem product_ratio_converges (a : ℕ → ℕ)
    (h_pos : ∀ n, a n ≥ 2) (h_mono : StrictMono a)
    (h_sum : ∃ q : ℚ, HasSum (fun k => (1 : ℝ) / (a k : ℝ)) ↑q) :
    ∃ L : ℝ, L > 0 ∧ Filter.Tendsto
      (fun N => ∏ i ∈ Finset.range N, (1 - 1 / (a i : ℝ)))
      atTop (nhds L) := by
  sorry -- Standard: convergent sum implies convergent product

/--
**E.3b**: The coupling forces R₁(N)·R_shift(N) ratio to stabilize.

From E.2 (coupling bounded) and E.3a (product converges):
  q₁·R_shift(N)/R₁(N) → q₂/L  as N → ∞

But R₁, R_shift ∈ ℤ ∩ [1, max(q₁,q₂)], so the ratio R_shift/R₁ takes
finitely many values. Thus for large enough N, R_shift(N)/R₁(N) is constant.

Combined with R₁ monotone decreasing (from beta2_boundary),
this forces BOTH R₁ and R_shift to eventually stabilize.

STATUS: This is new but follows from E.2 + E.3a. Not deep.
-/
theorem residuals_eventually_lock (a : ℕ → ℕ)
    (p₁ : ℤ) (q₁ : ℕ) (p₂ : ℤ) (q₂ : ℕ)
    (h_pos : ∀ i, a i ≥ 2) (hq1 : q₁ > 0) (hq2 : q₂ > 0)
    (h_sum1 : HasSum (fun k => (1 : ℝ) / (a k : ℝ)) (p₁ / q₁))
    (h_sum2 : HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) (p₂ / q₂))
    (h_fast : FastGrowth a) :
    ∃ N₀, ∀ N ≥ N₀, R₁ a p₁ q₁ (N + 1) = R₁ a p₁ q₁ N ∧
                     R_shift a p₂ q₂ (N + 1) = R_shift a p₂ q₂ N := by
  sorry -- From E.2 + E.3a + monotonicity

/-
**E.3c**: Locked residuals force exact Sylvester.

If BOTH R₁ and R_shift stabilize, then the two recurrences
together force a_{N+1} = a_N² - a_N + 1 (exact Sylvester).

But we already proved this for R₁ alone (`eventually_sylvester`).
The added value of R_shift locking is that it may work under WEAKER
growth assumptions than FastGrowth.

STATUS: For FastGrowth, follows from existing `eventually_sylvester`.
The open question is whether coupling extends this to non-FastGrowth. -/

-- ============================================================================
-- DEAD STRATEGIES (kept for reference)
-- ============================================================================

/-- Strategy A: Likely FALSE. See header. -/
theorem gap_strategy_A
    (a : ℕ → ℕ) (h_erdos : Erdos265_Sequence a)
    (h_lim : limsup (fun k => (a k : ℝ) ^ (1 / (2 ^ k : ℝ))) atTop > 1) :
    ∃ N₀, ∀ n, a (n + N₀ + 1) ≥ (a (n + N₀))^2 - a (n + N₀) + 1 := by
  sorry -- LIKELY FALSE

/-- Strategy C: DEAD. Erdős–Straus criterion too weak at threshold.
    See strategy_c_analysis.md for numerical proof. -/
theorem gap_strategy_C_shifted_sum
    (a : ℕ → ℕ)
    (h_pos : ∀ n, a n ≥ 2)
    (h_mono : StrictMono a)
    (α : ℝ) (hα : α > 1)
    (h_growth : ∀ᶠ k in atTop, (a k : ℝ) ≥ α ^ (2 ^ k : ℝ)) :
    ¬ ∃ (r : ℚ), HasSum (fun n => 1 / ((a n : ℝ) - 1)) (↑r) := by
  sorry -- DEAD: numerically FALSE for α = 1.5

/-- Strategy D: Viable fallback. Uses only ∑ 1/aₖ rationality. -/
theorem growth_bound_from_rationality
    (a : ℕ → ℕ) (h_erdos : Erdos265_Sequence a) :
    ∀ᶠ k in atTop, (a (k + 1) : ℝ) ≤ ((a k : ℝ) - 1)^2 + 1 := by
  sorry -- From residual arithmetic: a_{k+1} constrained by R₁ ∈ {1,...,q}
