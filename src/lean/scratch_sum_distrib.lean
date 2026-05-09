import Mathlib

open Finset

lemma sum_prod_distrib (a : ℕ → ℝ) (N : ℕ) :
  (∑ i ∈ Finset.range N, 1 / a i) * (∏ i ∈ Finset.range N, a i) =
  ∑ i ∈ Finset.range N, ((∏ j ∈ Finset.range N, a j) / a i) := by
  rw [sum_mul]
  congr 1
  ext i
  ring
