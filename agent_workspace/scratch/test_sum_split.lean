import Mathlib

open Topology
open scoped BigOperators

def b : ℕ → ℕ
  | 0 => 2
  | n + 1 => b n * b n - b n + 1

lemma b_ge_two (n : ℕ) : 2 ≤ b n := sorry

lemma b_telescope (k : ℕ) : (1 : ℝ) / (b k - 1) - (1 : ℝ) / (b (k + 1) - 1) = (1 : ℝ) / b k := sorry

lemma beta_term_pos (k : ℕ) : (0 : ℝ) < 1 / (b k + 1) := by
  have hk : (0 : ℝ) < b k := by
    have h2 := b_ge_two k
    exact_mod_cast (by linarith : 0 < b k)
  positivity

lemma beta_term_lt (k : ℕ) : (1 : ℝ) / (b k + 1) < (1 : ℝ) / (b k - 1) - (1 : ℝ) / (b (k + 1) - 1) := by
  rw [b_telescope k]
  have hk : (0 : ℝ) < b k := by
    have h2 := b_ge_two k
    exact_mod_cast (by linarith : 0 < b k)
  have hk1 : (0 : ℝ) < b k + 1 := by linarith
  rw [div_lt_div_iff hk1 hk]
  linarith

lemma sum_range_shifted_strict_bound (n N : ℕ) :
  Finset.sum (Finset.range N) (fun k => (1 : ℝ) / (b (k + n) + 1)) ≤ (1 : ℝ) / (b n - 1) - (1 : ℝ) / (b (N + n) - 1) := by
  induction' N with N ih
  · simp
  · rw [Finset.sum_range_succ]
    have h_lt := beta_term_lt (N + n)
    have h_eq : N + n + 1 = N + 1 + n := by omega
    rw [h_eq] at h_lt
    linarith

lemma sum_range_shifted_bound (n N : ℕ) :
  Finset.sum (Finset.range N) (fun k => (1 : ℝ) / (b (k + n) + 1)) ≤ (1 : ℝ) / (b n - 1) := by
  have h_strict := sum_range_shifted_strict_bound n N
  have hb := b_ge_two (N + n)
  have hb_real : (2 : ℝ) ≤ b (N + n) := by exact_mod_cast hb
  have hd_pos : (0 : ℝ) < b (N + n) - 1 := by linarith
  have h_pos : (0 : ℝ) < 1 / (b (N + n) - 1) := by positivity
  linarith

lemma beta_n_summable (n : ℕ) : Summable (fun k => (1 : ℝ) / (b (k + n) + 1)) := by
  apply summable_of_sum_range_le (c := (1 : ℝ) / (b n - 1))
  · intro k
    exact le_of_lt (beta_term_pos (k + n))
  · exact sum_range_shifted_bound n

noncomputable def beta_n (n : ℕ) : ℝ :=
  ∑' (k : ℕ), (1 : ℝ) / (b (k + n) + 1)

lemma beta_n_pos (n : ℕ) : 0 < beta_n n := by
  have h_summable := beta_n_summable n
  exact tsum_pos h_summable (fun k => le_of_lt (beta_term_pos (k + n))) 0 (beta_term_pos (0 + n))

lemma beta_n_le (n : ℕ) : beta_n n ≤ (1 : ℝ) / (b n - 1) := by
  have h := beta_n_summable n
  exact tsum_le_of_sum_range_le h (sum_range_shifted_bound n)

noncomputable def S (n : ℕ) : ℝ :=
  Finset.sum (Finset.range n) (fun k => (1 : ℝ) / (b k + 1))

lemma sum_split (n : ℕ) : (∑' k, (1 : ℝ) / (b k + 1)) = S n + beta_n n := by
  have h_summable := beta_n_summable 0
  have h_eq : (fun k => (1 : ℝ) / (b (k + 0) + 1)) = (fun k => (1 : ℝ) / (b k + 1)) := by
    ext k
    rfl
  rw [h_eq] at h_summable
  have h_sum := sum_add_tsum_nat_add n h_summable
  exact h_sum.symm
