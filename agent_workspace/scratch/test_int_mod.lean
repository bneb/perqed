import Mathlib

def b : ℕ → ℕ
  | 0 => 2
  | n + 1 => b n * b n - b n + 1

lemma b_ge_two (n : ℕ) : 2 ≤ b n := sorry

lemma b_mod_four (n : ℕ) (hn : n ≥ 1) : (b n : ℤ) % 4 = 3 := by
  induction' n, hn using Nat.le_induction with k hk ih
  · decide
  · dsimp [b]
    have h1 : (b k : ℤ) * (b k : ℤ) - (b k : ℤ) = (b k * b k - b k : ℕ) := by
      have : 1 ≤ b k := by have := b_ge_two k; omega
      exact_mod_cast rfl
    sorry
