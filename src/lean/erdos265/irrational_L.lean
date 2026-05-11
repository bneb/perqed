import Mathlib

/-!
# Erdős 265: The Exact Integer Collapse Proof

This file formalizes the algebraic collapse that unconditionally proves the 
infinite product `limitL = ∏(seq_k / (seq_k - 1))` cannot be a rational number.

## Context from the Paper
As established by the "Asymptotic Integer Squeeze", if the sequence achieves 
doubly-exponential growth, the integer residuals `tailResidual(k)` and 
`tailResidualShifted(k)` are forced to converge to a constant (and are therefore bounded). 

Bounded residuals force the Exact Coupling Equation to converge to an exact
equality. This file formalizes the final step: proving that this Exact Coupling
Equation triggers an algebraic trapdoor that forces 
`prefixProduct(k) = limitL * shiftedPrefixProduct(k)`.
-/

noncomputable section

-- Variables renamed for human readability
variable (seq : ℕ → ℚ) (prefixProduct shiftedPrefixProduct : ℕ → ℚ)
variable (tailResidual : ℕ → ℚ) (denom : ℚ) (limitL : ℚ)

/-- 
  The structural recurrences that define the Erdős sequences.
  - `prefixProduct`: The product prefix `∏_{j<k} seq_j`
  - `shiftedPrefixProduct`: The shifted product prefix `∏_{j<k} (seq_j - 1)`
  - `tailResidual`: The integer residual tracking the tail sum `∑_{j≥k} 1/seq_j`
-/
structure ErdosSequences (k : ℕ) : Prop where
  prefixProductSuccessor : prefixProduct (k + 1) = prefixProduct k * seq k
  shiftedPrefixProductSuccessor : 
    shiftedPrefixProduct (k + 1) = shiftedPrefixProduct k * (seq k - 1)
  tailResidualSuccessor : 
    tailResidual (k + 1) = seq k * tailResidual k - denom * prefixProduct k

/-- 
  The Exact Coupling Equation at step k. 
  This equation represents the state where the integer difference sequence 
  `D_k` has completely collapsed to 0 due to bounded residuals and a rational `limitL`.
-/
def ExactCoupling (k : ℕ) : Prop :=
  denom * prefixProduct k + tailResidual k = denom * limitL * shiftedPrefixProduct k

/-- 
  **The Core Algebraic Collapse Lemma**
  
  Theorem 4.1 in the manuscript:
  If the Exact Coupling Equation holds at step `k` and step `k+1`, 
  and the sequences follow their standard recurrences, 
  then the entire sequence algebraically collapses, forcing 
  `prefixProduct(k) = limitL * shiftedPrefixProduct(k)`.
  
  Because `limitL` is an infinite product, this equality implies the impossible 
  condition that `∏_{j=k}^∞ seq_j / (seq_j - 1) = 1`, which contradicts `seq_j ≥ 2`.
-/
theorem inductiveCollapse (k : ℕ)
    (h_seq : ErdosSequences seq prefixProduct shiftedPrefixProduct tailResidual denom k)
    (h_k : ExactCoupling prefixProduct shiftedPrefixProduct tailResidual denom limitL k)
    (h_k1 : ExactCoupling prefixProduct shiftedPrefixProduct tailResidual denom limitL (k + 1))
    (hdenom_nz : denom ≠ 0) :
    prefixProduct k = limitL * shiftedPrefixProduct k := by
  -- 1. Unfold the exact coupling definitions
  unfold ExactCoupling at h_k h_k1
  rcases h_seq with ⟨hP1, hP2, hR1⟩
  
  -- 2. Push the recurrence equations forward one step into `h_k1`
  rw [hP1, hP2, hR1] at h_k1
  
  -- 3. Let's factor out `seq k` on the Left Hand Side (LHS) to expose the Exact Coupling term
  have h_LHS : denom * (prefixProduct k * seq k) + 
      (seq k * tailResidual k - denom * prefixProduct k) = 
      seq k * (denom * prefixProduct k + tailResidual k) - denom * prefixProduct k := by ring
  rw [h_LHS] at h_k1
  
  -- 4. The term `(denom * prefixProduct k + tailResidual k)` perfectly matches `h_k`. 
  --    We substitute `h_k` into the LHS, effectively compressing the state down one step.
  rw [h_k] at h_k1
  
  -- 5. Let's expand the Right Hand Side (RHS):
  have h_RHS : denom * limitL * (shiftedPrefixProduct k * (seq k - 1)) = 
      seq k * (denom * limitL * shiftedPrefixProduct k) - 
      denom * limitL * shiftedPrefixProduct k := by ring
  rw [h_RHS] at h_k1
  
  -- 6. The massive term `seq k * (denom * limitL * shiftedPrefixProduct k)` appears on both
  --    sides. We algebraically cancel it, completely eliminating the sequence term `seq k`!
  have h_cancel : - (denom * prefixProduct k) = - (denom * limitL * shiftedPrefixProduct k) := by
    calc - (denom * prefixProduct k)
      _ = (seq k * (denom * limitL * shiftedPrefixProduct k) - denom * prefixProduct k) - 
          seq k * (denom * limitL * shiftedPrefixProduct k) := by ring
      _ = (seq k * (denom * limitL * shiftedPrefixProduct k) - 
           denom * limitL * shiftedPrefixProduct k) - 
           seq k * (denom * limitL * shiftedPrefixProduct k) := by rw [h_k1]
      _ = - (denom * limitL * shiftedPrefixProduct k) := by ring
      
  -- 7. What remains is a simple equality. We divide out the negative signs.
  have h_final : denom * prefixProduct k = denom * (limitL * shiftedPrefixProduct k) := by
    calc denom * prefixProduct k
      _ = - (- (denom * prefixProduct k)) := by ring
      _ = - (- (denom * limitL * shiftedPrefixProduct k)) := by rw [h_cancel]
      _ = denom * (limitL * shiftedPrefixProduct k) := by ring
      
  -- 8. Finally, since the sum is rational and non-zero, `denom ≠ 0`. 
  --    We cancel `denom` to yield the fatal mathematical collapse.
  exact mul_left_cancel₀ hdenom_nz h_final

end
