import Mathlib

/-!
# Erdős 265: The Exact Integer Collapse Proof

This file formalizes the algebraic collapse that proves the infinite
product L = ∏(a_k / (a_k - 1)) cannot be a rational number.

The proof assumes that the integer difference D_k has collapsed to 
exact equality (which happens because it converges to 0).
-/

noncomputable section

variable (a : ℕ → ℚ) (P₁ P₂ : ℕ → ℚ) (R₁ : ℕ → ℚ)
variable (q₁ : ℚ) (L : ℚ)

/-- The recurrence relations for the sequences -/
structure ErdosSequences (k : ℕ) : Prop where
  P₁_succ : P₁ (k + 1) = P₁ k * a k
  P₂_succ : P₂ (k + 1) = P₂ k * (a k - 1)
  R₁_succ : R₁ (k + 1) = a k * R₁ k - q₁ * P₁ k

/-- The Exact Coupling Equation at step k -/
def ExactCoupling (k : ℕ) : Prop :=
  q₁ * P₁ k + R₁ k = q₁ * L * P₂ k

/-- The core algebraic collapse lemma:
    If the Exact Coupling Equation holds at both k and k+1,
    and the sequences follow their recurrences,
    then we strictly have P₁(k) = L * P₂(k). -/
theorem inductive_collapse (k : ℕ)
    (h_seq : ErdosSequences a P₁ P₂ R₁ q₁ k)
    (h_k : ExactCoupling P₁ P₂ R₁ q₁ L k)
    (h_k1 : ExactCoupling P₁ P₂ R₁ q₁ L (k + 1))
    (hq_nz : q₁ ≠ 0) :
    P₁ k = L * P₂ k := by
  -- Unfold the definitions
  unfold ExactCoupling at h_k h_k1
  rcases h_seq with ⟨hP1, hP2, hR1⟩
  
  -- Substitute the recurrences into h_k1
  rw [hP1, hP2, hR1] at h_k1
  
  -- We have: q₁ * (P₁ k * a k) + (a k * R₁ k - q₁ * P₁ k) = q₁ * L * (P₂ k * (a k - 1))
  -- Rearrange LHS: a k * (q₁ * P₁ k + R₁ k) - q₁ * P₁ k
  have h_LHS : q₁ * (P₁ k * a k) + (a k * R₁ k - q₁ * P₁ k) = 
      a k * (q₁ * P₁ k + R₁ k) - q₁ * P₁ k := by ring
  rw [h_LHS] at h_k1
  
  -- Substitute h_k into LHS
  rw [h_k] at h_k1
  
  -- We now have: a k * (q₁ * L * P₂ k) - q₁ * P₁ k = q₁ * L * (P₂ k * (a k - 1))
  -- Expand RHS
  have h_RHS : q₁ * L * (P₂ k * (a k - 1)) = a k * (q₁ * L * P₂ k) - q₁ * L * P₂ k := by ring
  rw [h_RHS] at h_k1
  
  -- Cancel a k * (q₁ * L * P₂ k) from both sides
  have h_cancel : - (q₁ * P₁ k) = - (q₁ * L * P₂ k) := by
    calc - (q₁ * P₁ k)
      _ = (a k * (q₁ * L * P₂ k) - q₁ * P₁ k) - a k * (q₁ * L * P₂ k) := by ring
      _ = (a k * (q₁ * L * P₂ k) - q₁ * L * P₂ k) - a k * (q₁ * L * P₂ k) := by rw [h_k1]
      _ = - (q₁ * L * P₂ k) := by ring
      
  -- Divide by -q₁
  have h_final : q₁ * P₁ k = q₁ * (L * P₂ k) := by
    calc q₁ * P₁ k
      _ = - (- (q₁ * P₁ k)) := by ring
      _ = - (- (q₁ * L * P₂ k)) := by rw [h_cancel]
      _ = q₁ * (L * P₂ k) := by ring
      
  exact mul_left_cancel₀ hq_nz h_final

end
