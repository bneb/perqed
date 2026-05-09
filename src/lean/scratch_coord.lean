import Mathlib

noncomputable def f₁ (x : ℝ) : ℝ := 1 / x

lemma f1_error_exact (N n : ℝ) (hN : N ≠ 0) (hNn : N + n ≠ 0) :
    f₁ (N + n) - f₁ N + n / N ^ 2 = n ^ 2 / (N ^ 2 * (N + n)) := by
  unfold f₁; field_simp; ring

lemma f1_linearization (N : ℝ) (n : ℤ) (hN : N > 0) (hn : (|n| : ℝ) ≤ N / 8) :
    |f₁ (N + (n : ℝ)) - f₁ N + (n : ℝ) / N ^ 2| ≤ 2 * (n : ℝ) ^ 2 / N ^ 3 := sorry

example (N M p₁ : ℝ) (hN : N ≥ 625) (hM : M ≥ 1) (hMN : M ^ 2 ≤ N)
    (n₁_real n₂_real q₁ : ℝ) (n₁ n₂ : ℤ)
    (hlin₁ : n₁_real + n₂_real / 4 = -p₁ * N ^ 2)
    (hn₁b : (|n₁| : ℝ) ≤ N / 8)
    (hn₂b : (|n₂| : ℝ) ≤ N / 4)
    (hn₁e : |(n₁ : ℝ) - n₁_real| ≤ 1 / 2)
    (hn₂e : |(n₂ : ℝ) - n₂_real| ≤ 1 / 2)
    (hn₁_sq : (n₁ : ℝ) ^ 2 ≤ 4 * M ^ 2)
    (hn₂_sq : (n₂ : ℝ) ^ 2 ≤ 49 * M ^ 2) :
    |p₁ - (f₁ (N + (n₁ : ℝ)) + f₁ (2 * N + (n₂ : ℝ)) - f₁ N - f₁ (2 * N))| ≤ 50 / N ^ 2 := by
  have hN_pos : N > 0 := by linarith
  have hN2_pos : N ^ 2 > 0 := by positivity
  
  -- Define the errors
  let e₁ := (n₁ : ℝ) - n₁_real
  let e₂ := (n₂ : ℝ) - n₂_real
  
  -- Linear identity
  have h_lin_id : p₁ + (n₁ : ℝ) / N ^ 2 + (n₂ : ℝ) / (4 * N ^ 2) = (e₁ + e₂ / 4) / N ^ 2 := by
    have key : p₁ * N ^ 2 + (n₁ : ℝ) + (n₂ : ℝ) / 4 = 
      ((n₁ : ℝ) - n₁_real) + ((n₂ : ℝ) - n₂_real) / 4 := by
      -- n₁_real + n₂_real/4 = -p₁*N² (from hlin₁)
      nlinarith
    rw [show (4 : ℝ) * N ^ 2 = 4 * N ^ 2 from rfl]
    have hN2ne : N ^ 2 ≠ 0 := ne_of_gt hN2_pos
    field_simp
    linarith [key]

  -- f1 Decomposition
  have hNn₁_pos : N + (n₁ : ℝ) > 0 := by
    have : |(n₁ : ℝ)| ≤ N / 8 := hn₁b
    have : -(N / 8) ≤ (n₁ : ℝ) := (abs_le.mp this).1
    linarith
  have h2Nn₂_pos : 2 * N + (n₂ : ℝ) > 0 := by
    have : |(n₂ : ℝ)| ≤ N / 4 := hn₂b
    have : -(N / 4) ≤ (n₂ : ℝ) := (abs_le.mp this).1
    linarith
    
  let err₁ := (n₁ : ℝ) ^ 2 / (N ^ 2 * (N + (n₁ : ℝ)))
  let err₂ := (n₂ : ℝ) ^ 2 / ((2 * N) ^ 2 * (2 * N + (n₂ : ℝ)))
  
  have h_decomp : f₁ (N + (n₁ : ℝ)) + f₁ (2 * N + (n₂ : ℝ)) - f₁ N - f₁ (2 * N) = 
      -((n₁ : ℝ) / N ^ 2) - (n₂ : ℝ) / (2 * N) ^ 2 + err₁ + err₂ := by
    have h1 := f1_error_exact N (n₁ : ℝ) (ne_of_gt hN_pos) (ne_of_gt hNn₁_pos)
    have h2 := f1_error_exact (2 * N) (n₂ : ℝ) (by positivity) (ne_of_gt h2Nn₂_pos)
    -- h1: f₁(N+n₁) - f₁ N + n₁/N² = err₁
    -- h2: f₁(2N+n₂) - f₁ (2N) + n₂/(4N²) = err₂
    calc f₁ (N + (n₁ : ℝ)) + f₁ (2 * N + (n₂ : ℝ)) - f₁ N - f₁ (2 * N)
      _ = (f₁ (N + (n₁ : ℝ)) - f₁ N) + (f₁ (2 * N + (n₂ : ℝ)) - f₁ (2 * N)) := by ring
      _ = (-((n₁ : ℝ) / N ^ 2) + err₁) + (-((n₂ : ℝ) / (2 * N) ^ 2) + err₂) := by linarith [h1, h2]
      _ = -((n₁ : ℝ) / N ^ 2) - (n₂ : ℝ) / (2 * N) ^ 2 + err₁ + err₂ := by ring

  -- Bounds
  have h_err₁ : |err₁| ≤ 2 * (n₁ : ℝ) ^ 2 / N ^ 3 := by
    have h := f1_linearization N n₁ hN_pos hn₁b
    have h1 := f1_error_exact N (n₁ : ℝ) (ne_of_gt hN_pos) (ne_of_gt hNn₁_pos)
    rwa [h1] at h

  have h_err₂ : |err₂| ≤ 2 * (n₂ : ℝ) ^ 2 / (2 * N) ^ 3 := by
    have h := f1_linearization (2 * N) n₂ (by linarith) (by linarith)
    have h2 := f1_error_exact (2 * N) (n₂ : ℝ) (by positivity) (ne_of_gt h2Nn₂_pos)
    rwa [h2] at h

  have h_err₁_b : |err₁| ≤ 8 / N ^ 2 := by
    calc |err₁|
      _ ≤ 2 * (n₁ : ℝ) ^ 2 / N ^ 3 := h_err₁
      _ ≤ 2 * (4 * M ^ 2) / N ^ 3 := by gcongr
      _ = 8 * M ^ 2 / N ^ 3 := by ring
      _ ≤ 8 * N / N ^ 3 := by gcongr
      _ = 8 / N ^ 2 := by
        calc 8 * N / N ^ 3 = 8 * N / (N * N ^ 2) := by ring_nf
          _ = 8 * (N / N) * (1 / N ^ 2) := by ring
          _ = 8 * 1 * (1 / N ^ 2) := by rw [div_self (ne_of_gt hN_pos)]
          _ = 8 / N ^ 2 := by ring

  have h_err₂_b : |err₂| ≤ 49 / (4 * N ^ 2) := by
    calc |err₂|
      _ ≤ 2 * (n₂ : ℝ) ^ 2 / (2 * N) ^ 3 := h_err₂
      _ ≤ 2 * (49 * M ^ 2) / (2 * N) ^ 3 := by
        apply div_le_div_of_nonneg_right
        · linarith [hn₂_sq]
        · positivity
      _ = 98 * M ^ 2 / (8 * N ^ 3) := by ring
      _ ≤ 98 * N / (8 * N ^ 3) := by
        apply div_le_div_of_nonneg_right
        · linarith [hMN]
        · positivity
      _ = 49 / (4 * N ^ 2) := by
        calc 98 * N / (8 * N ^ 3) = 98 * N / (8 * N * N ^ 2) := by ring_nf
          _ = (98 / 8) * (N / N) * (1 / N ^ 2) := by ring
          _ = (49 / 4) * 1 * (1 / N ^ 2) := by rw [div_self (ne_of_gt hN_pos)]; norm_num
          _ = 49 / (4 * N ^ 2) := by ring

  have h_lin_b : |(e₁ + e₂ / 4) / N ^ 2| ≤ (5 / 8) / N ^ 2 := by
    rw [abs_div, abs_of_pos hN2_pos]
    have : |e₁ + e₂ / 4| ≤ 5 / 8 := by
      calc |e₁ + e₂ / 4|
        _ ≤ |e₁| + |e₂ / 4| := abs_add_le _ _
        _ = |e₁| + |e₂| / 4 := by rw [abs_div]; norm_num
        _ ≤ 1/2 + (1/2)/4 := by linarith [hn₁e, hn₂e]
        _ = 5/8 := by norm_num
    gcongr

  calc |p₁ - (f₁ (N + (n₁ : ℝ)) + f₁ (2 * N + (n₂ : ℝ)) - f₁ N - f₁ (2 * N))|
    _ = |p₁ - (-((n₁ : ℝ) / N ^ 2) - (n₂ : ℝ) / (2 * N) ^ 2 + err₁ + err₂)| := by rw [h_decomp]
    _ = |p₁ + (n₁ : ℝ) / N ^ 2 + (n₂ : ℝ) / (4 * N ^ 2) - err₁ - err₂| := by
      congr 1; ring
    _ = |(e₁ + e₂ / 4) / N ^ 2 - err₁ - err₂| := by rw [h_lin_id]
    _ ≤ |(e₁ + e₂ / 4) / N ^ 2| + |err₁| + |err₂| := by
      calc |(e₁ + e₂ / 4) / N ^ 2 - err₁ - err₂|
        _ = |((e₁ + e₂ / 4) / N ^ 2) + (-err₁) + (-err₂)| := by ring_nf
        _ ≤ |((e₁ + e₂ / 4) / N ^ 2) + (-err₁)| + |-err₂| := abs_add_le _ _
        _ ≤ (|(e₁ + e₂ / 4) / N ^ 2| + |-err₁|) + |-err₂| := by
          have h := abs_add_le ((e₁ + e₂ / 4) / N ^ 2) (-err₁)
          linarith
        _ = |(e₁ + e₂ / 4) / N ^ 2| + |err₁| + |err₂| := by simp only [abs_neg]
    _ ≤ 5 / 8 / N ^ 2 + 8 / N ^ 2 + 49 / (4 * N ^ 2) := by linarith [h_lin_b, h_err₁_b, h_err₂_b]
    _ = (5/8 + 8 + 49/4) / N ^ 2 := by ring
    _ = 167 / 8 / N ^ 2 := by norm_num
    _ ≤ 50 / N ^ 2 := by
      gcongr
      norm_num
