import Mathlib

open Filter Topology Metric Finset

def history_product_shift (q : ℕ) (a : ℕ → ℕ) (N : ℕ) : ℕ :=
  q * ∏ i ∈ Finset.range N, (a i - 1)

lemma shift_prod_le_term (a : ℕ → ℕ) (N : ℕ)
  (h_warp : ∀ n, a (n + 1) ≥ (a n)^2 - a n + 1)
  (h_pos : ∀ n, a n ≥ 2) :
  ∏ i ∈ Finset.range N, (a i - 1) < a N - 1 := by
  induction N with
  | zero => 
    -- N = 0, product is 1. a 0 - 1 >= 1.
    have h2 : a 0 ≥ 2 := h_pos 0
    rw [Finset.prod_range_zero]
    omega
  | succ n ih =>
    -- product up to n+1 is (prod up to n) * (a n - 1)
    rw [Finset.prod_range_succ]
    have hn : a n ≥ 2 := h_pos n
    have hn1 : a (n + 1) ≥ 2 := h_pos (n + 1)
    have hw : a (n + 1) ≥ a n ^ 2 - a n + 1 := h_warp n
    have hw_sub : a (n + 1) - 1 ≥ a n * (a n - 1) := by
      omega
    
    -- We know prod < a n - 1
    -- So prod * (a n - 1) < (a n - 1) * (a n - 1)
    -- We want to show (a n - 1)^2 < a (n+1) - 1
    -- We know a (n+1) - 1 >= a n * (a n - 1)
    -- Since a n > a n - 1 (because a n >= 2),
    -- a n * (a n - 1) > (a n - 1) * (a n - 1).
    -- So a (n+1) - 1 > (a n - 1)^2 > prod * (a n - 1).
    sorry
