import Mathlib

def maxPrefix (f : ℕ → ℤ) : ℕ → ℤ
  | 0 => f 0
  | n + 1 => max (maxPrefix f n) (f (n + 1))

lemma le_maxPrefix (f : ℕ → ℤ) (n : ℕ) (k : ℕ) (hk : k ≤ n) : f k ≤ maxPrefix f n := by
  induction' n with n ih
  · have h_zero : k = 0 := Nat.eq_zero_of_le_zero hk
    subst h_zero
    rfl
  · by_cases h_eq : k = n + 1
    · subst h_eq
      exact le_max_right _ _
    · have h_lt : k ≤ n := Nat.le_of_lt_succ (lt_of_le_of_ne hk h_eq)
      exact le_trans (ih h_lt) (le_max_left _ _)

lemma eventually_const_bounded (f : ℕ → ℤ) (C : ℤ) (N : ℕ) (hC : ∀ n ≥ N, f n = C) :
    ∃ B : ℤ, ∀ k, f k ≤ B := by
  use max (maxPrefix f N) C
  intro k
  by_cases hk : k ≤ N
  · exact le_trans (le_maxPrefix f N k hk) (le_max_left _ _)
  · push_neg at hk
    have hk_le : k ≥ N := le_of_lt hk
    rw [hC k hk_le]
    exact le_max_right _ _
