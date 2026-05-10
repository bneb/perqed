import Mathlib

open Filter Topology Finset

noncomputable def tail_sum' (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  S - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)

noncomputable def waste' (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  (a N : ℝ) * tail_sum' a S N

noncomputable def c_coeff (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (N : ℕ) : ℝ :=
  Real.log (waste' a S N * q₁) -
    Real.log ((q₁ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * tail_sum' a S N)

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
