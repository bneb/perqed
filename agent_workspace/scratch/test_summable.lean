import Mathlib

open Topology
open scoped BigOperators

def b : ℕ → ℕ
  | 0 => 2
  | n + 1 => b n * b n - b n + 1

lemma b_ge_two (n : ℕ) : 2 ≤ b n := sorry

lemma beta_term_pos (k : ℕ) : (0 : ℝ) < 1 / (b k + 1) := sorry

lemma beta_term_lt (k : ℕ) : (1 : ℝ) / (b k + 1) < (1 : ℝ) / (b k - 1) - (1 : ℝ) / (b (k + 1) - 1) := sorry

noncomputable def beta_n (n : ℕ) : ℝ :=
  ∑' k, if k ≥ n then (1 : ℝ) / (b k + 1) else 0

lemma sum_range_bound (n N : ℕ) :
  ∑ k ∈ Finset.range N, (if k ≥ n then (1 : ℝ) / (b k + 1) else 0) ≤ (1 : ℝ) / (b n - 1) := by
  sorry

lemma beta_n_summable (n : ℕ) (hn : n ≥ 1) : Summable (fun k => if k ≥ n then (1 : ℝ) / (b k + 1) else 0) := by
  apply summable_of_sum_range_le (c := (1 : ℝ) / (b n - 1))
  · intro k
    split_ifs
    · exact le_of_lt (beta_term_pos k)
    · rfl
  · exact sum_range_bound n

lemma beta_n_le (n : ℕ) (hn : n ≥ 1) : beta_n n ≤ (1 : ℝ) / (b n - 1) := by
  have h := beta_n_summable n hn
  exact tsum_le_of_sum_range_le h (sum_range_bound n)

lemma beta_n_bound (n : ℕ) (hn : n ≥ 1) : beta_n n < (1 : ℝ) / (b n - 1) := by
  -- beta_n n = 1 / (b n + 1) + beta_n (n + 1)
  -- beta_n (n + 1) <= 1 / (b (n + 1) - 1)
  -- So beta_n n <= 1 / (b n + 1) + 1 / (b (n + 1) - 1)
  -- And we know 1 / (b n + 1) + 1 / (b (n + 1) - 1) < 1 / (b n - 1)
  sorry
