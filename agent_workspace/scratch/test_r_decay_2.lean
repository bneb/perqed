import Mathlib

def b : ℕ → ℕ
  | 0 => 2
  | n + 1 => b n * b n - b n + 1

def D : ℕ → ℕ
  | 0 => 1
  | n + 1 => Nat.lcm (D n) (b n + 1)

noncomputable def r (n : ℕ) : ℝ :=
  (D n : ℝ) / (b n : ℝ)

lemma b_ge_two (n : ℕ) : 2 ≤ b n := sorry
lemma eight_dvd_D (n : ℕ) (hn : n ≥ 3) : 8 ∣ D n := sorry
lemma b_add_one_mod_four (n : ℕ) (hn : n ≥ 1) : (b n + 1) % 4 = 0 := sorry

lemma r_decay (n : ℕ) (hn : n ≥ 3) : r (n + 1) < r n / 3 := by
  have h_dvd1 : 4 ∣ D n := by
    have h8 := eight_dvd_D n hn
    exact dvd_trans (by decide) h8
  have h_dvd2 : 4 ∣ (b n + 1) := by
    have hn1 : n ≥ 1 := by omega
    have hmod := b_add_one_mod_four n hn1
    exact Nat.dvd_of_mod_eq_zero hmod
  have h_gcd : 4 ∣ Nat.gcd (D n) (b n + 1) := Nat.dvd_gcd h_dvd1 h_dvd2
  have h_gcd_ge : 4 ≤ Nat.gcd (D n) (b n + 1) := by
    have h_pos : 0 < Nat.gcd (D n) (b n + 1) := by
      -- gcd is positive since b n + 1 > 0
      sorry
    exact Nat.le_of_dvd h_pos h_gcd
  sorry
