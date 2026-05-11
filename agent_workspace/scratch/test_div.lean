import Mathlib

lemma test_div_lt_div (a b c d : ℝ) (hb : 0 < b) (hd : 0 < d) (h : a * d < c * b) : a / b < c / d := by
  rwa [div_lt_div_iff hb hd]
