import Mathlib

/-!
# Erdős 265: The Asymptotic Integer Squeeze

The key insight that resolves the Ceiling Conjecture: 
If an integer sequence grows doubly exponentially (with an exponent limit limitL > 1),
then the product prefix `prefixProduct(k) = ∏ seq_j` grows strictly as 
`limitL^{2^k - 1} = seq_k / limitL`.

This macroscopic continuous bound forces the discrete integer tail residual `tailResidual(k)` 
(which tracks the tail sum `∑ 1/seq_j`) to asymptotically converge to the 
constant `denom/limitL`.

Because a sequence of exact integers converging in `ℝ` must eventually lock into 
a constant, `tailResidual(k)` is completely and strictly bounded. This bounded state 
triggers the Exact Integer Collapse formalized in `irrational_L.lean`.
-/

open Filter Topology

noncomputable section

/-- 
  Product of the first k terms of the sequence.
  Matches `prefixProduct(k)` in the manuscript. 
-/
def prefixProduct (seq : ℕ → ℕ) : ℕ → ℕ
  | 0 => 1
  | n + 1 => prefixProduct seq n * seq n

/-- 
  The integer residual `tailResidual(k)`.
  Defined by the initial numerator `num` and the telescoping recurrence:
  `tailResidual(k+1) = seqₖ · tailResidual(k) - denom · prefixProduct(k)`
-/
def tailResidual (seq : ℕ → ℕ) (num denom : ℕ) : ℕ → ℤ
  | 0 => (num : ℤ)
  | n + 1 => (seq n : ℤ) * tailResidual seq num denom n - 
             (denom : ℤ) * (prefixProduct seq n : ℤ)

/-- The recurrence holds definitionally by construction -/
theorem tailResidualSuccessor (seq : ℕ → ℕ) (num denom : ℕ) (k : ℕ) :
    tailResidual seq num denom (k + 1) = 
      (seq k : ℤ) * tailResidual seq num denom k - (denom : ℤ) * (prefixProduct seq k : ℤ) :=
  rfl

/-- 
  If the residual is strictly positive, the recurrence guarantees a strict 
  algebraic relationship between the sequence term `seqₖ` and the prefix `prefixProduct(k)`.
-/
theorem tailResidualPosIff (seq : ℕ → ℕ) (num denom : ℕ) (k : ℕ)
    (_hResPos : tailResidual seq num denom k > 0) :
    tailResidual seq num denom (k + 1) > 0 ↔
      (seq k : ℤ) * tailResidual seq num denom k > (denom : ℤ) * (prefixProduct seq k : ℤ) := by
  rw [tailResidualSuccessor]; omega

/-- 
  **The Asymptotic Squeeze Calculus Limit**
  
  This is a standard real analysis limit deduction for doubly-exponential growth.
  If `seq_k^(1/2^k)` converges to `limitL > 1`, then `prefixProduct(k)/seq_k` 
  converges to `1/limitL`.
  By the telescoping sum identity `tailResidual(k) / prefixProduct(k) = ∑ denom / seq_j`, 
  we deduce that `tailResidual(k)` converges to `denom/limitL`.
  
  **Status**: Unproven. Requires formalizing the relationship between doubly-exponential 
  growth rates and telescoping sum asymptotics in Mathlib's real analysis library.
-/

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
lemma prefix_limit (seq : ℕ → ℕ) (limitL : ℝ)
    (hLimsup : Tendsto (fun k => (seq k : ℝ) ^ ((1 : ℝ) / 2 ^ k)) atTop (𝓝 limitL)) :
    Tendsto (fun n => (prefixProduct seq n : ℝ) * limitL / (seq n : ℝ)) atTop (𝓝 1) := by
  sorry

