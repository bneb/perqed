import Mathlib

lemma universal_balance_contradiction (X Y : ℤ) (hX : X ≥ 2) :
    Y^2 - Y ≠ X^2 - X + 1 := by
  intro h
  
  -- Multiply by 4 to complete the square
  have h4 : 4 * (Y^2 - Y) = 4 * (X^2 - X + 1) := by linarith
  have h5 : (2*Y - 1)^2 - 1 = (2*X - 1)^2 + 3 := by
    calc
      (2*Y - 1)^2 - 1 = 4*Y^2 - 4*Y := by ring
      _ = 4 * (Y^2 - Y) := by ring
      _ = 4 * (X^2 - X + 1) := h4
      _ = 4*X^2 - 4*X + 4 := by ring
      _ = (2*X - 1)^2 + 3 := by ring
      
  have h6 : (2*Y - 1)^2 - (2*X - 1)^2 = 4 := by linarith
  
  set A := 2*Y - 1
  set B := 2*X - 1
  
  have h_diff : A^2 - B^2 = 4 := h6
  -- We have A^2 - B^2 = 4
  -- A = 2Y - 1
  -- A^2 = 4Y^2 - 4Y + 1 = 4Y(Y-1) + 1
  have hA_sq : A^2 = 4 * (Y * (Y - 1)) + 1 := by
    calc
      A^2 = (2*Y - 1)^2 := rfl
      _ = 4*Y^2 - 4*Y + 1 := by ring
      _ = 4 * (Y * (Y - 1)) + 1 := by ring
      
  have hB_sq : B^2 = 4 * (X * (X - 1)) + 1 := by
    calc
      B^2 = (2*X - 1)^2 := rfl
      _ = 4*X^2 - 4*X + 1 := by ring
      _ = 4 * (X * (X - 1)) + 1 := by ring
      
  have h_diff_mod : A^2 - B^2 = 4 * (Y * (Y - 1)) - 4 * (X * (X - 1)) := by
    calc
      A^2 - B^2 = (4 * (Y * (Y - 1)) + 1) - (4 * (X * (X - 1)) + 1) := by rw [hA_sq, hB_sq]
      _ = 4 * (Y * (Y - 1)) - 4 * (X * (X - 1)) := by ring
      
  -- Now we know Y(Y-1) and X(X-1) are even.
  have hY_even : ∃ k : ℤ, Y * (Y - 1) = 2 * k := by
    cases Int.emod_two_eq_zero_or_one Y with
    | inl hY_even =>
      have hY_div : 2 ∣ Y := Int.dvd_of_emod_eq_zero hY_even
      rcases hY_div with ⟨m, hm⟩
      use m * (Y - 1)
      calc
        Y * (Y - 1) = (2 * m) * (Y - 1) := by rw [hm]
        _ = 2 * (m * (Y - 1)) := by ring
    | inr hY_odd =>
      have hY1_even : (Y - 1) % 2 = 0 := by omega
      have hY1_div : 2 ∣ (Y - 1) := Int.dvd_of_emod_eq_zero hY1_even
      rcases hY1_div with ⟨m, hm⟩
      use Y * m
      calc
        Y * (Y - 1) = Y * (2 * m) := by rw [hm]
        _ = 2 * (Y * m) := by ring
      
  have hX_even : ∃ k : ℤ, X * (X - 1) = 2 * k := by
    cases Int.emod_two_eq_zero_or_one X with
    | inl hX_even =>
      have hX_div : 2 ∣ X := Int.dvd_of_emod_eq_zero hX_even
      rcases hX_div with ⟨m, hm⟩
      use m * (X - 1)
      calc
        X * (X - 1) = (2 * m) * (X - 1) := by rw [hm]
        _ = 2 * (m * (X - 1)) := by ring
    | inr hX_odd =>
      have hX1_even : (X - 1) % 2 = 0 := by omega
      have hX1_div : 2 ∣ (X - 1) := Int.dvd_of_emod_eq_zero hX1_even
      rcases hX1_div with ⟨m, hm⟩
      use X * m
      calc
        X * (X - 1) = X * (2 * m) := by rw [hm]
        _ = 2 * (X * m) := by ring
      
  rcases hY_even with ⟨kY, hkY⟩
  rcases hX_even with ⟨kX, hkX⟩
  
  have h_diff_mod8 : A^2 - B^2 = 8 * (kY - kX) := by
    calc
      A^2 - B^2 = 4 * (Y * (Y - 1)) - 4 * (X * (X - 1)) := h_diff_mod
      _ = 4 * (2 * kY) - 4 * (2 * kX) := by rw [hkY, hkX]
      _ = 8 * (kY - kX) := by ring
      
  have h_4_eq_8 : 4 = 8 * (kY - kX) := by
    calc
      4 = A^2 - B^2 := h_diff.symm
      _ = 8 * (kY - kX) := h_diff_mod8
      
  -- 4 = 8 * something, so 1 = 2 * something, impossible
  have h_imposs : 1 = 2 * (kY - kX) := by linarith
  omega
