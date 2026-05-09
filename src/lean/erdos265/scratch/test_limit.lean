
import Mathlib
import «verified_growth»
import «kt_combinatorics»

open Finset Real

structure SeqState where
  E : ℝ × ℝ
  current_block : Finset ℕ
  last_emitted : ℕ
  next_lower_bound : ℕ

noncomputable def error_tends_to_zero (E_0 : ℝ × ℝ) : 
  Filter.Tendsto (fun n => (1 : ℝ) / n) Filter.atTop (𝓝 0) := by
  exact tendsto_one_div_atTop_nhds_zero_nat

