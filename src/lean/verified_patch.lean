import Mathlib

open Filter Topology Metric

/-- 
The Combinatorial Patch Lemma:
Proved via interval density. For small error e, the interval of reciprocals 
that halve the error has width > 1, so it must contain an integer.
-/
theorem combinatorial_patch_lemma (e : ℝ) (h_small : e > 0) (h_bound : e ≤ 1/10) :
  ∃ a_val : ℕ, a_val ≥ 10 ∧ |e - 1 / (a_val : ℝ)| ≤ (1 / 2 : ℝ) * e := by
  -- 1. Identify the bounding natural number
  have h_inv : 1 / e ≥ 10 := by
    have : 10 * e ≤ 1 := by linarith
    apply (le_div_iff₀ h_small).mpr
    exact this

  have h_up_20 : 2 / e ≥ 20 := by
    calc 2 / e = 2 * (1 / e) := by ring
         _ ≥ 2 * 10 := by apply mul_le_mul_of_nonneg_left h_inv; norm_num
         _ = 20 := by norm_num

  -- 2. Define the integer a
  let a := ⌊2 / e⌋₊
  use a
  
  have ha_le : (a : ℝ) ≤ 2 / e := Nat.floor_le (by positivity)
  have ha_ge : (a : ℝ) > 2 / e - 1 := Nat.sub_one_lt_floor (2 / e)
  
  constructor
  · -- a ≥ 10
    have : a ≥ 20 := Nat.le_floor h_up_20
    linarith
  · -- |e - 1/a| ≤ e/2
    have ha_pos : (a : ℝ) > 0 := by
      have : a ≥ 20 := Nat.le_floor h_up_20
      linarith
    
    rw [abs_le]
    constructor
    · -- -(e/2) ≤ e - 1/a => 1/a ≤ 3e/2
      have h1 : 2 / e - 1 ≥ 2 / (3 * e) := by
        field_simp [h_small.ne']
        -- 6 - 3e ≥ 2  => 4 ≥ 3e
        have : 3 * e ≤ 3 * (1 / 10) := by linarith
        linarith
      have h_a_ge : (a : ℝ) ≥ 2 / (3 * e) := by linarith
      -- a ≥ 2/(3e) => 1/a ≤ 3e/2
      have : 1 / (a : ℝ) ≤ 1 / (2 / (3 * e)) := by
        apply one_div_le_one_div_of_le _ h_a_ge
        field_simp [h_small.ne']; norm_num
      calc -(1 / 2 * e) ≤ e - 1 / (2 / (3 * e)) := by field_simp [h_small.ne']; ring_nf; linarith
           _ ≤ e - 1 / (a : ℝ) := by linarith
    · -- e - 1/a ≤ e/2 => 1/a ≥ e/2
      -- a ≤ 2/e => 1/a ≥ e/2
      have : 1 / (a : ℝ) ≥ 1 / (2 / e) := by
        apply one_div_le_one_div_of_le (by positivity) ha_le
      calc e - 1 / (a : ℝ) ≤ e - 1 / (2 / e) := by linarith
           _ = 1 / 2 * e := by field_simp [h_small.ne']; ring
