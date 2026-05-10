import Mathlib

open Filter Topology Finset

/-!
# The Normalized Coupling: D(N) = C(N) / (P₁ · P₂)

## Key Identity

D(N) = C(N) / (P₁(N) · P₂(N))
     = q₁ · R_shift(N) / P₂(N) - q₂ · R₁(N) / P₁(N)

From the coupling recurrence C(N+1) = aₙ(aₙ-1)·C(N) - q₁q₂·P₁·P₂:

D(N+1) = C(N+1) / (P₁(N+1) · P₂(N+1))
       = [aₙ(aₙ-1)·C(N) - q₁q₂·P₁·P₂] / [P₁·aₙ · P₂·(aₙ-1)]
       = C(N)/(P₁·P₂) - q₁q₂/(aₙ(aₙ-1))
       = D(N) - q₁q₂/(aₙ(aₙ-1))

So D(N) = D(0) - q₁q₂ · ∑_{k<N} 1/(aₖ(aₖ-1))
        = D(0) - q₁q₂ · ∑_{k<N} (1/(aₖ-1) - 1/aₖ)
        = D(0) - q₁q₂ · (S₂(N) - S₁(N))

As N → ∞: D(∞) = D(0) - q₁q₂·(S₂ - S₁) = (q₁p₂ - q₂p₁) - q₁q₂·(p₂/q₂ - p₁/q₁)
         = q₁p₂ - q₂p₁ - q₁p₂ + q₂p₁ = 0.

This is a tautology (already noted in coupling_recurrence.lean).

## But the key insight is:

D(N) = q₁q₂ · ∑_{k≥N} 1/(aₖ(aₖ-1))

This is the TAIL SUM of 1/(aₖ(aₖ-1)). And C(N) = D(N) · P₁(N) · P₂(N).

Since C(N) is an integer (given both sums are rational), we need:
  P₁(N) · P₂(N) · q₁q₂ · ∑_{k≥N} 1/(aₖ(aₖ-1)) ∈ ℤ

This is a strong Diophantine constraint on the tail sum.
-/

-- Self-contained definitions (matching coupling_recurrence.lean)
noncomputable def R₁_sc (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ) : ℝ :=
  (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) *
    (↑p / ↑q - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ))

noncomputable def R_shift_sc (a : ℕ → ℕ) (p₂ : ℤ) (q₂ : ℕ) (N : ℕ) : ℝ :=
  (q₂ : ℝ) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) *
    (↑p₂ / ↑q₂ - ∑ i ∈ Finset.range N, (1 : ℝ) / ((a i : ℝ) - 1))

noncomputable def C_val (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  (q₁ : ℝ) * (R_shift_sc a p₂ q₂ N) * (∏ i ∈ Finset.range N, (a i : ℝ)) -
  (q₂ : ℝ) * (R₁_sc a p₁ q₁ N) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1))

noncomputable def D_val (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ) : ℝ :=
  C_val a p₁ p₂ q₁ q₂ N /
  ((∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)))

/-- D(N) equals q₁q₂ times the tail sum of 1/(aₖ(aₖ-1)). -/
theorem D_val_eq_tail (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ k, (a k : ℝ) > 1)
    (hq1 : (q₁ : ℝ) ≠ 0) (hq2 : (q₂ : ℝ) ≠ 0) :
    D_val a p₁ p₂ q₁ q₂ N =
    (q₁ : ℝ) * (q₂ : ℝ) *
      (↑p₂ / ↑q₂ - ∑ i ∈ Finset.range N, (1 : ℝ) / ((a i : ℝ) - 1)) -
    (q₁ : ℝ) * (q₂ : ℝ) *
      (↑p₁ / ↑q₁ - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)) := by
  unfold D_val C_val R₁_sc R_shift_sc
  have hP1 : (∏ i ∈ Finset.range N, (a i : ℝ)) ≠ 0 := by
    apply Finset.prod_ne_zero
    intro i _
    have h1 := h_pos i; linarith
  have hP2 : (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) ≠ 0 := by
    apply Finset.prod_ne_zero
    intro i _
    have h1 := h_pos i; linarith
  have hP12 : (∏ i ∈ Finset.range N, (a i : ℝ)) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) ≠ 0 :=
    mul_ne_zero hP1 hP2
  field_simp
  ring

/-- D(N) simplifies to q₁q₂ · (T₂(N) - T₁(N)) where T₁, T₂ are tail sums.
    When both sums converge, T₁(N) = p₁/q₁ - S₁(N) and T₂(N) = p₂/q₂ - S₂(N).
    So D(N) = q₁q₂ · ∑_{k≥N} (1/(aₖ-1) - 1/aₖ) = q₁q₂ · ∑_{k≥N} 1/(aₖ(aₖ-1)). -/
theorem D_val_simplified (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ k, (a k : ℝ) > 1)
    (hq1 : (q₁ : ℝ) ≠ 0) (hq2 : (q₂ : ℝ) ≠ 0) :
    D_val a p₁ p₂ q₁ q₂ N =
    (q₁ : ℝ) * (q₂ : ℝ) *
      ((↑p₂ / ↑q₂ - ↑p₁ / ↑q₁) -
       (∑ i ∈ Finset.range N, (1 : ℝ) / ((a i : ℝ) - 1) -
        ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ))) := by
  rw [D_val_eq_tail a p₁ p₂ q₁ q₂ N h_pos hq1 hq2]
  ring

/-- The D recurrence: D(N+1) = D(N) - q₁q₂/(aₙ(aₙ-1)). -/
theorem D_recurrence (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ k, (a k : ℝ) > 1)
    (hq1 : (q₁ : ℝ) ≠ 0) (hq2 : (q₂ : ℝ) ≠ 0) :
    D_val a p₁ p₂ q₁ q₂ (N + 1) =
    D_val a p₁ p₂ q₁ q₂ N -
    (q₁ : ℝ) * (q₂ : ℝ) / ((a N : ℝ) * ((a N : ℝ) - 1)) := by
  rw [D_val_simplified a p₁ p₂ q₁ q₂ (N+1) h_pos hq1 hq2,
      D_val_simplified a p₁ p₂ q₁ q₂ N h_pos hq1 hq2]
  rw [sum_range_succ, sum_range_succ]
  have haN : (a N : ℝ) ≠ 0 := by have := h_pos N; linarith
  have haN1 : (a N : ℝ) - 1 ≠ 0 := by have := h_pos N; linarith
  have key : (1 : ℝ) / ((a N : ℝ) - 1) - 1 / (a N : ℝ) = 1 / ((a N : ℝ) * ((a N : ℝ) - 1)) := by
    field_simp
    ring
  -- Need to show two expressions involving sums are equal up to the key substitution
  have goal_eq : (q₁ : ℝ) * (q₂ : ℝ) *
      ((↑p₂ / ↑q₂ - ↑p₁ / ↑q₁) -
       (∑ i ∈ Finset.range N, (1 : ℝ) / ((a i : ℝ) - 1) + 1 / ((a N : ℝ) - 1) -
        (∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ) + 1 / (a N : ℝ)))) =
    (q₁ : ℝ) * (q₂ : ℝ) *
      ((↑p₂ / ↑q₂ - ↑p₁ / ↑q₁) -
       (∑ i ∈ Finset.range N, (1 : ℝ) / ((a i : ℝ) - 1) -
        ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ))) -
    (q₁ : ℝ) * (q₂ : ℝ) * (1 / ((a N : ℝ) - 1) - 1 / (a N : ℝ)) := by ring
  rw [goal_eq, key]