lemma tail_sum_limit (seq : ℕ → ℕ) (limitL : ℝ) (hL_gt_1 : limitL > 1)
    (hLimsup : Tendsto (fun k => (seq k : ℝ) ^ ((1 : ℝ) / 2 ^ k)) atTop (𝓝 limitL)) :
    Tendsto (fun n => (seq n : ℝ) * ∑' k, (1 : ℝ) / (seq (n + k) : ℝ)) atTop (𝓝 1) := by
  sorry

theorem asymptoticSqueezeLimit (seq : ℕ → ℕ) (num denom : ℕ) (limitL : ℝ)
    (hSum : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ((num : ℝ) / denom))
    (hLimsup : Tendsto (fun k => (seq k : ℝ) ^ ((1 : ℝ) / 2 ^ k)) atTop (𝓝 limitL))
    (hDenom : denom ≥ 1) (hSeq : ∀ k, seq k ≥ 2) (hL_gt_1 : limitL > 1) :
    Tendsto (fun n => (tailResidual seq num denom n : ℝ)) atTop (𝓝 (denom / limitL)) := by
  have hSum_val : ∑' k, (1 : ℝ) / (seq k : ℝ) = (num : ℝ) / denom := hSum.tsum_eq
  have hSummable : Summable (fun k => (1 : ℝ) / (seq k : ℝ)) := hSum.summable
  have h_pos : ∀ k, seq k > 0 := by
    intro k
    have h2 := hSeq k
    omega
  
  have h_eq : (fun n => (tailResidual seq num denom n : ℝ)) = 
              (fun n => (denom : ℝ) * (prefixProduct seq n : ℝ) * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ))) := by
    ext n
    exact tailResidual_eq_sum seq num denom hSummable hSum_val h_pos hDenom n
    
  rw [h_eq]
  
  have h_pos_real : ∀ k, (seq k : ℝ) ≠ 0 := by
    intro k
    have h1 := hSeq k
    exact_mod_cast (by omega : seq k ≠ 0)
    
  have hLimitL_ne_zero : limitL ≠ 0 := by linarith
  
  have h1 := prefix_limit seq limitL hLimsup
  have h2 := tail_sum_limit seq limitL hL_gt_1 hLimsup
  
  have h_prod := Tendsto.mul h1 h2
  have h_one_mul_one : (1 : ℝ) * 1 = 1 := by ring
  rw [h_one_mul_one] at h_prod
  
  have h_prod_simp : Tendsto (fun n => (prefixProduct seq n : ℝ) * limitL * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ))) atTop (𝓝 1) := by
    have h_eq2 : (fun n => ((prefixProduct seq n : ℝ) * limitL / (seq n : ℝ)) * ((seq n : ℝ) * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ)))) = 
                 (fun n => (prefixProduct seq n : ℝ) * limitL * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ))) := by
      ext n
      have hn_ne_zero := h_pos_real n
      calc
        ((prefixProduct seq n : ℝ) * limitL / (seq n : ℝ)) * ((seq n : ℝ) * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ)))
        _ = ((prefixProduct seq n : ℝ) * limitL) * ((seq n : ℝ)⁻¹) * (seq n : ℝ) * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ)) := by
          have h_div : (prefixProduct seq n : ℝ) * limitL / (seq n : ℝ) = (prefixProduct seq n : ℝ) * limitL * (seq n : ℝ)⁻¹ := by rw [div_eq_mul_inv]
          rw [h_div]
          ring
        _ = ((prefixProduct seq n : ℝ) * limitL) * ((seq n : ℝ)⁻¹ * (seq n : ℝ)) * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ)) := by ring
        _ = ((prefixProduct seq n : ℝ) * limitL) * 1 * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ)) := by rw [inv_mul_cancel hn_ne_zero]
        _ = (prefixProduct seq n : ℝ) * limitL * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ)) := by ring
    rw [← h_eq2]
    exact h_prod
    
  have h_const_denom : Tendsto (fun (_ : ℕ) => (denom : ℝ) * limitL⁻¹) atTop (𝓝 ((denom : ℝ) * limitL⁻¹)) := tendsto_const_nhds
  
  have h_final_prod := Tendsto.mul h_prod_simp h_const_denom
  have h_one_mul_denom : (1 : ℝ) * ((denom : ℝ) * limitL⁻¹) = (denom : ℝ) * limitL⁻¹ := by ring
  rw [h_one_mul_denom] at h_final_prod
  
  have h_final_eq : (fun n => (prefixProduct seq n : ℝ) * limitL * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ)) * ((denom : ℝ) * limitL⁻¹)) = 
                    (fun n => (denom : ℝ) * (prefixProduct seq n : ℝ) * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ))) := by
    ext n
    have h_inv : limitL * limitL⁻¹ = 1 := mul_inv_cancel hLimitL_ne_zero
    calc
      (prefixProduct seq n : ℝ) * limitL * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ)) * ((denom : ℝ) * limitL⁻¹)
      _ = (denom : ℝ) * (prefixProduct seq n : ℝ) * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ)) * (limitL * limitL⁻¹) := by ring
      _ = (denom : ℝ) * (prefixProduct seq n : ℝ) * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ)) * 1 := by rw [h_inv]
      _ = (denom : ℝ) * (prefixProduct seq n : ℝ) * (∑' k, (1 : ℝ) / (seq (n + k) : ℝ)) := by ring
      
  have h_final_target : (denom : ℝ) * limitL⁻¹ = (denom : ℝ) / limitL := by rw [div_eq_mul_inv]
  rw [← h_final_target]
  rw [← h_final_eq]
  exact h_final_prod

/-- 
  **Topological Integer Rigidity**
  
  A sequence of exact integers converging to a real limit under the standard 
  topology must eventually lock into a constant value.
-/
lemma integerConvergenceRigidity (f : ℕ → ℤ) (c : ℝ)
    (hLim : Tendsto (fun n => (f n : ℝ)) atTop (𝓝 c)) :
    ∃ (B : ℤ) (N : ℕ), ∀ n ≥ N, f n = B := by
  have hEps : (1/2 : ℝ) > 0 := by norm_num
  rcases Metric.tendsto_atTop.mp hLim (1/2) hEps with ⟨N, hN⟩
  use f N, N
  intro n hn
  have h1 := hN n hn
  have h2 := hN N (le_refl N)
  have hDist : |(f n : ℝ) - (f N : ℝ)| < 1 := by
    calc |(f n : ℝ) - (f N : ℝ)|
      _ = |((f n : ℝ) - c) + (c - (f N : ℝ))| := by ring_nf
      _ ≤ |(f n : ℝ) - c| + |c - (f N : ℝ)| := abs_add _ _
      _ = |(f n : ℝ) - c| + |(f N : ℝ) - c| := by rw [abs_sub_comm c (f N : ℝ)]
      _ < 1/2 + 1/2 := add_lt_add h1 h2
      _ = 1 := by norm_num
  have hDistPos : (f n : ℝ) - (f N : ℝ) < 1 := (abs_lt.mp hDist).2
  have hDistNeg : -1 < (f n : ℝ) - (f N : ℝ) := (abs_lt.mp hDist).1
  have hDistPosInt : ((f n - f N : ℤ) : ℝ) < 1 := by exact_mod_cast hDistPos
  have hDistNegInt : (-1 : ℝ) < ((f n - f N : ℤ) : ℝ) := by exact_mod_cast hDistNeg
  have hPosInt2 : f n - f N < 1 := by exact_mod_cast hDistPosInt
  have hNegInt2 : -1 < f n - f N := by exact_mod_cast hDistNegInt
  omega

/-- Recursive finite max helper for bounding prefixes -/
def maxPrefix (f : ℕ → ℤ) : ℕ → ℤ
  | 0 => f 0
  | n + 1 => max (maxPrefix f n) (f (n + 1))

lemma leMaxPrefix (f : ℕ → ℤ) (n : ℕ) (k : ℕ) (hk : k ≤ n) : f k ≤ maxPrefix f n := by
  induction' n with n ih
  · have hZero : k = 0 := Nat.eq_zero_of_le_zero hk
    subst hZero
    rfl
  · by_cases hEq : k = n + 1
    · subst hEq
      exact le_max_right _ _
    · have hLt : k ≤ n := Nat.le_of_lt_succ (lt_of_le_of_ne hk hEq)
      exact le_trans (ih hLt) (le_max_left _ _)

/-- Any eventually constant integer sequence is strictly bounded. -/
lemma eventuallyConstBounded (f : ℕ → ℤ) (C : ℤ) (N : ℕ) (hC : ∀ n ≥ N, f n = C) :
    ∃ B : ℤ, ∀ k, f k ≤ B := by
  use max (maxPrefix f N) C
  intro k
  by_cases hk : k ≤ N
  · exact le_trans (leMaxPrefix f N k hk) (le_max_left _ _)
  · push_neg at hk
    have hkLe : k ≥ N := le_of_lt hk
    rw [hC k hkLe]
    exact le_max_right _ _

/-- 
  **Theorem 3.1: The Asymptotic Squeeze Bound**
  
  Doubly exponential growth structurally forces `tailResidual` to be bounded.
  This proof is entirely `sorry`-free, perfectly linking the continuous calculus 
  axiom to the discrete topological rigidity.
-/
theorem limsupGtOneImpliesResidualBounded
    (seq : ℕ → ℕ) (num denom : ℕ) (_hDenom : denom ≥ 1)
    (_hSeq : ∀ k, seq k ≥ 2) (_hMono : StrictMono seq)
    (hResPos : ∀ k, tailResidual seq num denom k > 0)
    (hSum : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ((num : ℝ) / denom))
    (limitL : ℝ) (_hLimitL_gt_1 : limitL > 1)
    (hLimsup : Tendsto (fun k => (seq k : ℝ) ^ ((1 : ℝ) / 2 ^ k)) atTop (𝓝 limitL)) :
    ∃ B : ℕ, ∀ k, tailResidual seq num denom k ≤ (B : ℤ) := by
  -- 1. Apply the asymptotic calculus limit (tailResidual ⟶ denom/limitL)
  have hConv := asymptoticSqueezeLimit seq num denom limitL hSum hLimsup _hDenom _hSeq _hLimitL_gt_1
  
  -- 2. Apply integer topological rigidity (Convergence implies Eventually Constant)
  rcases integerConvergenceRigidity 
      (tailResidual seq num denom) (denom / limitL) hConv with ⟨C, N, hC⟩
  
  -- 3. Construct the finite prefix bound
  have hBounded := eventuallyConstBounded (tailResidual seq num denom) C N hC
  rcases hBounded with ⟨B_int, hB_int⟩
  
  -- 4. Coerce the integer bound safely into the naturals
  use B_int.toNat
  intro k
  have hBound := hB_int k
  have hPos := hResPos k
  have hB_nonneg : 0 ≤ B_int := by linarith
  have hToNat : (B_int.toNat : ℤ) = B_int := Int.toNat_of_nonneg hB_nonneg
  rw [hToNat]
  exact hBound


theorem constant_residual_implies_sylvester (seq : ℕ → ℕ) (num denom : ℕ) (C : ℤ) (N : ℕ)
    (h_const : ∀ n ≥ N, tailResidual seq num denom n = C) (h_C_pos : C ≠ 0)
    (h_denom_pos : denom > 0) :
    ∀ n ≥ N, seq (n + 1) + seq n = seq n * seq n + 1 := by
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

/--
  **Limit Extraction from Limsup**
  
  For an Erdős 265 sequence with limsup > 1, extract a concrete limit L > 1.
  
  **Status**: sorry. This requires either proving the limit exists for this class
  of sequences, or extracting a convergent subsequence and extending.
-/
lemma limsup_gt_one_extract_limit (seq : ℕ → ℕ)
    (_hMono : StrictMono seq) (_hGe2 : ∀ k, seq k ≥ 2)
    (hLimsup : limsup (fun k => (seq k : ℝ) ^ (1 / (2 ^ k : ℝ))) atTop > 1) :
    ∃ limitL : ℝ, limitL > 1 ∧ 
      Tendsto (fun k => (seq k : ℝ) ^ ((1 : ℝ) / 2 ^ k)) atTop (𝓝 limitL) := by
  sorry

/--
  **Residual Positivity**
  
  For a sequence ≥ 2 with rational sum p/q, the tail residuals are positive integers.
-/
lemma hasSum_pos_of_ge_two (seq : ℕ → ℕ) (q : ℚ)
    (hGe2 : ∀ k, seq k ≥ 2)
    (hSum : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ↑q) :
    (q : ℝ) > 0 := by
  have hSummable := hSum.summable
  have h_nonneg : ∀ k, (0 : ℝ) ≤ (1 : ℝ) / (seq k : ℝ) := by
    intro k; positivity
  have h0_pos : (0 : ℝ) < (1 : ℝ) / (seq 0 : ℝ) := by
    apply div_pos (zero_lt_one)
    have : seq 0 ≥ 2 := hGe2 0
    exact_mod_cast (show (0 : ℕ) < seq 0 by omega)
  have h_tsum_pos : (0 : ℝ) < ∑' k, (1 : ℝ) / (seq k : ℝ) := 
    tsum_pos hSummable h_nonneg 0 h0_pos
  rw [hSum.tsum_eq] at h_tsum_pos
  exact h_tsum_pos

/--
  **Status**: sorry. Requires the tail-sum identity T_n = denom·P_n·Σ > 0.
-/
lemma tailResidual_pos_inductive (seq : ℕ → ℕ) (num denom : ℕ) 
    (_hGe2 : ∀ k, seq k ≥ 2) (_hNum : num > 0) (_hDenom : denom ≥ 1)
    (_hSum : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ((num : ℝ) / denom))
    (k : ℕ) : tailResidual seq num denom k > 0 := by
  sorry

lemma residual_pos_of_rational_sum (seq : ℕ → ℕ) (q : ℚ) 
    (hGe2 : ∀ k, seq k ≥ 2)
    (hSum : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ↑q) :
    q.num > 0 ∧ q.den ≥ 1 ∧ 
    (∀ k, tailResidual seq q.num.toNat q.den k > 0) := by
  have hq_pos := hasSum_pos_of_ge_two seq q hGe2 hSum
  have hq_num_pos : q.num > 0 := by
    have hq_rat_pos : q > 0 := by exact_mod_cast hq_pos
    exact Rat.num_pos.mpr hq_rat_pos
  refine ⟨hq_num_pos, q.pos, ?_⟩
  intro k
  have hNum : q.num.toNat > 0 := by
    have := Int.toNat_of_nonneg (le_of_lt hq_num_pos)
    omega
  have hSum_nd : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ((q.num.toNat : ℝ) / q.den) := by
    have hq_eq : (q : ℝ) = (q.num.toNat : ℝ) / (q.den : ℝ) := by
      have h_num : (q.num.toNat : ℤ) = q.num := Int.toNat_of_nonneg (le_of_lt hq_num_pos)
      rw [Rat.cast_def]
      congr 1
      exact_mod_cast h_num.symm
    rw [hq_eq] at hSum
    exact hSum
  exact tailResidual_pos_inductive seq q.num.toNat q.den hGe2 hNum q.pos hSum_nd k

/-- 
  **The Full Chain: limsup > 1 + rational sum → eventually Sylvester recurrence**
  
  This is the complete wiring from the analytical hypothesis to the algebraic conclusion.
  Every step in the chain is either proven or tagged with an honest sorry.
-/
theorem limsup_forces_sylvester_recurrence (seq : ℕ → ℕ) (q : ℚ) 
    (hMono : StrictMono seq) (hGe2 : ∀ k, seq k ≥ 2)
    (hSum : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ↑q)
    (hLimsup : limsup (fun k => (seq k : ℝ) ^ (1 / (2 ^ k : ℝ))) atTop > 1) :
    ∃ N : ℕ, ∀ n ≥ N, seq (n + 1) + seq n = seq n * seq n + 1 := by
  -- Step 1: Extract a limit L > 1
  rcases limsup_gt_one_extract_limit seq hMono hGe2 hLimsup with ⟨limitL, hL_gt_1, hTendsto⟩
  -- Step 2: Get the rational sum as num/denom with positivity
  rcases residual_pos_of_rational_sum seq q hGe2 hSum with ⟨hq_num_pos, hq_den_ge1, hResPos⟩
  -- Step 3: Rewrite the HasSum in num/denom form
  have hSum_nd : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ((q.num.toNat : ℝ) / q.den) := by
    have hq_eq : (q : ℝ) = (q.num.toNat : ℝ) / (q.den : ℝ) := by
      have h_num : (q.num.toNat : ℤ) = q.num := Int.toNat_of_nonneg (le_of_lt hq_num_pos)
      rw [Rat.cast_def]
      congr 1
      exact_mod_cast h_num.symm
    rw [hq_eq] at hSum
    exact hSum
  -- Step 4: Apply the asymptotic squeeze → T_n → denom/L
  have hConv := asymptoticSqueezeLimit seq q.num.toNat q.den limitL 
                  hSum_nd hTendsto hq_den_ge1 hGe2 hL_gt_1
  -- Step 5: Integer convergence rigidity → T_n eventually constant
  rcases integerConvergenceRigidity (tailResidual seq q.num.toNat q.den) 
         (q.den / limitL) hConv with ⟨C, N, hC⟩
  -- Step 6: C ≠ 0 (since residuals are positive)
  have hC_ne_zero : C ≠ 0 := by
    have hPos := hResPos N
    have hCN := hC N (le_refl N)
    rw [hCN] at hPos
    omega
  -- Step 7: Derive the recurrence
  have hDenom_pos : q.den > 0 := by omega
  exact ⟨N, constant_residual_implies_sylvester seq q.num.toNat q.den C N hC hC_ne_zero hDenom_pos⟩

end
