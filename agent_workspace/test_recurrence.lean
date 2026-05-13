import Mathlib
import problem_statement
import residual_growth_bound
import fundamental_inequality

open Filter Topology Finset

variable (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ)

lemma P1_N_succ (N : ℕ) : P1_N_int a (N + 1) = P1_N_int a N * (a N : ℤ) := by
  unfold P1_N_int
  rw [prod_range_succ]

lemma P2_N_succ (N : ℕ) : P2_N_int a (N + 1) = P2_N_int a N * ((a N : ℤ) - 1) := by
  unfold P2_N_int
  rw [prod_range_succ]

lemma R1_N_succ (N : ℕ) : tailResidual a p₁.toNat q₁ (N + 1) = (a N : ℤ) * tailResidual a p₁.toNat q₁ N - (q₁ : ℤ) * P1_N_int a N := by
  unfold tailResidual
  have h_P1 : (prefixProduct a N : ℤ) = P1_N_int a N := by
    unfold prefixProduct P1_N_int
    rfl
  rw [h_P1]
  ring

lemma R2_N_succ (N : ℕ) : tailResidual (fun k => a k - 1) p₂.toNat q₂ (N + 1) = ((a N : ℤ) - 1) * tailResidual (fun k => a k - 1) p₂.toNat q₂ N - (q₂ : ℤ) * P2_N_int a N := by
  unfold tailResidual
  have h_P2 : (prefixProduct (fun k => a k - 1) N : ℤ) = P2_N_int a N := by
    unfold prefixProduct P2_N_int
    rfl
  rw [h_P2]
  ring

lemma C_val_int_succ (N : ℕ) :
    C_val_int a p₁ p₂ q₁ q₂ (N + 1) = (a N : ℤ) * ((a N : ℤ) - 1) * C_val_int a p₁ p₂ q₁ q₂ N - (q₁ : ℤ) * (q₂ : ℤ) * P1_N_int a N * P2_N_int a N := by
  unfold C_val_int
  rw [P1_N_succ a N, P2_N_succ a N, R1_N_succ a p₁ q₁ N, R2_N_succ a p₂ q₂ N]
  ring
