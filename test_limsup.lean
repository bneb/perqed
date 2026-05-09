import Mathlib

open Filter Topology Finset

example : limsup (fun n : ℕ => (n : ℝ)) atTop = 0 := by
  -- is this provable?
  apply csInf_empty -- or something
  sorry
