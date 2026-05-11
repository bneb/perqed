import Mathlib

open Topology

lemma test_peel (b_n b_n1 : ℝ) (h_lt : 1 / (b_n + 1) + 1 / (b_n1 - 1) < 1 / (b_n - 1))
  (beta_n beta_n1 : ℝ) (h_eq : beta_n = 1 / (b_n + 1) + beta_n1)
  (h_le : beta_n1 ≤ 1 / (b_n1 - 1)) : beta_n < 1 / (b_n - 1) := by
  linarith
