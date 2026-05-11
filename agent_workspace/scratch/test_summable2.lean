import Mathlib

open Topology

def b : ℕ → ℕ
  | 0 => 2
  | n + 1 => b n * b n - b n + 1

lemma b_ge_two (n : ℕ) : 2 ≤ b n := sorry
lemma beta_term_pos (k : ℕ) : (0 : ℝ) < 1 / (b k + 1) := sorry
lemma beta_term_lt (k : ℕ) : (1 : ℝ) / (b k + 1) < (1 : ℝ) / (b k - 1) - (1 : ℝ) / (b (k + 1) - 1) := sorry

lemma sum_range_strict_bound (n N : ℕ) (h : n ≤ N) :
  Finset.sum (Finset.Ico n N) (fun k => (1 : ℝ) / (b k + 1)) ≤ (1 : ℝ) / (b n - 1) - (1 : ℝ) / (b N - 1) := by
  induction' N, h using Nat.le_induction with k hk ih
  · simp
  · rw [Finset.sum_Ico_succ_top hk]
    have h_lt := beta_term_lt k
    linarith

lemma sum_range_bound (n N : ℕ) :
  Finset.sum (Finset.range N) (fun k => if k ≥ n then (1 : ℝ) / (b k + 1) else 0) ≤ (1 : ℝ) / (b n - 1) := by
  sorry -- already proved

lemma beta_n_summable (n : ℕ) (hn : n ≥ 1) : Summable (fun k => if k ≥ n then (1 : ℝ) / (b k + 1) else 0) := by
  sorry -- already proved

noncomputable def beta_n (n : ℕ) : ℝ :=
  ∑' (k : ℕ), if k ≥ n then (1 : ℝ) / (b k + 1) else 0

lemma sum_range_eq_Ico (n N : ℕ) (hlt : n ≤ N) :
  Finset.sum (Finset.range N) (fun k => if k ≥ n then (1 : ℝ) / (b k + 1) else 0) =
  Finset.sum (Finset.Ico n N) (fun k => (1 : ℝ) / (b k + 1)) := by
  have h_split := Finset.sum_range_add_sum_Ico (fun k => if k ≥ n then (1 : ℝ) / (b k + 1) else 0) hlt
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

lemma sum_range_peeled_bound (n N : ℕ) :
  Finset.sum (Finset.range N) (fun k => if k ≥ n then (1 : ℝ) / (b k + 1) else 0) ≤ 
  (1 : ℝ) / (b n + 1) + (1 : ℝ) / (b (n + 1) - 1) := by
  rcases le_or_lt N n with hle | hlt
  · have h_zero : Finset.sum (Finset.range N) (fun k => if k ≥ n then (1 : ℝ) / (b k + 1) else 0) = 0 := by
      apply Finset.sum_eq_zero
      intro x hx
      have : x < n := by
        have : x < N := Finset.mem_range.mp hx
        omega
      rw [if_neg (by omega)]
    rw [h_zero]
    have hb := b_ge_two n
    have hb_real : (2 : ℝ) ≤ b n := by exact_mod_cast hb
    have hb1 := b_ge_two (n + 1)
    have hb1_real : (2 : ℝ) ≤ b (n + 1) := by exact_mod_cast hb1
    have hb1_pos : (0 : ℝ) < b (n + 1) - 1 := by linarith
    positivity
  · rw [sum_range_eq_Ico n N (le_of_lt hlt)]
    have h_eq_ico : Finset.sum (Finset.Ico n N) (fun k => (1 : ℝ) / (b k + 1)) =
                    (1 : ℝ) / (b n + 1) + Finset.sum (Finset.Ico (n+1) N) (fun k => (1 : ℝ) / (b k + 1)) := by
      rw [Finset.sum_eq_sum_Ico_succ_bot hlt]
    rw [h_eq_ico]
    have h_strict := sum_range_strict_bound (n+1) N hlt
    have hb := b_ge_two N
    have hb_real : (2 : ℝ) ≤ b N := by exact_mod_cast hb
    have h_pos : (0 : ℝ) < 1 / (b N - 1) := by 
      have hbN_pos : (0 : ℝ) < b N - 1 := by linarith
      positivity
    linarith

lemma beta_n_bound (n : ℕ) (hn : n ≥ 1) : beta_n n < (1 : ℝ) / (b n - 1) := by
  have h_le : beta_n n ≤ (1 : ℝ) / (b n + 1) + (1 : ℝ) / (b (n + 1) - 1) := by
    have h_summable := beta_n_summable n hn
    exact tsum_le_of_sum_range_le h_summable (sum_range_peeled_bound n)
  have h_lt := beta_term_lt n
  linarith
