import Mathlib

open Filter Topology Metric Finset

def history_product (q : ℕ) (a : ℕ → ℕ) (N : ℕ) : ℕ :=
  q * ∏ i ∈ Finset.range N, a i

lemma tail_squeeze (q : ℕ) (a : ℕ → ℕ) (N : ℕ)
  (h_warp : ∀ n, a (n + 1) ≥ (a n)^2 - a n + 1)
  (h_pos : ∀ n, a n ≥ 2)
  (h_jump : a N > 2 * history_product q a N) :
  have h_ineq : ∀ n, 1 / (a n : ℝ) ≤ 1 / ((a n : ℝ) - 1) - 1 / ((a (n + 1) : ℝ) - 1) := by
    intro n
    have hn2 : (a n : ℝ) ≥ 2 := by exact_mod_cast h_pos n
    have hn12 : (a (n + 1) : ℝ) ≥ 2 := by exact_mod_cast h_pos (n + 1)
    have ha1 : (a n : ℝ) - 1 > 0 := by linarith
    have ha2 : (a (n + 1) : ℝ) - 1 > 0 := by linarith
    have hw_nat : a (n + 1) + a n ≥ a n ^ 2 + 1 := by
      have : a (n + 1) ≥ a n ^ 2 - a n + 1 := h_warp n
      omega
    have hw : (a (n + 1) : ℝ) + (a n : ℝ) ≥ (a n : ℝ)^2 + 1 := by exact_mod_cast hw_nat
    have h_denom_le : (a (n + 1) : ℝ) - 1 ≥ (a n : ℝ) * ((a n : ℝ) - 1) := by
      calc (a (n + 1) : ℝ) - 1
        _ ≥ (a n : ℝ)^2 - (a n : ℝ) := by linarith
        _ = (a n : ℝ) * ((a n : ℝ) - 1) := by ring
        
    -- Now standard fraction manipulation
    have h_pos_denom : (a n : ℝ) * ((a n : ℝ) - 1) > 0 := by positivity
    have h_pos_next : (a (n + 1) : ℝ) - 1 > 0 := by linarith
    
    have h_inv : 1 / ((a (n + 1) : ℝ) - 1) ≤ 1 / ((a n : ℝ) * ((a n : ℝ) - 1)) := by
      apply one_div_le_one_div_of_le h_pos_denom h_denom_le

    calc 1 / (a n : ℝ)
      _ = ((a n : ℝ) - 1) / ((a n : ℝ) * ((a n : ℝ) - 1)) := by
        have : (a n : ℝ) - 1 ≠ 0 := by linarith
        exact (mul_div_mul_right 1 (a n : ℝ) this).symm
      _ = 1 / ((a n : ℝ) - 1) - 1 / ((a n : ℝ) * ((a n : ℝ) - 1)) := by
        ring
      _ ≤ 1 / ((a n : ℝ) - 1) - 1 / ((a (n + 1) : ℝ) - 1) := by
        linarith
  sorry
