import Mathlib

lemma test_floor (x : ℝ) (hx : x ≥ 0) : (⌊x⌋₊ : ℝ) > x - 1 := Nat.sub_one_lt_floor x
