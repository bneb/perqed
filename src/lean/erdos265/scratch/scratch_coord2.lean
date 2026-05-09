import Mathlib

noncomputable def f₂ (x : ℝ) : ℝ := 1 / x ^ 2

lemma f2_linearization (N : ℝ) (n : ℤ) (hN : N ≥ 16) (hn : |(n : ℝ)| ≤ N / 8) :
    |f₂ (N + (n : ℝ)) - f₂ N + 2 * (n : ℝ) / N ^ 3| ≤ 32 * (n : ℝ) ^ 2 / N ^ 4 := by
  sorry

lemma coord2_scratch (N M : ℝ) (hN : N ≥ 625) (hM : M ≥ 1) (hMN : M ^ 2 ≤ N)
    (p₂ : ℝ) (hp₂ : |p₂| ≤ M / (2 * N ^ 3))
    (n₁ n₂ : ℤ)
    (hn₁b : (|n₁| : ℝ) ≤ N / 8) (hn₂b : (|n₂| : ℝ) ≤ N / 4)
    (hn₁_sq : (n₁ : ℝ) ^ 2 ≤ 4 * M ^ 2) (hn₂_sq : (n₂ : ℝ) ^ 2 ≤ 49 * M ^ 2)
    (e₁ e₂ : ℝ)
    (he₁ : |e₁| ≤ 1/2) (he₂ : |e₂| ≤ 1/2)
    (hn₁_eq : (n₁ : ℝ) = n₁_real + e₁)
    (hn₂_eq : (n₂ : ℝ) = n₂_real + e₂)
    (q₂ : ℝ) (hq₂_def : q₂ = -p₂ * N ^ 3)
    (n₁_real n₂_real : ℝ)
    (hlin₂ : 2 * n₁_real + n₂_real / 4 = q₂) :
    |p₂ - (f₂ (N + (n₁ : ℝ)) + f₂ (2 * N + (n₂ : ℝ)) - f₂ N - f₂ (2 * N))| ≤ 300 / N ^ 3 := by
  have hN_pos : N > 0 := by linarith
  have hN3_pos : N ^ 3 > 0 := by positivity
  have h2N : 2 * N ≥ 16 := by linarith
  have h_n2_b2 : |(n₂ : ℝ)| ≤ (2 * N) / 8 := by
    calc |(n₂ : ℝ)| ≤ N / 4 := hn₂b
      _ = (2 * N) / 8 := by ring
  
  let err₁ := f₂ (N + (n₁ : ℝ)) - f₂ N + 2 * (n₁ : ℝ) / N ^ 3
  let err₂ := f₂ (2 * N + (n₂ : ℝ)) - f₂ (2 * N) + 2 * (n₂ : ℝ) / (2 * N) ^ 3

  have h_err₁ : |err₁| ≤ 32 * (n₁ : ℝ) ^ 2 / N ^ 4 := f2_linearization N n₁ (by linarith) hn₁b
  have h_err₂ : |err₂| ≤ 32 * (n₂ : ℝ) ^ 2 / (2 * N) ^ 4 := f2_linearization (2 * N) n₂ h2N h_n2_b2

  have h_decomp : f₂ (N + (n₁ : ℝ)) + f₂ (2 * N + (n₂ : ℝ)) - f₂ N - f₂ (2 * N) = 
        - 2 * (n₁ : ℝ) / N ^ 3 - 2 * (n₂ : ℝ) / (2 * N) ^ 3 + err₁ + err₂ := by
    simp only [err₁, err₂]; ring

  have h_lin_id : p₂ + 2 * (n₁ : ℝ) / N ^ 3 + 2 * (n₂ : ℝ) / (2 * N) ^ 3 = (2 * e₁ + e₂ / 4) / N ^ 3 := by
    have key : p₂ * N ^ 3 + 2 * (n₁ : ℝ) + (n₂ : ℝ) / 4 = 
      2 * ((n₁ : ℝ) - n₁_real) + ((n₂ : ℝ) - n₂_real) / 4 := by
      nlinarith
    have hN3ne : N ^ 3 ≠ 0 := ne_of_gt hN3_pos
    calc p₂ + 2 * (n₁ : ℝ) / N ^ 3 + 2 * (n₂ : ℝ) / (2 * N) ^ 3
      _ = p₂ * (N ^ 3 / N ^ 3) + 2 * (n₁ : ℝ) / N ^ 3 + 2 * (n₂ : ℝ) / (2 * N) ^ 3 := by rw [div_self hN3ne, mul_one]
      _ = (p₂ * N ^ 3) / N ^ 3 + 2 * (n₁ : ℝ) / N ^ 3 + ((n₂ : ℝ) / 4) / N ^ 3 := by ring
      _ = (p₂ * N ^ 3 + 2 * (n₁ : ℝ) + (n₂ : ℝ) / 4) / N ^ 3 := by ring
      _ = (2 * ((n₁ : ℝ) - n₁_real) + ((n₂ : ℝ) - n₂_real) / 4) / N ^ 3 := by rw [key]
      _ = (2 * e₁ + e₂ / 4) / N ^ 3 := by rw [show (n₁:ℝ) - n₁_real = e₁ from by linarith, show (n₂:ℝ) - n₂_real = e₂ from by linarith]

  have h_err₁_b : |err₁| ≤ 128 / N ^ 3 := by
    calc |err₁|
      _ ≤ 32 * (n₁ : ℝ) ^ 2 / N ^ 4 := h_err₁
      _ ≤ 32 * (4 * M ^ 2) / N ^ 4 := by gcongr
      _ = 128 * M ^ 2 / N ^ 4 := by ring
      _ ≤ 128 * N / N ^ 4 := by gcongr
      _ = 128 / N ^ 3 := by
        calc 128 * N / N ^ 4 = 128 * N / (N * N ^ 3) := by ring_nf
          _ = 128 * (N / N) * (1 / N ^ 3) := by ring
          _ = 128 * 1 * (1 / N ^ 3) := by rw [div_self (ne_of_gt hN_pos)]
          _ = 128 / N ^ 3 := by ring

  have h_err₂_b : |err₂| ≤ 98 / N ^ 3 := by
    have h_2N_pos : (0 : ℝ) ≤ 2 * N := by linarith
    have h_2N4_pos : (0 : ℝ) ≤ (2 * N) ^ 4 := pow_nonneg h_2N_pos 4
    have h_16N4_pos : (0 : ℝ) ≤ 16 * N ^ 4 := by
      have h_N4_pos : (0 : ℝ) ≤ N ^ 4 := pow_nonneg (by linarith) 4
      linarith
    calc |err₂|
      _ ≤ 32 * (n₂ : ℝ) ^ 2 / (2 * N) ^ 4 := h_err₂
      _ ≤ 32 * (49 * M ^ 2) / (2 * N) ^ 4 := by
        apply div_le_div_of_nonneg_right
        · exact mul_le_mul_of_nonneg_left hn₂_sq (by norm_num)
        · exact h_2N4_pos
      _ = 1568 * M ^ 2 / (16 * N ^ 4) := by ring
      _ ≤ 1568 * N / (16 * N ^ 4) := by
        apply div_le_div_of_nonneg_right
        · exact mul_le_mul_of_nonneg_left hMN (by norm_num)
        · exact h_16N4_pos
      _ = 98 / N ^ 3 := by
        calc 1568 * N / (16 * N ^ 4) = 1568 * N / (16 * N * N ^ 3) := by ring_nf
          _ = (1568 / 16) * (N / N) * (1 / N ^ 3) := by ring
          _ = 98 * 1 * (1 / N ^ 3) := by rw [div_self (ne_of_gt hN_pos)]; norm_num
          _ = 98 / N ^ 3 := by ring

  have h_lin_b : |(2 * e₁ + e₂ / 4) / N ^ 3| ≤ (9 / 8) / N ^ 3 := by
    rw [abs_div, abs_of_pos hN3_pos]
    have : |2 * e₁ + e₂ / 4| ≤ 9 / 8 := by
      calc |2 * e₁ + e₂ / 4|
        _ ≤ |2 * e₁| + |e₂ / 4| := abs_add_le _ _
        _ = 2 * |e₁| + |e₂| / 4 := by rw [abs_mul, abs_div, abs_of_pos (by norm_num), abs_of_pos (by norm_num)]
        _ ≤ 2 * (1/2) + (1/2)/4 := by linarith [he₁, he₂]
        _ = 9/8 := by norm_num
    gcongr

  calc |p₂ - (f₂ (N + (n₁ : ℝ)) + f₂ (2 * N + (n₂ : ℝ)) - f₂ N - f₂ (2 * N))|
    _ = |p₂ - (- 2 * (n₁ : ℝ) / N ^ 3 - 2 * (n₂ : ℝ) / (2 * N) ^ 3 + err₁ + err₂)| := by rw [h_decomp]
    _ = |p₂ + 2 * (n₁ : ℝ) / N ^ 3 + 2 * (n₂ : ℝ) / (2 * N) ^ 3 - err₁ - err₂| := by
      congr 1; ring
    _ = |(2 * e₁ + e₂ / 4) / N ^ 3 - err₁ - err₂| := by rw [h_lin_id]
    _ ≤ |(2 * e₁ + e₂ / 4) / N ^ 3| + |err₁| + |err₂| := by
      calc |(2 * e₁ + e₂ / 4) / N ^ 3 - err₁ - err₂|
        _ = |((2 * e₁ + e₂ / 4) / N ^ 3) + (-err₁) + (-err₂)| := by ring_nf
        _ ≤ |((2 * e₁ + e₂ / 4) / N ^ 3) + (-err₁)| + |-err₂| := abs_add_le _ _
        _ ≤ (|(2 * e₁ + e₂ / 4) / N ^ 3| + |-err₁|) + |-err₂| := by
          have h := abs_add_le ((2 * e₁ + e₂ / 4) / N ^ 3) (-err₁)
          exact add_le_add_right h _
        _ = |(2 * e₁ + e₂ / 4) / N ^ 3| + |err₁| + |err₂| := by simp only [abs_neg]
    _ ≤ 9 / 8 / N ^ 3 + 128 / N ^ 3 + 98 / N ^ 3 := add_le_add (add_le_add h_lin_b h_err₁_b) h_err₂_b
    _ = (9/8 + 128 + 98) / N ^ 3 := by ring
    _ = (1817 / 8) / N ^ 3 := by norm_num
    _ ≤ 300 / N ^ 3 := by
      gcongr
      norm_num
