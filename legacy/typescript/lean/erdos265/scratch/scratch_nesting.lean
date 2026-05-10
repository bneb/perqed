import Mathlib

lemma nesting_condition_coord1 (Nk Nk1 : ℝ) (hNk : Nk ≥ 2 * 10^9) (hNk1_lo : Nk1 ≥ Nk) (hNk1_up : Nk1 ≤ 20 * Nk) :
    50 / Nk ^ 2 ≤ Real.sqrt Nk1 / (2 * Nk1 ^ 2) := by
  have hNk_pos : Nk > 0 := by linarith
  have hNk1_pos : Nk1 > 0 := by linarith
  
  have h_sqrt : 40000 ≤ Real.sqrt Nk1 := by
    have h1 : (16:ℝ) * 10^8 ≤ Nk1 := by
      calc (16:ℝ) * 10^8 = 1600000000 := by norm_num
        _ ≤ 2000000000 := by norm_num
        _ = 2 * 10^9 := by norm_num
        _ ≤ Nk := hNk
        _ ≤ Nk1 := hNk1_lo
    have h2 : Real.sqrt ((16:ℝ) * 10^8) ≤ Real.sqrt Nk1 := Real.sqrt_le_sqrt h1
    have h3 : Real.sqrt ((16:ℝ) * 10^8) = 40000 := by
      have : (40000:ℝ)^2 = (16:ℝ) * 10^8 := by norm_num
      have hsq : Real.sqrt ((40000:ℝ)^2) = 40000 := Real.sqrt_sq (by norm_num)
      rwa [this] at hsq
    rwa [h3] at h2

  have h_bound1 : 100 * (Nk1 / Nk) ^ 2 ≤ 40000 := by
    have : Nk1 / Nk ≤ 20 := (div_le_iff₀ hNk_pos).mpr hNk1_up
    have h_sq : (Nk1 / Nk) ^ 2 ≤ 20 ^ 2 := by
      have h_pos : Nk1 / Nk ≥ 0 := div_nonneg (by linarith) (by linarith)
      nlinarith
    calc 100 * (Nk1 / Nk) ^ 2 ≤ 100 * 20 ^ 2 := by gcongr
      _ = 40000 := by norm_num

  have h_bound2 : 100 * (Nk1 / Nk) ^ 2 ≤ Real.sqrt Nk1 := le_trans h_bound1 h_sqrt

  have h_id : 50 / Nk ^ 2 = 100 * (Nk1 / Nk) ^ 2 / (2 * Nk1 ^ 2) := by
    have hNk1ne : Nk1 ^ 2 ≠ 0 := by positivity
    calc 50 / Nk ^ 2 = 50 * (1 / Nk ^ 2) := by ring
      _ = 50 * (1 / Nk ^ 2) * (Nk1 ^ 2 / Nk1 ^ 2) := by rw [div_self hNk1ne]
      _ = 100 * (Nk1 / Nk) ^ 2 / (2 * Nk1 ^ 2) := by ring

  calc 50 / Nk ^ 2 = 100 * (Nk1 / Nk) ^ 2 / (2 * Nk1 ^ 2) := h_id
    _ ≤ Real.sqrt Nk1 / (2 * Nk1 ^ 2) := by gcongr
