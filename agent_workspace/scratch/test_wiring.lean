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

theorem tailResidualSuccessor (seq : ℕ → ℕ) (num denom : ℕ) (k : ℕ) :
    tailResidual seq num denom (k + 1) = 
      (seq k : ℤ) * tailResidual seq num denom k - (denom : ℤ) * (prefixProduct seq k : ℤ) :=
  rfl

/-! ### Stub lemmas (sorry-tagged, from residual_growth_bound.lean) -/

lemma prefix_limit (seq : ℕ → ℕ) (limitL : ℝ)
    (hLimsup : Tendsto (fun k => (seq k : ℝ) ^ ((1 : ℝ) / 2 ^ k)) atTop (𝓝 limitL)) :
    Tendsto (fun n => (prefixProduct seq n : ℝ) * limitL / (seq n : ℝ)) atTop (𝓝 1) := by
  sorry

lemma tail_sum_limit (seq : ℕ → ℕ) (limitL : ℝ) (hL_gt_1 : limitL > 1)
    (hLimsup : Tendsto (fun k => (seq k : ℝ) ^ ((1 : ℝ) / 2 ^ k)) atTop (𝓝 limitL)) :
    Tendsto (fun n => (seq n : ℝ) * ∑' k, (1 : ℝ) / (seq (n + k) : ℝ)) atTop (𝓝 1) := by
  sorry

lemma limsup_gt_one_extract_limit (seq : ℕ → ℕ)
    (_hMono : StrictMono seq) (_hGe2 : ∀ k, seq k ≥ 2)
    (hLimsup : limsup (fun k => (seq k : ℝ) ^ (1 / (2 ^ k : ℝ))) atTop > 1) :
    ∃ limitL : ℝ, limitL > 1 ∧ 
      Tendsto (fun k => (seq k : ℝ) ^ ((1 : ℝ) / 2 ^ k)) atTop (𝓝 limitL) := by
  sorry

/-! ### Proven infrastructure (from residual_growth_bound.lean) -/

-- tailResidual_eq_sum is proven
-- asymptoticSqueezeLimit is proven (modulo prefix_limit and tail_sum_limit)
-- integerConvergenceRigidity is proven
-- limsupGtOneImpliesResidualBounded is proven
-- constant_residual_implies_sylvester is proven

-- We simulate these as sorry stubs for this test file
theorem asymptoticSqueezeLimit (seq : ℕ → ℕ) (num denom : ℕ) (limitL : ℝ)
    (hSum : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ((num : ℝ) / denom))
    (hLimsup : Tendsto (fun k => (seq k : ℝ) ^ ((1 : ℝ) / 2 ^ k)) atTop (𝓝 limitL))
    (hDenom : denom ≥ 1) (hSeq : ∀ k, seq k ≥ 2) (hL_gt_1 : limitL > 1) :
    Tendsto (fun n => (tailResidual seq num denom n : ℝ)) atTop (𝓝 (denom / limitL)) := by
  sorry

lemma integerConvergenceRigidity (f : ℕ → ℤ) (c : ℝ)
    (hLim : Tendsto (fun n => (f n : ℝ)) atTop (𝓝 c)) :
    ∃ (B : ℤ) (N : ℕ), ∀ n ≥ N, f n = B := by
  sorry

theorem constant_residual_implies_sylvester (seq : ℕ → ℕ) (num denom : ℕ) (C : ℤ) (N : ℕ)
    (h_const : ∀ n ≥ N, tailResidual seq num denom n = C) (h_C_pos : C ≠ 0)
    (_h_denom_pos : denom > 0) :
    ∀ n ≥ N, seq (n + 1) + seq n = seq n * seq n + 1 := by
  sorry

/-! ### The Erdős 265 wiring -/

def Erdos265_Sequence (a : ℕ → ℕ) : Prop :=
  StrictMono a ∧
  (∀ k, a k ≥ 2) ∧
  (∃ q₁ : ℚ, HasSum (fun k => (1 : ℝ) / (a k : ℝ)) ↑q₁) ∧
  (∃ q₂ : ℚ, HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) ↑q₂)

