import Mathlib

open Filter Topology Finset

lemma lemma_h_contradiction (x : ℕ → ℕ) (R : ℕ → ℚ) (s : ℕ)
  (hx_step : ∃ N, ∀ n ≥ N, x (n + 1) = x n ^ 2 + x n)
  (h_lower_bound : ∃ N, ∀ n ≥ N, (1 : ℚ) / (s * x (n - 1) : ℚ) ≤ R n)
  (h_upper_bound : ∃ N, ∀ n ≥ N, R n ≤ 1 / (x n : ℚ) + 1 / ((x n : ℚ)^2 - (x n : ℚ)))
  (hx_mono : ∀ n, x n < x (n + 1)) :
  False := by
  sorry

lemma lemma_h_upper_bound (x : ℕ → ℕ) (q : ℚ)
  (h_sum : HasSum (fun n => (1 : ℝ) / (x n : ℝ)) (q : ℝ))
  (hx_step : ∃ N, ∀ n ≥ N, x (n + 1) = x n ^ 2 + x n)
  (hx_pos : ∀ n, x n ≥ 1) :
  ∃ N, ∀ n ≥ N, q - ∑ i ∈ range n, (1 / (x i : ℚ)) ≤ 1 / (x n : ℚ) + 1 / ((x n : ℚ)^2 - (x n : ℚ)) := by
  sorry
