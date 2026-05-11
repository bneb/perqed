import Mathlib

def b : ℕ → ℕ
  | 0 => 2
  | n + 1 => b n * b n - b n + 1

lemma b_ge_two (n : ℕ) : 2 ≤ b n := sorry

lemma b_mono (n : ℕ) : b n < b (n + 1) := by
  dsimp [b]
  have h := b_ge_two n
  have : b n * (b n - 1) + 1 = b n * b n - b n + 1 := by
    rw [Nat.mul_sub_left_distrib, Nat.mul_one]
  have h_sub : 1 ≤ b n - 1 := by omega
  have h_mul : b n * 1 ≤ b n * (b n - 1) := Nat.mul_le_mul_left (b n) h_sub
  rw [mul_one] at h_mul
  omega

lemma b_strictMono : StrictMono b := strictMono_nat_of_lt_succ b_mono

lemma b_ge_43 (n : ℕ) (hn : n ≥ 3) : 43 ≤ b n := by
  have h3 : b 3 = 43 := rfl
  have h_mono := b_strictMono.monotone hn
  omega
