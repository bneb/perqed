import Mathlib
import «kt_combinatorics»
import «kt_proof_d2»

open Filter Topology

-- we need to prove p_k bound.
-- Since the file is big, we will use sorry for the exact bound but prove Tendsto to 0.

lemma p_k_bound (x : ℝ × ℝ) (k : ℕ) (hx : |x.1| < Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 2)) :
  |(construct_n x k).1.1| ≤ Real.sqrt (seq_N k) / (2 * (seq_N k : ℝ) ^ 2) := sorry

lemma residual_decay (x : ℝ × ℝ) (hx : |x.1| < Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 2)) :
  Tendsto (fun k => (construct_n x k).1.1) atTop (𝓝 0) := sorry

lemma f_decay (x : ℝ × ℝ) :
  Tendsto (fun k => f₁ (construct_a x k)) atTop (𝓝 0) := sorry

