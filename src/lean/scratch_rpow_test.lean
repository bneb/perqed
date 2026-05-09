import Mathlib

lemma nesting_condition_coord1_new (Nk Nk1 : ℝ) (hNk : Nk ≥ 3 * 10^13) (hNk1_lo : Nk1 ≥ Nk) (hNk1_up : Nk1 ^ 10 ≤ Nk ^ 11) :
    50 / Nk ^ 2 ≤ Real.sqrt Nk1 / (2 * Nk1 ^ 2) := by
  have hk_pos : Nk > 0 := by positivity
  have hk1_pos : Nk1 > 0 := by positivity
  have h_goal : 10000 * Nk1 ^ 3 ≤ Nk ^ 4 := by
    have h1 : (10000 * Nk1 ^ 3) ^ 10 ≤ (Nk ^ 4) ^ 10 := by
      calc (10000 * Nk1 ^ 3) ^ 10 = 10000 ^ 10 * (Nk1 ^ 10) ^ 3 := by ring
        _ ≤ 10000 ^ 10 * (Nk ^ 11) ^ 3 := by gcongr
        _ = 10000 ^ 10 * Nk ^ 33 := by ring
        _ ≤ Nk ^ 7 * Nk ^ 33 := by
          gcongr
          calc 10000 ^ 10 = (10 ^ 4) ^ 10 := by norm_num
            _ = 10 ^ 40 := by norm_num
            _ ≤ (3 * 10 ^ 13) ^ 7 := by norm_num
            _ ≤ Nk ^ 7 := by gcongr
        _ = (Nk ^ 4) ^ 10 := by ring
    exact StrictMono.le_iff_le (strictMono_pow_bit0 5 (by norm_num)) |>.mp h1
  sorry

