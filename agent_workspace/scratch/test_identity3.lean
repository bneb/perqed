import Mathlib

open Filter Topology

noncomputable section

def prefixProduct (seq : ℕ → ℕ) : ℕ → ℕ
  | 0 => 1
  | n + 1 => prefixProduct seq n * seq n

def tailResidual (seq : ℕ → ℕ) (num denom : ℕ) : ℕ → ℤ
  | 0 => (num : ℤ)
  | n + 1 => (seq n : ℤ) * tailResidual seq num denom n - 
             (denom : ℤ) * (prefixProduct seq n : ℤ)

theorem tailResidual_eq_sum (seq : ℕ → ℕ) (num denom : ℕ)
    (hSum : Summable (fun k => (1 : ℝ) / (seq k : ℝ)))
    (hSum_val : ∑' k, (1 : ℝ) / (seq k : ℝ) = (num : ℝ) / denom)
    (h_pos : ∀ k, seq k > 0) (hDenom : denom ≥ 1)
    (n : ℕ) :
    (tailResidual seq num denom n : ℝ) = 
      (denom : ℝ) * (prefixProduct seq n : ℝ) * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ)) := by
  induction' n with n ih
  · simp [tailResidual, prefixProduct]
    have hSum_val_inv : ∑' k, (seq k : ℝ)⁻¹ = (num : ℝ) / denom := by
      have heq : (fun k => (seq k : ℝ)⁻¹) = (fun k => 1 / (seq k : ℝ)) := by
        ext k
        rw [one_div]
      rw [heq]
      exact hSum_val
    have hDenomPos : denom > 0 := by omega
    have hd : (denom : ℝ) ≠ 0 := by exact_mod_cast (ne_of_gt hDenomPos)
    rw [hSum_val_inv]
    exact (mul_div_cancel' (num : ℝ) hd).symm
  · simp [tailResidual, prefixProduct]
    push_cast
    rw [ih]
    
    have hSum_n_shift : Summable (fun k => (1 : ℝ) / (seq (k + n) : ℝ)) := (summable_nat_add_iff n).mpr hSum
    have hSum_n : Summable (fun k => (1 : ℝ) / (seq (n + k) : ℝ)) := by
      have h_comm : (fun k => (1 : ℝ) / (seq (k + n) : ℝ)) = (fun k => (1 : ℝ) / (seq (n + k) : ℝ)) := by
        ext k
        have h_add : k + n = n + k := add_comm k n
        rw [h_add]
      rw [← h_comm]
      exact hSum_n_shift
      
    have h_split := tsum_eq_zero_add hSum_n
    have h_zero_term : (1 : ℝ) / (seq (n + 0) : ℝ) = 1 / (seq n : ℝ) := by rw [add_zero]
    rw [h_zero_term] at h_split
    rw [h_split]
    
    have h_seq_ne_zero : (seq n : ℝ) ≠ 0 := by
      have h1 := h_pos n
      exact_mod_cast (ne_of_gt h1)
      
    have h_mul_inv : (seq n : ℝ) * (1 / (seq n : ℝ)) = 1 := mul_one_div_cancel h_seq_ne_zero
    
    have h_end : ∑' (i : ℕ), 1 / (seq (n + 1 + i) : ℝ) = ∑' (k : ℕ), (seq (n + 1 + k) : ℝ)⁻¹ := by
      have heq : (fun i => 1 / (seq (n + 1 + i) : ℝ)) = (fun i => (seq (n + 1 + i) : ℝ)⁻¹) := by
        ext i
        rw [one_div]
      rw [heq]
      
    calc
      (seq n : ℝ) * ((denom : ℝ) * (prefixProduct seq n : ℝ) * (1 / (seq n : ℝ) + ∑' (i : ℕ), 1 / (seq (n + (i + 1)) : ℝ))) - (denom : ℝ) * (prefixProduct seq n : ℝ)
      _ = (denom : ℝ) * (prefixProduct seq n : ℝ) * ((seq n : ℝ) * (1 / (seq n : ℝ) + ∑' (i : ℕ), 1 / (seq (n + (i + 1)) : ℝ))) - (denom : ℝ) * (prefixProduct seq n : ℝ) := by ring
      _ = (denom : ℝ) * (prefixProduct seq n : ℝ) * ((seq n : ℝ) * (1 / (seq n : ℝ)) + (seq n : ℝ) * ∑' (i : ℕ), 1 / (seq (n + (i + 1)) : ℝ)) - (denom : ℝ) * (prefixProduct seq n : ℝ) := by rw [mul_add]
      _ = (denom : ℝ) * (prefixProduct seq n : ℝ) * (1 + (seq n : ℝ) * ∑' (i : ℕ), 1 / (seq (n + (i + 1)) : ℝ)) - (denom : ℝ) * (prefixProduct seq n : ℝ) := by rw [h_mul_inv]
      _ = (denom : ℝ) * (prefixProduct seq n : ℝ) * 1 + (denom : ℝ) * (prefixProduct seq n : ℝ) * ((seq n : ℝ) * ∑' (i : ℕ), 1 / (seq (n + (i + 1)) : ℝ)) - (denom : ℝ) * (prefixProduct seq n : ℝ) := by ring
      _ = (denom : ℝ) * (prefixProduct seq n : ℝ) * (seq n : ℝ) * ∑' (i : ℕ), 1 / (seq (n + (i + 1)) : ℝ) := by ring
      _ = (denom : ℝ) * ((prefixProduct seq n : ℝ) * (seq n : ℝ)) * ∑' (i : ℕ), 1 / (seq (n + 1 + i) : ℝ) := by
        have h_idx : (fun (i : ℕ) => 1 / (seq (n + (i + 1)) : ℝ)) = (fun (i : ℕ) => 1 / (seq (n + 1 + i) : ℝ)) := by
          ext i
          have h_eq : n + (i + 1) = n + 1 + i := by omega
          rw [h_eq]
        rw [h_idx]
        ring
      _ = (denom : ℝ) * ((prefixProduct seq n : ℝ) * (seq n : ℝ)) * ∑' (k : ℕ), (seq (n + 1 + k) : ℝ)⁻¹ := by rw [h_end]

end
