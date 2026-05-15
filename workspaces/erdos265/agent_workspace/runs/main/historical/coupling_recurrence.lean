import Mathlib

open Filter Topology Metric Set Finset

/-!
# Strategy E.β: The Coupling Recurrence (Self-Contained)

## Key Result (numerically verified, algebraically derived)

C(N+1) = aₙ(aₙ-1) · C(N) - q₁q₂ · P₁(N) · P₂(N)

where C(N) = q₁·R_shift(N)·P₁(N) - q₂·R₁(N)·P₂(N).

The normalized D(N) = C(N)/(P₁·P₂) telescopes:
  D(N+1) = D(N) - q₁q₂/(aₙ(aₙ-1))

The limit D(∞) = 0 is a tautology, but the recurrence itself
and initial value D(0) = q₁p₂ - q₂p₁ are verified sorry-free.
-/

-- Self-contained definitions
noncomputable def R₁_sc (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ) : ℝ :=
  (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) *
    (↑p / ↑q - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ))

noncomputable def R_shift_sc (a : ℕ → ℕ) (p₂ : ℤ) (q₂ : ℕ) (N : ℕ) : ℝ :=
  (q₂ : ℝ) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) *
    (↑p₂ / ↑q₂ - ∑ i ∈ Finset.range N, (1 : ℝ) / ((a i : ℝ) - 1))

-- Recurrences
theorem R1_rec (a : ℕ → ℕ) (p : ℤ) (q : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i > 0) :
    R₁_sc a p q (N + 1) =
      (a N : ℝ) * R₁_sc a p q N - (q : ℝ) * ∏ i ∈ Finset.range N, (a i : ℝ) := by
  unfold R₁_sc
  rw [prod_range_succ, sum_range_succ]
  have haN : (a N : ℝ) ≠ 0 := by exact_mod_cast (h_pos N).ne'
  calc
    (q : ℝ) * ((∏ x ∈ Finset.range N, (a x : ℝ)) * (a N : ℝ)) *
        (↑p / ↑q - (∑ x ∈ Finset.range N, 1 / (a x : ℝ) + 1 / (a N : ℝ)))
    _ = (a N : ℝ) * ((q : ℝ) * (∏ x ∈ Finset.range N, (a x : ℝ)) * (↑p / ↑q - ∑ x ∈ Finset.range N, 1 / (a x : ℝ)))
        - (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * ((a N : ℝ) * (1 / (a N : ℝ))) := by ring
    _ = (a N : ℝ) * ((q : ℝ) * (∏ x ∈ Finset.range N, (a x : ℝ)) * (↑p / ↑q - ∑ x ∈ Finset.range N, 1 / (a x : ℝ)))
        - (q : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * 1 := by rw [mul_one_div_cancel haN]
    _ = _ := by ring

theorem Rshift_rec (a : ℕ → ℕ) (p₂ : ℤ) (q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i ≥ 2) :
    R_shift_sc a p₂ q₂ (N + 1) =
      ((a N : ℝ) - 1) * R_shift_sc a p₂ q₂ N -
      (q₂ : ℝ) * ∏ i ∈ Finset.range N, ((a i : ℝ) - 1) := by
  unfold R_shift_sc
  rw [prod_range_succ, sum_range_succ]
  have haN : (a N : ℝ) - 1 ≠ 0 := by
    have : (a N : ℝ) ≥ 2 := by exact_mod_cast h_pos N; linarith
  calc
    (q₂ : ℝ) * ((∏ x ∈ Finset.range N, ((a x : ℝ) - 1)) * ((a N : ℝ) - 1)) *
        (↑p₂ / ↑q₂ - (∑ x ∈ Finset.range N, 1 / ((a x : ℝ) - 1) + 1 / ((a N : ℝ) - 1)))
    _ = ((a N : ℝ) - 1) * ((q₂ : ℝ) * (∏ x ∈ Finset.range N, ((a x : ℝ) - 1)) * (↑p₂ / ↑q₂ - ∑ x ∈ Finset.range N, 1 / ((a x : ℝ) - 1)))
        - (q₂ : ℝ) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) * (((a N : ℝ) - 1) * (1 / ((a N : ℝ) - 1))) := by ring
    _ = ((a N : ℝ) - 1) * ((q₂ : ℝ) * (∏ x ∈ Finset.range N, ((a x : ℝ) - 1)) * (↑p₂ / ↑q₂ - ∑ x ∈ Finset.range N, 1 / ((a x : ℝ) - 1)))
        - (q₂ : ℝ) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) * 1 := by rw [mul_one_div_cancel haN]
    _ = _ := by ring

