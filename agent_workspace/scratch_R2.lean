import Mathlib
import problem_statement
import residual_growth_bound
import fundamental_inequality

open Filter Topology Finset

variable (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ)

lemma R2_val_eq_tailResidual (N : ℕ) (hq2 : q₂ > 0) (hp2 : p₂ > 0)
    (hGe2 : ∀ k, a k ≥ 2)
    (hSum2 : HasSum (fun k => 1 / ((a k : ℝ) - 1)) (p₂ / q₂)) :
    R2_val a p₂ q₂ N = (tailResidual (fun k => a k - 1) p₂.toNat q₂ N : ℝ) := by
  have h_pos : ∀ k, a k - 1 > 0 := fun k => by have := hGe2 k; omega
  have h_sum2_eq : p₂ / q₂ - (range N).sum (fun i => 1 / ((a i : ℝ) - 1)) = ∑' k, 1 / ((a (k + N) : ℝ) - 1) := by
    have h_split := sum_add_tsum_nat_add N hSum2.summable
    linarith [hSum2.tsum_eq]
  unfold R2_val
  rw [h_sum2_eq]
  have h_p2_eq : (p₂.toNat : ℝ) = p₂ := by exact_mod_cast (Int.toNat_of_nonneg (by omega))

  have h_sum2_alt : HasSum (fun k => 1 / (((fun j => a j - 1) k : ℕ) : ℝ)) (p₂.toNat / (q₂ : ℝ)) := by
    have h_eq : (fun k => 1 / (((fun j => a j - 1) k : ℕ) : ℝ)) = (fun k => 1 / ((a k : ℝ) - 1)) := by
      ext k
      have ha_ge1 : a k ≥ 1 := by have := hGe2 k; omega
      exact_mod_cast (congrArg (fun x => 1 / x) (Nat.cast_sub (R := ℝ) ha_ge1).symm)
    rw [h_eq]
    have : ((p₂.toNat : ℝ) / q₂) = p₂ / q₂ := by
      rw [h_p2_eq]
      push_cast
      rfl
    rw [this]
    exact hSum2

  have h_tail := tailResidual_eq_sum (fun k => a k - 1) p₂.toNat q₂ h_sum2_alt.summable h_sum2_alt.tsum_eq h_pos (by omega) N
  
  have h_shift_eq : ∑' (k : ℕ), 1 / (((fun j => a j - 1) (N + k) : ℕ) : ℝ) = ∑' (k : ℕ), 1 / ((a (k + N) : ℝ) - 1) := by
    congr 1
    ext k
    have ha_ge1 : a (k + N) ≥ 1 := by have := hGe2 (k + N); omega
    have h_idx : N + k = k + N := by omega
    have h_eq : (((a (k + N) - 1 : ℕ) : ℝ)) = (a (k + N) : ℝ) - 1 := by exact_mod_cast (Nat.cast_sub (R := ℝ) ha_ge1)
    rw [h_idx]
    rw [h_eq]
    
  rw [h_shift_eq] at h_tail
  have h_P2 : P2_N a N = (prefixProduct (fun k => a k - 1) N : ℝ) := P2_eq_prefixProduct_shift a N hGe2
  rw [h_P2]
  exact h_tail.symm
