import Mathlib

lemma test_greedy (ak2 S A : ℕ) (ha_k1_ge3 : A ≥ 3) (h_mul_lb : S ≥ 3 * A) (hG_k1 : ak2 ≥ S - A + 1) : ak2 - 1 ≥ S - 2 * A + 1 - (A - 1) + 1 := by
  omega