/--
**THE COUPLING RECURRENCE** (numerically verified with exact arithmetic):

  C(N+1) = aₙ(aₙ-1) · C(N) - q₁q₂ · P₁(N) · P₂(N)

This is a sorry-free algebraic identity.
-/
theorem coupling_recurrence (a : ℕ → ℕ) (p₁ : ℤ) (q₁ : ℕ) (p₂ : ℤ) (q₂ : ℕ) (N : ℕ)
    (h_pos : ∀ i, a i ≥ 2) :
    (q₁ : ℝ) * (R_shift_sc a p₂ q₂ (N + 1)) * (∏ i ∈ Finset.range (N + 1), (a i : ℝ)) -
    (q₂ : ℝ) * (R₁_sc a p₁ q₁ (N + 1)) * (∏ i ∈ Finset.range (N + 1), ((a i : ℝ) - 1)) =
    (a N : ℝ) * ((a N : ℝ) - 1) *
      ((q₁ : ℝ) * (R_shift_sc a p₂ q₂ N) * (∏ i ∈ Finset.range N, (a i : ℝ)) -
       (q₂ : ℝ) * (R₁_sc a p₁ q₁ N) * (∏ i ∈ Finset.range N, ((a i : ℝ) - 1))) -
    (q₁ : ℝ) * (q₂ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) *
      (∏ i ∈ Finset.range N, ((a i : ℝ) - 1)) := by
  have h_pos' : ∀ i, a i > 0 := fun i => by have := h_pos i; omega
  have h_rec1 := R1_rec a p₁ q₁ N h_pos'
  have h_rec2 := Rshift_rec a p₂ q₂ N h_pos
  rw [prod_range_succ, prod_range_succ]
  rw [h_rec1, h_rec2]
  ring

-- Initial values
lemma R1_sc_at_zero (a : ℕ → ℕ) (p₁ : ℤ) (q₁ : ℕ) (hq : q₁ > 0) :
    R₁_sc a p₁ q₁ 0 = (p₁ : ℝ) := by
  unfold R₁_sc
  simp [prod_range_zero, sum_range_zero]
  have hq_ne : (q₁ : ℝ) ≠ 0 := by exact_mod_cast (ne_of_gt hq)
  field_simp

lemma Rshift_sc_at_zero (a : ℕ → ℕ) (p₂ : ℤ) (q₂ : ℕ) (hq : q₂ > 0) :
    R_shift_sc a p₂ q₂ 0 = (p₂ : ℝ) := by
  unfold R_shift_sc
  simp [prod_range_zero, sum_range_zero]
  have hq_ne : (q₂ : ℝ) ≠ 0 := by exact_mod_cast (ne_of_gt hq)
  field_simp

-- D(0) = q₁p₂ - q₂p₁
lemma D_initial (a : ℕ → ℕ) (p₁ : ℤ) (q₁ : ℕ) (p₂ : ℤ) (q₂ : ℕ)
    (hq1 : q₁ > 0) (hq2 : q₂ > 0) :
    (q₁ : ℝ) * (R_shift_sc a p₂ q₂ 0) - (q₂ : ℝ) * (R₁_sc a p₁ q₁ 0) =
    (q₁ : ℝ) * (p₂ : ℝ) - (q₂ : ℝ) * (p₁ : ℝ) := by
  rw [R1_sc_at_zero a p₁ q₁ hq1, Rshift_sc_at_zero a p₂ q₂ hq2]
