import Mathlib
import src.lean.erdos265.residual_growth_bound

open Filter Topology

theorem constant_residual_implies_sylvester (seq : ℕ → ℕ) (num denom : ℕ) (C : ℤ) (N : ℕ)
    (h_const : ∀ n ≥ N, tailResidual seq num denom n = C) (h_C_pos : C > 0)
    (h_denom_pos : denom > 0) :
    ∀ n ≥ N, seq (n + 1) = seq n * seq n - seq n + 1 := by
  intro n hn
  have h1 : tailResidual seq num denom n = C := h_const n hn
  have h2 : tailResidual seq num denom (n + 1) = C := h_const (n + 1) (by omega)
  have h_rec := tailResidualSuccessor seq num denom n
  rw [h1, h2] at h_rec
  
  have h_P : (denom : ℤ) * (prefixProduct seq n : ℤ) = C * (seq n - 1 : ℤ) := by
    calc
      (denom : ℤ) * (prefixProduct seq n : ℤ) = (seq n : ℤ) * C - C := by linarith [h_rec]
      _ = C * ((seq n : ℤ) - 1) := by ring
      
  have h3 : tailResidual seq num denom (n + 2) = C := h_const (n + 2) (by omega)
  have h_rec2 := tailResidualSuccessor seq num denom (n + 1)
  rw [h2, h3] at h_rec2
  
  have h_P2 : (denom : ℤ) * (prefixProduct seq (n + 1) : ℤ) = C * (seq (n + 1) - 1 : ℤ) := by
    calc
      (denom : ℤ) * (prefixProduct seq (n + 1) : ℤ) = (seq (n + 1) : ℤ) * C - C := by linarith [h_rec2]
      _ = C * ((seq (n + 1) : ℤ) - 1) := by ring
      
  have h_P_step : prefixProduct seq (n + 1) = prefixProduct seq n * seq n := rfl
  have h_P2_step : (denom : ℤ) * (prefixProduct seq (n + 1) : ℤ) = (denom : ℤ) * (prefixProduct seq n : ℤ) * (seq n : ℤ) := by
    push_cast
    ring
    
  rw [h_P2_step] at h_P2
  rw [h_P] at h_P2
  
  have h_eq : C * (seq (n + 1) - 1 : ℤ) = C * ((seq n - 1 : ℤ) * (seq n : ℤ)) := by
    calc
      C * (seq (n + 1) - 1 : ℤ) = C * (seq n - 1 : ℤ) * (seq n : ℤ) := h_P2.symm
      _ = C * ((seq n - 1 : ℤ) * (seq n : ℤ)) := by ring
      
  have h_cancel : (seq (n + 1) : ℤ) - 1 = (seq n : ℤ) * (seq n : ℤ) - (seq n : ℤ) := by
    have h_C_ne_zero : C ≠ 0 := by omega
    have h_div := mul_left_cancel₀ h_C_ne_zero h_eq
    calc
      (seq (n + 1) : ℤ) - 1 = (seq n - 1 : ℤ) * (seq n : ℤ) := h_div
      _ = (seq n : ℤ) * (seq n : ℤ) - (seq n : ℤ) := by ring
      
  have h_final : (seq (n + 1) : ℤ) = (seq n : ℤ) * (seq n : ℤ) - (seq n : ℤ) + 1 := by linarith
  exact_mod_cast h_final
