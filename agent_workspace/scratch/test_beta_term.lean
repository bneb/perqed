import Mathlib

def b : ℕ → ℕ
  | 0 => 2
  | n + 1 => b n * b n - b n + 1

lemma b_pos (n : ℕ) : 0 < b n := sorry
lemma b_telescope (k : ℕ) : (1 : ℝ) / (b k - 1) - (1 : ℝ) / (b (k + 1) - 1) = (1 : ℝ) / b k := sorry

lemma beta_term_lt (k : ℕ) : (1 : ℝ) / (b k + 1) < (1 : ℝ) / (b k - 1) - (1 : ℝ) / (b (k+1) - 1) := by
  rw [b_telescope]
  have h_pos : (0 : ℝ) < b k := by
    have := b_pos k
    exact_mod_cast this
  have h_lt : (b k : ℝ) < (b k : ℝ) + 1 := by linarith
  exact one_div_lt_one_div_of_lt h_pos h_lt
