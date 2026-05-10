import Mathlib

open Finset

-- Helper: the key arithmetic bridge from h_warp to a multiplicative bound.
-- Stated without any ℕ subtraction to keep omega happy.
private lemma warp_to_mul_bound {a b : ℕ} (ha : a ≥ 2) (h : b ≥ a ^ 2 - a + 1) :
    a * (a - 1) + 1 ≤ b := by
  have ha1 : a ≥ 1 := by omega
  zify [ha1, show a ^ 2 ≥ a from by nlinarith] at *
  nlinarith

lemma shift_prod_bound (a : ℕ → ℕ) (N : ℕ)
  (h_warp : ∀ n, a (n + 1) ≥ (a n)^2 - a n + 1)
  (h_pos : ∀ n, a n ≥ 2) :
  ∏ i ∈ Finset.range N, (a i - 1) ≤ a N - 1 := by
  induction N with
  | zero => 
    simp
    have := h_pos 0
    clear h_warp h_pos
    omega
  | succ n ih =>
    rw [Finset.prod_range_succ]
    have key : a n * (a n - 1) + 1 ≤ a (n + 1) := 
      warp_to_mul_bound (h_pos n) (h_warp n)
    calc (∏ i ∈ Finset.range n, (a i - 1)) * (a n - 1)
      _ ≤ (a n - 1) * (a n - 1) := Nat.mul_le_mul_right _ ih
      _ ≤ a n * (a n - 1) := Nat.mul_le_mul_right _ (by omega)
      _ ≤ a (n + 1) - 1 := by omega
