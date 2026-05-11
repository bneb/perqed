import Mathlib

def b : ℕ → ℕ
  | 0 => 2
  | n + 1 => b n * b n - b n + 1

def D : ℕ → ℕ
  | 0 => 1
  | n + 1 => Nat.lcm (D n) (b n + 1)

lemma b_add_one_dvd_D (k n : ℕ) (h : k < n) : (b k + 1) ∣ D n := by
  induction n with
  | zero =>
    exfalso
    exact Nat.not_lt_zero k h
  | succ n ih =>
    by_cases hk : k < n
    · have h_dvd := ih hk
      have h_D_succ : D (n + 1) = Nat.lcm (D n) (b n + 1) := rfl
      exact dvd_trans h_dvd (Nat.dvd_lcm_left (D n) (b n + 1))
    · have h_eq : k = n := by
        apply Nat.le_antisymm
        · exact Nat.le_of_lt_succ h
        · exact Nat.not_lt.1 hk
      rw [h_eq]
      have h_D_succ : D (n + 1) = Nat.lcm (D n) (b n + 1) := rfl
      exact Nat.dvd_lcm_right (D n) (b n + 1)

lemma eight_dvd_D (n : ℕ) (hn : n ≥ 3) : 8 ∣ D n := by
  have h_lt : 2 < n := hn
  have h_dvd := b_add_one_dvd_D 2 n h_lt
  have h_b2 : b 2 = 7 := rfl
  have h_8 : b 2 + 1 = 8 := by rw [h_b2]
  rwa [h_8] at h_dvd
