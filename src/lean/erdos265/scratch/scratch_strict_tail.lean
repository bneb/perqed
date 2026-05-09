import Mathlib

lemma primary_prod_bound (a : ℕ → ℕ) (N : ℕ)
  (h_warp : ∀ n, a (n + 1) ≥ (a n)^2 - a n + 1)
  (h_pos : ∀ n, a n ≥ 2) :
  ∏ i ∈ Finset.range N, a i ≤ a N - 1 := sorry

lemma telescoping_ineq (a : ℕ → ℕ) (n : ℕ)
  (h_warp : ∀ n, a (n + 1) ≥ (a n)^2 - a n + 1)
  (h_pos : ∀ n, a n ≥ 2) :
  1 / (a n : ℝ) ≤ 1 / ((a n : ℝ) - 1) - 1 / ((a (n + 1) : ℝ) - 1) := sorry

lemma partial_sum_bound (a : ℕ → ℕ) (N K : ℕ)
  (h_warp : ∀ n, a (n + 1) ≥ (a n)^2 - a n + 1)
  (h_pos : ∀ n, a n ≥ 2) :
  ∑ i ∈ Finset.range K, (1 / (a (i + N) : ℝ)) ≤ 1 / ((a N : ℝ) - 1) - 1 / ((a (K + N) : ℝ) - 1) := by
  induction K with
  | zero =>
    simp
  | succ k ih =>
    rw [Finset.sum_range_succ]
    have ht : 1 / (a (k + N) : ℝ) ≤ 1 / ((a (k + N) : ℝ) - 1) - 1 / ((a (k + 1 + N) : ℝ) - 1) := by
      have := telescoping_ineq a (k + N) h_warp h_pos
      have h_eq : a (k + 1 + N) = a (k + N + 1) := by congr 1; omega
      rw [h_eq]
      exact this
    linarith

-- The missing link for strict_tail_bound is using Summable and tsum
lemma summable_tail (a : ℕ → ℕ) (N : ℕ)
  (h_warp : ∀ n, a (n + 1) ≥ (a n)^2 - a n + 1)
  (h_pos : ∀ n, a n ≥ 2) :
  Summable (fun i => 1 / (a (i + N) : ℝ)) := by
  apply summable_of_sum_range_le (c := 1 / ((a N : ℝ) - 1))
  · intro n
    have : (a (n + N) : ℝ) ≥ 2 := by exact_mod_cast h_pos (n + N)
    have : (a (n + N) : ℝ) - 1 > 0 := by linarith
    positivity
  · intro n
    have := partial_sum_bound a N n h_warp h_pos
    have h_pos2 : 1 / ((a (n + N) : ℝ) - 1) ≥ 0 := by
      have : (a (n + N) : ℝ) ≥ 2 := by exact_mod_cast h_pos (n + N)
      have : (a (n + N) : ℝ) - 1 > 0 := by linarith
      positivity
    linarith

lemma tail_tsum_bound (a : ℕ → ℕ) (N : ℕ)
  (h_warp : ∀ n, a (n + 1) ≥ (a n)^2 - a n + 1)
  (h_pos : ∀ n, a n ≥ 2) :
  ∑' i, 1 / (a (i + N) : ℝ) ≤ 1 / ((a N : ℝ) - 1) := by
  apply Real.tsum_le_of_sum_range_le
  · intro n
    have : (a (n + N) : ℝ) ≥ 2 := by exact_mod_cast h_pos (n + N)
    have : (a (n + N) : ℝ) - 1 > 0 := by linarith
    positivity
  · intro n
    have := partial_sum_bound a N n h_warp h_pos
    have h_pos2 : 1 / ((a (n + N) : ℝ) - 1) ≥ 0 := by
      have : (a (n + N) : ℝ) ≥ 2 := by exact_mod_cast h_pos (n + N)
      have : (a (n + N) : ℝ) - 1 > 0 := by linarith
      positivity
    linarith

lemma strict_tail_bound_draft (a : ℕ → ℕ) (N : ℕ)
  (h_warp : ∀ n, a (n + 1) ≥ (a n)^2 - a n + 1)
  (h_pos : ∀ n, a n ≥ 2) :
  (∏ i ∈ Finset.range N, (a i : ℝ)) * ∑' i, (1 / (a (i + N) : ℝ)) ≤ 1 := by
  have h_prod : ∏ i ∈ Finset.range N, (a i : ℝ) ≤ (a N : ℝ) - 1 := by
    have h_bound := primary_prod_bound a N h_warp h_pos
    have h1 : ∏ i ∈ Finset.range N, (a i : ℝ) ≤ ((a N - 1 : ℕ) : ℝ) := by exact_mod_cast h_bound
    have h_sub_eq : ((a N - 1 : ℕ) : ℝ) = (a N : ℝ) - 1 := by
      rw [Nat.cast_sub (show 1 ≤ a N from by have := h_pos N; omega)]
      simp
    rw [h_sub_eq] at h1
    exact h1
  have h_sum := tail_tsum_bound a N h_warp h_pos
  have h_sum_nonneg : ∑' i, 1 / (a (i + N) : ℝ) ≥ 0 := by
    apply tsum_nonneg
    intro i
    have : (a (i + N) : ℝ) ≥ 2 := by exact_mod_cast h_pos (i + N)
    positivity
  have h_aN_pos : (a N : ℝ) - 1 ≥ 0 := by
    have : (a N : ℝ) ≥ 2 := by exact_mod_cast h_pos N
    linarith
  have h_aN_ne_zero : (a N : ℝ) - 1 ≠ 0 := by
    have : (a N : ℝ) ≥ 2 := by exact_mod_cast h_pos N
    linarith
  calc
    (∏ i ∈ Finset.range N, (a i : ℝ)) * ∑' i, 1 / (a (i + N) : ℝ)
      ≤ ((a N : ℝ) - 1) * ∑' i, 1 / (a (i + N) : ℝ) := mul_le_mul_of_nonneg_right h_prod h_sum_nonneg
    _ ≤ ((a N : ℝ) - 1) * (1 / ((a N : ℝ) - 1)) := mul_le_mul_of_nonneg_left h_sum h_aN_pos
    _ = 1 := mul_one_div_cancel h_aN_ne_zero
