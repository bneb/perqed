import Mathlib

open Filter Topology Finset

lemma rational_tail (x : ℕ → ℕ) (q : ℚ) (S R : ℕ → ℚ)
  (hx_pos : ∀ n, x n > 0)
  (h_S : ∀ n, S n = ∑ i ∈ range n, (1 / (x i : ℚ)))
  (h_R : ∀ n, R n = q - S n)
  (h_div : ∃ N, ∀ n ≥ N, ∀ k ∈ range n, x k ∣ x (n - 1)) :
  ∃ N, ∀ n ≥ N, ∃ c : ℤ, R n = c / (q.den * x (n - 1) : ℚ) := by
  sorry

lemma tail_pos (x : ℕ → ℕ) (q : ℚ) (S R : ℕ → ℚ)
  (hx_pos : ∀ n, x n > 0)
  (h_S : ∀ n, S n = ∑ i ∈ range n, (1 / (x i : ℚ)))
  (h_R : ∀ n, R n = q - S n)
  (h_sum : HasSum (fun n => (1 : ℝ) / (x n : ℝ)) (q : ℝ)) :
  ∀ n, R n > 0 := by
  sorry

lemma lower_bound (x : ℕ → ℕ) (q : ℚ) (S R : ℕ → ℚ)
  (hx_pos : ∀ n, x n > 0)
  (h_rat : ∃ N, ∀ n ≥ N, ∃ c : ℤ, R n = c / (q.den * x (n - 1) : ℚ))
  (h_pos : ∀ n, R n > 0) :
  ∃ N, ∀ n ≥ N, (1 : ℚ) / (q.den * x (n - 1) : ℚ) ≤ R n := by
  sorry
