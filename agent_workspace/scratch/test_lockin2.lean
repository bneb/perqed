import Mathlib

def prefixProduct (seq : ℕ → ℕ) : ℕ → ℕ
  | 0 => 1
  | n + 1 => prefixProduct seq n * seq n

theorem constant_residual_implies_sylvester_core
    (seq : ℕ → ℕ) (denom : ℕ) (C : ℤ) (n : ℕ)
    (h_P : (denom : ℤ) * (prefixProduct seq n : ℤ) = C * (seq n - 1 : ℤ))
    (h_P2 : (denom : ℤ) * (prefixProduct seq (n + 1) : ℤ) = C * (seq (n + 1) - 1 : ℤ))
    (h_C_pos : C ≠ 0) :
    seq (n + 1) + seq n = seq n * seq n + 1 := by
  have h_P_step : prefixProduct seq (n + 1) = prefixProduct seq n * seq n := rfl
  have h_P2_step : (denom : ℤ) * (prefixProduct seq (n + 1) : ℤ) = (denom : ℤ) * (prefixProduct seq n : ℤ) * (seq n : ℤ) := by
    rw [h_P_step]
    push_cast
    ring
  rw [h_P2_step] at h_P2
  rw [h_P] at h_P2
  have h_eq : C * (seq (n + 1) - 1 : ℤ) = C * ((seq n - 1 : ℤ) * (seq n : ℤ)) := by
    calc
      C * (seq (n + 1) - 1 : ℤ) = C * (seq n - 1 : ℤ) * (seq n : ℤ) := h_P2.symm
      _ = C * ((seq n - 1 : ℤ) * (seq n : ℤ)) := by ring
  have h_div := mul_left_cancel₀ h_C_pos h_eq
  have h_final : (seq (n + 1) : ℤ) + (seq n : ℤ) = (seq n : ℤ) * (seq n : ℤ) + 1 := by
    calc
      (seq (n + 1) : ℤ) + (seq n : ℤ) = (seq (n + 1) : ℤ) - 1 + (seq n : ℤ) + 1 := by ring
      _ = (seq n - 1 : ℤ) * (seq n : ℤ) + (seq n : ℤ) + 1 := by rw [h_div]
      _ = (seq n : ℤ) * (seq n : ℤ) + 1 := by ring
  exact_mod_cast h_final