theorem dual_lockin_contradiction (a : ℕ → ℕ) (N : ℕ)
    (h1 : ∀ n ≥ N, a (n + 1) + a n = a n * a n + 1)
    (h2 : ∀ n ≥ N, a (n + 1) + 3 * a n = a n * a n + 4) :
    False := by
  have h1N := h1 N (le_refl N)
  have h2N := h2 N (le_refl N)
  omega

lemma shifted_seq_lockin (seq : ℕ → ℕ) (N : ℕ)
    (h : ∀ n ≥ N, (seq (n + 1) - 1) + (seq n - 1) = (seq n - 1) * (seq n - 1) + 1)
    (h_pos : ∀ n ≥ N, seq n ≥ 2) :
    ∀ n ≥ N, seq (n + 1) + 3 * seq n = seq n * seq n + 4 := by
  intro n hn
  have h1 := h n hn
  have h2 := h_pos n hn
  have h3 := h_pos (n + 1) (by omega)
  have h_z : (seq (n + 1) : ℤ) - 1 + ((seq n : ℤ) - 1) = ((seq n : ℤ) - 1) * ((seq n : ℤ) - 1) + 1 := by
    have h1_z : ((seq (n + 1) - 1 + (seq n - 1) : ℕ) : ℤ) = (((seq n - 1) * (seq n - 1) + 1 : ℕ) : ℤ) := by rw [h1]
    push_cast at h1_z
    have h_sub1 : ((seq (n + 1) - 1 : ℕ) : ℤ) = (seq (n + 1) : ℤ) - 1 := by omega
    have h_sub2 : ((seq n - 1 : ℕ) : ℤ) = (seq n : ℤ) - 1 := by omega
    rw [h_sub1, h_sub2] at h1_z
    exact h1_z
  have h_z_final : (seq (n + 1) : ℤ) + 3 * (seq n : ℤ) = (seq n : ℤ) * (seq n : ℤ) + 4 := by linarith
  exact_mod_cast h_z_final

/-! ### The main wiring lemma: from limsup > 1 to constant recurrence -/

lemma residual_pos_of_rational_sum (seq : ℕ → ℕ) (q : ℚ) 
    (hGe2 : ∀ k, seq k ≥ 2)
    (hSum : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ↑q) :
    q.num > 0 ∧ q.den ≥ 1 ∧ 
    (∀ k, tailResidual seq q.num.toNat q.den k > 0) := by
  sorry

/-- The main chain: limsup > 1 + rational sum → eventually Sylvester recurrence -/
lemma limsup_forces_sylvester_recurrence (seq : ℕ → ℕ) (q : ℚ) 
    (hMono : StrictMono seq) (hGe2 : ∀ k, seq k ≥ 2)
    (hSum : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ↑q)
    (hLimsup : limsup (fun k => (seq k : ℝ) ^ (1 / (2 ^ k : ℝ))) atTop > 1) :
    ∃ N : ℕ, ∀ n ≥ N, seq (n + 1) + seq n = seq n * seq n + 1 := by
  -- Step 1: Extract a limit L > 1
  rcases limsup_gt_one_extract_limit seq hMono hGe2 hLimsup with ⟨limitL, hL_gt_1, hTendsto⟩
  
  -- Step 2: Get the rational sum as num/denom
  have hq := residual_pos_of_rational_sum seq q hGe2 hSum
  rcases hq with ⟨hq_num_pos, hq_den_ge1, hResPos⟩
  
  -- Step 3: Rewrite the HasSum in num/denom form
  have hSum_nd : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ((q.num.toNat : ℝ) / q.den) := by
    have hq_eq : (q : ℝ) = (q.num.toNat : ℝ) / (q.den : ℝ) := by
      have h_num : (q.num.toNat : ℤ) = q.num := by
        exact Int.toNat_of_nonneg (le_of_lt hq_num_pos)
      rw [Rat.cast_def]
      congr 1
      exact_mod_cast h_num.symm
    rw [hq_eq] at hSum
    exact hSum
    
  -- Step 4: Apply the asymptotic squeeze
  have hConv := asymptoticSqueezeLimit seq q.num.toNat q.den limitL 
                  hSum_nd hTendsto hq_den_ge1 hGe2 hL_gt_1
  
  -- Step 5: Integer convergence rigidity
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
