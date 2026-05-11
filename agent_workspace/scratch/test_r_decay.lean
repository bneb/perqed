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
  sorry
