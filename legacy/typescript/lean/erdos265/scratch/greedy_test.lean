import Mathlib

open Filter Topology Finset

noncomputable def tail_sum' (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  S - ∑ i ∈ Finset.range N, (1 : ℝ) / (a i : ℝ)

noncomputable def waste' (a : ℕ → ℕ) (S : ℝ) (N : ℕ) : ℝ :=
  (a N : ℝ) * tail_sum' a S N

noncomputable def R₁ (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (N : ℕ) : ℝ :=
  (q₁ : ℝ) * (∏ i ∈ Finset.range N, (a i : ℝ)) * tail_sum' a S N

theorem R1_from_waste (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (k : ℕ)
    (ha : (a k : ℝ) ≠ 0) :
    R₁ a S q₁ (k + 1) =
      (waste' a S k - 1) * ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) := by
  unfold R₁ waste' tail_sum'
  rw [Finset.prod_range_succ, Finset.sum_range_succ]
  have h1 : (a k : ℝ) * (1 / (a k : ℝ)) = 1 := mul_one_div_cancel ha
  calc
    (q₁ : ℝ) * ((∏ i ∈ Finset.range k, (a i : ℝ)) * (a k : ℝ)) * (S - (∑ i ∈ Finset.range k, 1 / (a i : ℝ) + 1 / (a k : ℝ)))
      = (q₁ : ℝ) * (∏ i ∈ Finset.range k, (a i : ℝ)) * ((a k : ℝ) * (S - ∑ i ∈ Finset.range k, 1 / (a i : ℝ)) - (a k : ℝ) * (1 / (a k : ℝ))) := by ring
    _ = (q₁ : ℝ) * (∏ i ∈ Finset.range k, (a i : ℝ)) * ((a k : ℝ) * (S - ∑ i ∈ Finset.range k, 1 / (a i : ℝ)) - 1) := by rw [h1]
    _ = ((a k : ℝ) * (S - ∑ i ∈ Finset.range k, 1 / (a i : ℝ)) - 1) * ((q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ)) := by ring

lemma greedy_implies_R1_nonincreasing (a : ℕ → ℕ) (S : ℝ) (q₁ : ℕ) (k : ℕ)
    (ha_pos : (a k : ℝ) > 0)
    (ha_ge2 : (a k : ℝ) ≥ 2)
    (hq_pos : (q₁ : ℝ) > 0)
    (hP_pos : (∏ i ∈ Finset.range k, (a i : ℝ)) > 0)
    (hw : waste' a S k ≤ 1 + 1 / ((a k : ℝ) - 1)) :
    R₁ a S q₁ (k + 1) ≤ R₁ a S q₁ k := by
  have ha_neq : (a k : ℝ) ≠ 0 := ne_of_gt ha_pos
  have hR_next := R1_from_waste a S q₁ k ha_neq
  rw [hR_next]
  unfold R₁ waste' at *
  -- We want to prove: (a_k * tail - 1) * q_1 * P <= q_1 * P * tail
  -- Divide by q_1 * P: a_k * tail - 1 <= tail
  -- tail * (a_k - 1) <= 1
  -- Which is equivalent to tail <= 1 / (a_k - 1)
  -- And we are given hw: a_k * tail <= 1 + 1 / (a_k - 1) = a_k / (a_k - 1)
  have hqP : (q₁ : ℝ) * ∏ i ∈ Finset.range k, (a i : ℝ) > 0 := mul_pos hq_pos hP_pos
  have hw_mul : ((a k : ℝ) * tail_sum' a S k) * ((a k : ℝ) - 1) ≤ (1 + 1 / ((a k : ℝ) - 1)) * ((a k : ℝ) - 1) := by
    exact mul_le_mul_of_nonneg_right hw (by linarith)
  have h_rhs : (1 + 1 / ((a k : ℝ) - 1)) * ((a k : ℝ) - 1) = (a k : ℝ) := by
    calc
      (1 + 1 / ((a k : ℝ) - 1)) * ((a k : ℝ) - 1) = ((a k : ℝ) - 1) + 1 / ((a k : ℝ) - 1) * ((a k : ℝ) - 1) := by ring
      _ = ((a k : ℝ) - 1) + 1 := by rw [div_mul_cancel₀ _ (by linarith)]
      _ = (a k : ℝ) := by ring
  rw [h_rhs] at hw_mul
  have h_tail_mul : tail_sum' a S k * ((a k : ℝ) - 1) ≤ 1 := by
    nlinarith
  nlinarith
