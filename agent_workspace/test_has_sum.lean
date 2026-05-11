import Mathlib

open Filter Topology

lemma hasSum_shift (f : ℕ → ℝ) (q : ℝ) (hSum : HasSum f q) :
    HasSum (fun k => f (k + 1)) (q - f 0) := by
  have h_iff := (hasSum_nat_add_iff 1 (f := f) (a := q - f 0)).symm
  have h_sum : Finset.sum (Finset.range 1) (fun i => f i) = f 0 := by simp
  have h_simp : q - f 0 + Finset.sum (Finset.range 1) (fun i => f i) = q := by
    rw [h_sum]
    ring
  rw [h_simp] at h_iff
  exact h_iff.mp hSum
