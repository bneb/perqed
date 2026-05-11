import Mathlib

lemma test (a b : ℕ) : a ∣ Nat.lcm a b := by
  exact Nat.dvd_lcm_left a b
