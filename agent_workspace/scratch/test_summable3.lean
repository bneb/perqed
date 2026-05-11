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

lemma sum_range_strict_bound (n N : ℕ) (h : n ≤ N) :
  Finset.sum (Finset.Ico n N) (fun k => (1 : ℝ) / (b k + 1)) ≤ (1 : ℝ) / (b n - 1) - (1 : ℝ) / (b N - 1) := by
  induction' N, h using Nat.le_induction with k hk ih
  · simp
  · rw [Finset.sum_Ico_succ_top hk]
    have h_lt := beta_term_lt k
    linarith

lemma sum_range_bound (n N : ℕ) :
  Finset.sum (Finset.range N) (fun k => if k ≥ n then (1 : ℝ) / (b k + 1) else 0) ≤ (1 : ℝ) / (b n - 1) := by
  rcases le_or_lt N n with hle | hlt
  · have h_zero : Finset.sum (Finset.range N) (fun k => if k ≥ n then (1 : ℝ) / (b k + 1) else 0) = 0 := by
      apply Finset.sum_eq_zero
      intro x hx
      have hx_lt : x < n := by
        have : x < N := Finset.mem_range.mp hx
        omega
      rw [if_neg (by omega)]
    rw [h_zero]
    have hb := b_ge_two n
    have hb_real : (2 : ℝ) ≤ b n := by exact_mod_cast hb
    have hb_pos : (0 : ℝ) < b n - 1 := by linarith
    positivity
  · have h_eq : Finset.sum (Finset.range N) (fun k => if k ≥ n then (1 : ℝ) / (b k + 1) else 0) =
                Finset.sum (Finset.Ico n N) (fun k => (1 : ℝ) / (b k + 1)) := by
      have h_split := Finset.sum_range_add_sum_Ico (fun k => if k ≥ n then (1 : ℝ) / (b k + 1) else 0) (le_of_lt hlt)
      have h_zero : Finset.sum (Finset.range n) (fun k => if k ≥ n then (1 : ℝ) / (b k + 1) else 0) = 0 := by
        apply Finset.sum_eq_zero
        intro x hx
        have : x < n := Finset.mem_range.mp hx
        rw [if_neg (by omega)]
      rw [h_zero, zero_add] at h_split
      rw [← h_split]
      apply Finset.sum_congr rfl
      intro x hx
      have h_ge : x ≥ n := (Finset.mem_Ico.mp hx).left
      dsimp
      rw [if_pos h_ge]
    rw [h_eq]
    have h_strict := sum_range_strict_bound n N (le_of_lt hlt)
    have hb := b_ge_two N
    have hb_real : (2 : ℝ) ≤ b N := by exact_mod_cast hb
    have h_pos : (0 : ℝ) < b N - 1 := by linarith
    have h_pos2 : (0 : ℝ) < 1 / (b N - 1) := by positivity
    linarith

lemma beta_n_summable (n : ℕ) (hn : n ≥ 1) : Summable (fun k => if k ≥ n then (1 : ℝ) / (b k + 1) else 0) := by
  apply summable_of_sum_range_le (c := (1 : ℝ) / (b n - 1))
  · intro k
    split_ifs
    · exact le_of_lt (beta_term_pos k)
    · rfl
  · exact sum_range_bound n

noncomputable def beta_n (n : ℕ) : ℝ :=
  ∑' (k : ℕ), if k ≥ n then (1 : ℝ) / (b k + 1) else 0

lemma beta_n_pos (n : ℕ) (hn : n ≥ 1) : 0 < beta_n n := by
  have h_summable := beta_n_summable n hn
  have h_pos : 0 < if n ≥ n then (1 : ℝ) / (b n + 1) else 0 := by
    dsimp
    rw [if_pos (le_refl n)]
    exact beta_term_pos n
  exact tsum_pos h_summable (fun k => by
    split_ifs
    · exact le_of_lt (beta_term_pos k)
    · exact le_refl _
  ) n h_pos
