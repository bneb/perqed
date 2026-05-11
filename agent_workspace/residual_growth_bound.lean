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
  Tail residuals are positive integers when the sum is positive and the sequence is ≥ 2.
  Proof: by the identity T_k = denom · P_k · Σ_{j≥k} 1/a_j, all factors are positive.
-/
lemma prefixProduct_pos (seq : ℕ → ℕ) (h_pos : ∀ j, seq j > 0) (k : ℕ) :
    prefixProduct seq k > 0 := by
  induction k with
  | zero => simp [prefixProduct]
  | succ n ih => 
    simp [prefixProduct]
    exact ⟨ih, h_pos n⟩

lemma tailResidual_pos_inductive (seq : ℕ → ℕ) (num denom : ℕ) 
    (hGe2 : ∀ k, seq k ≥ 2) (hNum : num > 0) (hDenom : denom ≥ 1)
    (hSum : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ((num : ℝ) / denom))
    (k : ℕ) : tailResidual seq num denom k > 0 := by
  have hSummable := hSum.summable
  have hSum_val := hSum.tsum_eq
  have h_pos : ∀ j, seq j > 0 := by intro j; have := hGe2 j; omega
  have h_eq := tailResidual_eq_sum seq num denom hSummable hSum_val h_pos hDenom k
  have h_denom_pos : (denom : ℝ) > 0 := by exact_mod_cast (show (0 : ℕ) < denom by omega)
  have h_prefix_pos : (prefixProduct seq k : ℝ) > 0 := by
    exact_mod_cast prefixProduct_pos seq h_pos k
  have h_tail_sum_pos : ∑' j, (1 : ℝ) / (seq (k + j) : ℝ) > 0 := by
    have h_summable_shifted : Summable (fun j => (1 : ℝ) / (seq (k + j) : ℝ)) := by
      have : Summable (fun j => (1 : ℝ) / (seq (j + k) : ℝ)) := (summable_nat_add_iff k).mpr hSummable
      have h_comm : (fun j => (1 : ℝ) / (seq (j + k) : ℝ)) = (fun j => (1 : ℝ) / (seq (k + j) : ℝ)) := by
        ext j; rw [add_comm j k]
      rw [h_comm] at this
      exact this
    have h_nonneg : ∀ j, (0 : ℝ) ≤ (1 : ℝ) / (seq (k + j) : ℝ) := by
      intro j; positivity
    have h_first_pos : (0 : ℝ) < (1 : ℝ) / (seq (k + 0) : ℝ) := by
      rw [add_zero]
      apply div_pos (zero_lt_one)
      exact_mod_cast (h_pos k)
    exact tsum_pos h_summable_shifted h_nonneg 0 h_first_pos
  -- Combine: (T_k : ℝ) = denom · P_k · tail_sum > 0
  have h_real_pos : (tailResidual seq num denom k : ℝ) > 0 := by
    rw [h_eq]
    exact mul_pos (mul_pos h_denom_pos h_prefix_pos) h_tail_sum_pos
  -- Lift from ℝ positivity to ℤ positivity
  exact_mod_cast h_real_pos

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



/-- A non-increasing positive integer sequence is eventually constant.
    Proof: can decrease at most f(N)-1 times before hitting the floor. -/
lemma nonincr_pos_int_eventually_const (f : ℕ → ℤ) (N : ℕ)
    (hPos : ∀ k, f k > 0)
    (hDecr : ∀ n ≥ N, f (n + 1) ≤ f n) :
    ∃ (C : ℤ) (M : ℕ), ∀ n ≥ M, f n = C := by
  -- Helper: f is non-increasing from N.
  have hMono : ∀ n, f (N + n + 1) ≤ f (N + n) := by
    intro n; exact hDecr (N + n) (by omega)
  -- Helper: f(N + k) ≤ f(N) for all k
  have hUpper : ∀ k, f (N + k) ≤ f N := by
    intro k
    induction k with
    | zero => simp
    | succ m ih => exact le_trans (hMono m) ih
  -- If f is eventually equal to f(N+k) for some k, we're done.
  -- Otherwise, f strictly decreases infinitely often past N.
  -- Since f ≥ 1 always and f(N+k) ≤ f(N), after f(N) strict drops f ≤ 0, contradiction.
  by_contra h_no_const
  push_neg at h_no_const
  -- h_no_const : ∀ C M, ∃ n ≥ M, f n ≠ C
  -- This means: for every k, f is not constant on [N+k, ∞).
  -- So for every k, there exists j ≥ N+k with f(j+1) < f(j).
  have h_inf_decr : ∀ k, ∃ j ≥ N + k, f (j + 1) < f j := by
    intro k
    by_contra h_all_eq
    push_neg at h_all_eq
    -- f(j+1) ≥ f(j) for all j ≥ N+k. Combined with hDecr: f(j+1) = f(j) for j ≥ N+k.
    have h_const : ∀ m, f (N + k + m) = f (N + k) := by
      intro m
      induction m with
      | zero => simp
      | succ p ih =>
        have h1 : f (N + k + p + 1) ≤ f (N + k + p) := hDecr (N + k + p) (by omega)
        have h2 : f (N + k + p) ≤ f (N + k + p + 1) := h_all_eq (N + k + p) (by omega)
        have h3 : f (N + k + (p + 1)) = f (N + k + p) := le_antisymm (by rwa [show N + k + (p + 1) = N + k + p + 1 by omega]) h2
        rw [h3, ih]
    -- So f is constant on [N+k, ∞). Contradiction with h_no_const.
    have : ∃ n ≥ N + k, f n ≠ f (N + k) := h_no_const (f (N + k)) (N + k)
    rcases this with ⟨n, hn, hne⟩
    have : f n = f (N + k) := by
      have : n = N + k + (n - (N + k)) := by omega
      rw [this]
      exact h_const (n - (N + k))
    contradiction
  -- Now build a chain of strict drops.
  -- Claim: ∀ j, ∃ n ≥ N, f n ≤ f N - j.
  suffices h_drop : ∀ j : ℕ, ∃ n ≥ N, f n ≤ f N - (j : ℤ) by
    have hfN_pos := hPos N
    rcases h_drop (f N).toNat with ⟨n, _, hn⟩
    have hToNat : ((f N).toNat : ℤ) = f N := Int.toNat_of_nonneg (le_of_lt hfN_pos)
    linarith [hPos n]
  intro j
  induction j with
  | zero => exact ⟨N, le_refl N, by simp⟩
  | succ j ih =>
    rcases ih with ⟨n, hn_ge, hn_bound⟩
    rcases h_inf_decr (n - N) with ⟨m, hm_ge, hm_drop⟩
    have hm_ge_n : m ≥ n := by omega
    -- f(m) ≤ f(n) by non-increasing from N.
    have hfm_le : f m ≤ f n := by
      have h1 : f m ≤ f N := by have := hUpper (m - N); rwa [show N + (m - N) = m by omega] at this
      have h2 : f n ≤ f N := by have := hUpper (n - N); rwa [show N + (n - N) = n by omega] at this
      -- We need f(m) ≤ f(n), but hUpper only gives both ≤ f(N).
      -- Use monotonicity: f(m) ≤ f(n) since m ≥ n and f is non-increasing from N.
      -- f(n + (m - n)) ≤ f(n) by hUpper-style argument applied from n.
      clear h1 h2
      have : ∀ k, f (n + k) ≤ f n := by
        intro k; induction k with
        | zero => simp
        | succ p ihp => exact le_trans (hDecr (n + p) (by omega)) ihp
      have := this (m - n)
      rwa [show n + (m - n) = m by omega] at this
    -- f(m+1) < f(m) ≤ f(n) ≤ f(N) - j, so f(m+1) ≤ f(N) - (j+1)
    refine ⟨m + 1, by omega, ?_⟩
    have h1 : f (m + 1) ≤ f m - 1 := Int.le_sub_one_of_lt hm_drop
    have h2 : (↑(j + 1) : ℤ) = (↑j : ℤ) + 1 := by push_cast; ring
    rw [h2]
    linarith


/-- 
  **T_n / P_n → 0**: The residual divided by the prefix product tends to zero.
  
  From the identity T_n = denom · P_n · S_n where S_n = Σ_{k≥n} 1/a_k,
  and S_n → 0 (tail of a convergent series), we get T_n / P_n = denom · S_n → 0.
-/
lemma residual_over_prefix_tendsto_zero (seq : ℕ → ℕ) (num denom : ℕ)
    (hGe2 : ∀ k, seq k ≥ 2) (hDenom : denom ≥ 1)
    (hSum : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ((num : ℝ) / denom)) :
    Tendsto (fun n => (tailResidual seq num denom n : ℝ) / ((denom : ℝ) * prefixProduct seq n : ℝ)) atTop (𝓝 0) := by
  have h_pos : ∀ j, seq j > 0 := by intro j; have := hGe2 j; omega
  have hSummable := hSum.summable
  have hSum_val := hSum.tsum_eq
  have h_eq : ∀ n, (tailResidual seq num denom n : ℝ) / ((denom : ℝ) * prefixProduct seq n : ℝ) = 
              ∑' k, (1 : ℝ) / (seq (n + k) : ℝ) := by
    intro n
    have h_pn_pos : (prefixProduct seq n : ℝ) > 0 := by exact_mod_cast prefixProduct_pos seq h_pos n
    have h_id := tailResidual_eq_sum seq num denom hSummable hSum_val h_pos hDenom n
    have hd_pos : (denom : ℝ) > 0 := by exact_mod_cast (by omega : denom > 0)
    have hd_pn_pos : (denom : ℝ) * (prefixProduct seq n : ℝ) > 0 := mul_pos hd_pos h_pn_pos
    have h_eq2 : (tailResidual seq num denom n : ℝ) = (∑' k, (1 : ℝ) / (seq (n + k) : ℝ)) * ((denom : ℝ) * prefixProduct seq n : ℝ) := by
      rw [h_id]
      ring
    exact (div_eq_iff (ne_of_gt hd_pn_pos)).mpr h_eq2
  simp_rw [h_eq]
  have h_add_comm : (fun n => ∑' k, (1 : ℝ) / (seq (n + k) : ℝ)) = (fun n => ∑' k, (1 : ℝ) / (seq (k + n) : ℝ)) := by
    ext n
    congr 1
    ext k
    rw [add_comm]
  rw [h_add_comm]
  exact tendsto_sum_nat_add (fun k => (1 : ℝ) / (seq k : ℝ))

lemma nonpos_of_tendsto_zero_and_nonincr (X : ℕ → ℝ) (h_tendsto : Tendsto X atTop (𝓝 0))
    (h_nonincr : ∀ n, X (n + 1) ≤ X n) :
    ∀ n, 0 ≤ X n := by
  intro n
  by_contra h_neg
  push_neg at h_neg
  have h_bound : ∀ m, n ≤ m → X m ≤ X n := by
    intro m
    induction m with
    | zero => 
      intro hn
      have hn_zero : n = 0 := Nat.eq_zero_of_le_zero hn
      subst hn_zero; exact le_refl _
    | succ p ih =>
      intro hn
      by_cases hp : n ≤ p
      · exact le_trans (h_nonincr p) (ih hp)
      · have hp2 : n = p + 1 := le_antisymm hn (Nat.lt_of_not_ge hp)
        subst hp2; exact le_refl _
  have h_eps : ∃ N, ∀ m ≥ N, |X m - 0| < -(X n) / 2 := by
    have h1 : -(X n) / 2 > 0 := by linarith
    have h2 := Metric.tendsto_atTop.mp h_tendsto (-(X n) / 2) h1
    exact h2
  rcases h_eps with ⟨N, hN⟩
  let h_max := max n N
  have h3 := hN h_max (le_max_right n N)
  have h4 := h_bound h_max (le_max_left n N)
  rw [sub_zero] at h3
  have h5 : X h_max < 0 := by linarith
  have h6 : |X h_max| = -(X h_max) := abs_of_neg h5
  rw [h6] at h3
  linarith

lemma seq_tendsto_inv (seq : ℕ → ℕ) (hGe2 : ∀ k, seq k ≥ 2) (hGreedy : ∀ k, seq (k + 1) ≥ seq k * seq k - seq k + 1) :
    Filter.Tendsto (fun n => 1 / ((seq n : ℝ) - 1)) Filter.atTop (nhds 0) := by
  have h_bound : ∀ n, seq n ≥ n + 2 := by
    intro n
    induction n with
    | zero => exact hGe2 0
    | succ n ih =>
      have h_ge2 := hGe2 n
      have hG := hGreedy n
      have h1 : seq n * seq n ≥ seq n * 2 := Nat.mul_le_mul_left (seq n) h_ge2
      have h3 : seq n * seq n ≥ seq n + seq n := by omega
      have h4 : seq n * seq n - seq n ≥ seq n := by omega
      have h5 : seq n * seq n - seq n + 1 ≥ seq n + 1 := by omega
      omega
  have h_real_bound : ∀ n : ℕ, (n : ℝ) ≤ (seq n : ℝ) - 1 := by
    intro n
    have hn := h_bound n
    have h1 : (n : ℝ) + 1 ≤ (seq n : ℝ) := by exact_mod_cast (by omega : n + 1 ≤ seq n)
    linarith
  have h_atTop : Filter.Tendsto (fun n => (seq n : ℝ) - 1) Filter.atTop Filter.atTop :=
    Filter.tendsto_atTop_mono h_real_bound tendsto_nat_cast_atTop_atTop
  have h_comp := Filter.Tendsto.comp tendsto_inv_atTop_zero h_atTop
  have h_eq : (fun r => r⁻¹) ∘ (fun n => (seq n : ℝ) - 1) = (fun n => 1 / ((seq n : ℝ) - 1)) := by
    ext n; exact inv_eq_one_div _
  rw [← h_eq]
  exact h_comp

/--
  **Greedy Residual is Non-Increasing**

  If the sequence satisfies the greedy condition a_{k+1} ≥ a_k^2 - a_k + 1,
  the residual T_n satisfies T_{n+1} ≤ T_n.
-/
lemma tailResidual_eventually_nonincreasing (seq : ℕ → ℕ) (num denom : ℕ) 
    (hGe2 : ∀ k, seq k ≥ 2) (hDenom : denom ≥ 1)
    (hSum : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ((num : ℝ) / denom))
    (hGreedy : ∀ k, seq (k + 1) ≥ seq k * seq k - seq k + 1) :
    ∃ N : ℕ, ∀ n ≥ N, tailResidual seq num denom (n + 1) ≤ tailResidual seq num denom n := by
  use 0
  intro n _
  let X := fun n => 1 / ((seq n : ℝ) - 1) - (tailResidual seq num denom n : ℝ) / ((denom : ℝ) * prefixProduct seq n : ℝ)
  
  have hTendstoRes := residual_over_prefix_tendsto_zero seq num denom hGe2 hDenom hSum
  have h_tendsto_X : Tendsto X atTop (𝓝 0) := by
    have h_tendsto_inv : Tendsto (fun n => 1 / ((seq n : ℝ) - 1)) atTop (𝓝 0) := seq_tendsto_inv seq hGe2 hGreedy
    have : Tendsto X atTop (𝓝 (0 - 0)) := Tendsto.sub h_tendsto_inv hTendstoRes
    rw [sub_zero] at this
    exact this
    
  have h_nonincr : ∀ k, X (k + 1) ≤ X k := by
    intro k
    have ha : (seq k : ℝ) ≥ 2 := by exact_mod_cast hGe2 k
    have hG := hGreedy k
    have ha_succ : (seq (k + 1) : ℝ) ≥ (seq k : ℝ) * (seq k : ℝ) - (seq k : ℝ) + 1 := by
      have h_sub : seq k * seq k ≥ seq k := by
        nlinarith [hGe2 k]
      have : ((seq k * seq k - seq k + 1 : ℕ) : ℝ) = (seq k : ℝ) * (seq k : ℝ) - (seq k : ℝ) + 1 := by
        rw [Nat.cast_add, Nat.cast_sub h_sub]
        push_cast
        rfl
      rw [← this]
      exact_mod_cast hG
    have h_pos : ∀ j, seq j > 0 := by intro j; have := hGe2 j; omega
    have h_pk : (prefixProduct seq k : ℝ) > 0 := by exact_mod_cast prefixProduct_pos seq h_pos k
    have h_pk1 : (prefixProduct seq (k + 1) : ℝ) = (prefixProduct seq k : ℝ) * (seq k : ℝ) := by
      have : prefixProduct seq (k + 1) = prefixProduct seq k * seq k := rfl
      exact_mod_cast this
    
    have h_T_rec : (tailResidual seq num denom (k + 1) : ℝ) = (seq k : ℝ) * (tailResidual seq num denom k : ℝ) - (denom : ℝ) * (prefixProduct seq k : ℝ) := by
      have : tailResidual seq num denom (k + 1) = (seq k : ℤ) * tailResidual seq num denom k - (denom : ℤ) * (prefixProduct seq k : ℤ) := rfl
      exact_mod_cast this
    
    have hd_pos : (denom : ℝ) > 0 := by exact_mod_cast (by omega : denom > 0)
    
    have h_T_diff : (tailResidual seq num denom (k + 1) : ℝ) / ((denom : ℝ) * prefixProduct seq (k + 1) : ℝ) - 
                    (tailResidual seq num denom k : ℝ) / ((denom : ℝ) * prefixProduct seq k : ℝ) = 
                    - 1 / (seq k : ℝ) := by
      rw [h_T_rec, h_pk1]
      have h1 : (denom : ℝ) * ((prefixProduct seq k : ℝ) * (seq k : ℝ)) = (denom : ℝ) * (prefixProduct seq k : ℝ) * (seq k : ℝ) := by ring
      rw [h1]
      have h2 : ((seq k : ℝ) * (tailResidual seq num denom k : ℝ) - (denom : ℝ) * (prefixProduct seq k : ℝ)) / ((denom : ℝ) * (prefixProduct seq k : ℝ) * (seq k : ℝ)) = 
                ((seq k : ℝ) * (tailResidual seq num denom k : ℝ)) / ((denom : ℝ) * (prefixProduct seq k : ℝ) * (seq k : ℝ)) - 
                ((denom : ℝ) * (prefixProduct seq k : ℝ)) / ((denom : ℝ) * (prefixProduct seq k : ℝ) * (seq k : ℝ)) := by exact sub_div ((seq k : ℝ) * (tailResidual seq num denom k : ℝ)) ((denom : ℝ) * (prefixProduct seq k : ℝ)) ((denom : ℝ) * (prefixProduct seq k : ℝ) * (seq k : ℝ))
      rw [h2]
      have h3 : ((seq k : ℝ) * (tailResidual seq num denom k : ℝ)) / ((denom : ℝ) * (prefixProduct seq k : ℝ) * (seq k : ℝ)) = (tailResidual seq num denom k : ℝ) / ((denom : ℝ) * (prefixProduct seq k : ℝ)) := by
        have hak_ne : (seq k : ℝ) ≠ 0 := by
          have : seq k ≥ 2 := hGe2 k
          have : (seq k : ℝ) ≥ 2 := by exact_mod_cast this
          linarith
        calc
          ((seq k : ℝ) * (tailResidual seq num denom k : ℝ)) / ((denom : ℝ) * (prefixProduct seq k : ℝ) * (seq k : ℝ)) = 
          ((tailResidual seq num denom k : ℝ) * (seq k : ℝ)) / (((denom : ℝ) * (prefixProduct seq k : ℝ)) * (seq k : ℝ)) := by ring_nf
          _ = (tailResidual seq num denom k : ℝ) / ((denom : ℝ) * (prefixProduct seq k : ℝ)) := mul_div_mul_right (tailResidual seq num denom k : ℝ) ((denom : ℝ) * (prefixProduct seq k : ℝ)) hak_ne
      rw [h3]
      have h4 : ((denom : ℝ) * (prefixProduct seq k : ℝ)) / ((denom : ℝ) * (prefixProduct seq k : ℝ) * (seq k : ℝ)) = 1 / (seq k : ℝ) := by
        have hd_pk : (denom : ℝ) * (prefixProduct seq k : ℝ) ≠ 0 := ne_of_gt (mul_pos hd_pos h_pk)
        calc
          ((denom : ℝ) * (prefixProduct seq k : ℝ)) / ((denom : ℝ) * (prefixProduct seq k : ℝ) * (seq k : ℝ)) = 
          (1 * ((denom : ℝ) * (prefixProduct seq k : ℝ))) / ((seq k : ℝ) * ((denom : ℝ) * (prefixProduct seq k : ℝ))) := by ring_nf
          _ = 1 / (seq k : ℝ) := mul_div_mul_right 1 (seq k : ℝ) hd_pk
      rw [h4]
      ring
      
    have hX : X (k + 1) - X k = 1 / ((seq (k + 1) : ℝ) - 1) - 1 / ((seq k : ℝ) - 1) - (- 1 / (seq k : ℝ)) := by
      calc
        X (k + 1) - X k = (1 / ((seq (k + 1) : ℝ) - 1) - (tailResidual seq num denom (k + 1) : ℝ) / ((denom : ℝ) * prefixProduct seq (k + 1) : ℝ)) - 
                          (1 / ((seq k : ℝ) - 1) - (tailResidual seq num denom k : ℝ) / ((denom : ℝ) * prefixProduct seq k : ℝ)) := rfl
        _ = 1 / ((seq (k + 1) : ℝ) - 1) - 1 / ((seq k : ℝ) - 1) - 
            ((tailResidual seq num denom (k + 1) : ℝ) / ((denom : ℝ) * prefixProduct seq (k + 1) : ℝ) - 
             (tailResidual seq num denom k : ℝ) / ((denom : ℝ) * prefixProduct seq k : ℝ)) := by ring
        _ = 1 / ((seq (k + 1) : ℝ) - 1) - 1 / ((seq k : ℝ) - 1) - (- 1 / (seq k : ℝ)) := by rw [h_T_diff]
    
    have ha_pos : (seq k : ℝ) > 0 := by
      have : seq k ≥ 2 := hGe2 k
      have : (seq k : ℝ) ≥ 2 := by exact_mod_cast this
      linarith
    have ha_sub_pos : (seq k : ℝ) - 1 > 0 := by
      have : seq k ≥ 2 := hGe2 k
      have : (seq k : ℝ) ≥ 2 := by exact_mod_cast this
      linarith
    
    have h_bound : 1 / ((seq (k + 1) : ℝ) - 1) ≤ 1 / ((seq k : ℝ) * ((seq k : ℝ) - 1)) := by
      have h_denom_ineq : (seq (k + 1) : ℝ) - 1 ≥ (seq k : ℝ) * ((seq k : ℝ) - 1) := by
        calc
          (seq (k + 1) : ℝ) - 1 ≥ (seq k : ℝ) * (seq k : ℝ) - (seq k : ℝ) + 1 - 1 := by linarith [ha_succ]
          _ = (seq k : ℝ) * ((seq k : ℝ) - 1) := by ring
      have h_denom_pos2 : (seq k : ℝ) * ((seq k : ℝ) - 1) > 0 := mul_pos ha_pos ha_sub_pos
      exact one_div_le_one_div_of_le h_denom_pos2 h_denom_ineq
      
    have h_eq3 : 1 / ((seq k : ℝ) - 1) - 1 / (seq k : ℝ) = 1 / ((seq k : ℝ) * ((seq k : ℝ) - 1)) := by
      have h_ne1 : (seq k : ℝ) - 1 ≠ 0 := ne_of_gt ha_sub_pos
      have h_ne2 : (seq k : ℝ) ≠ 0 := ne_of_gt ha_pos
      calc
        1 / ((seq k : ℝ) - 1) - 1 / (seq k : ℝ) = (1 * (seq k : ℝ) - ((seq k : ℝ) - 1) * 1) / (((seq k : ℝ) - 1) * (seq k : ℝ)) := div_sub_div 1 1 h_ne1 h_ne2
        _ = 1 / ((seq k : ℝ) * ((seq k : ℝ) - 1)) := by ring_nf
        
    have h1 : X (k + 1) - X k ≤ 0 := by
      calc
        X (k + 1) - X k = 1 / ((seq (k + 1) : ℝ) - 1) - 1 / ((seq k : ℝ) - 1) - (- 1 / (seq k : ℝ)) := hX
        _ = 1 / ((seq (k + 1) : ℝ) - 1) - (1 / ((seq k : ℝ) - 1) - 1 / (seq k : ℝ)) := by ring
        _ = 1 / ((seq (k + 1) : ℝ) - 1) - 1 / ((seq k : ℝ) * ((seq k : ℝ) - 1)) := by rw [h_eq3]
        _ ≤ 0 := sub_nonpos.mpr h_bound
    linarith
  
  have h_X_nonneg := nonpos_of_tendsto_zero_and_nonincr X h_tendsto_X h_nonincr n
  have h_X_ineq : 0 ≤ X n := h_X_nonneg
  have h_X_ineq_unfold : 0 ≤ 1 / ((seq n : ℝ) - 1) - (tailResidual seq num denom n : ℝ) / ((denom : ℝ) * prefixProduct seq n : ℝ) := h_X_ineq
  have h_T : (tailResidual seq num denom n : ℝ) / ((denom : ℝ) * prefixProduct seq n : ℝ) ≤ 1 / ((seq n : ℝ) - 1) := by linarith [h_X_ineq_unfold]
  have h_pos_n : ∀ j, seq j > 0 := by intro j; have := hGe2 j; omega
  have h_pn : (prefixProduct seq n : ℝ) > 0 := by exact_mod_cast prefixProduct_pos seq h_pos_n n
  have hd_pos_n : (denom : ℝ) > 0 := by exact_mod_cast (by omega : denom > 0)
  have h_denom_pn : (denom : ℝ) * (prefixProduct seq n : ℝ) > 0 := mul_pos hd_pos_n h_pn
  have ha_sub_pos_n : (seq n : ℝ) - 1 > 0 := by
    have : seq n ≥ 2 := hGe2 n
    have : (seq n : ℝ) ≥ 2 := by exact_mod_cast this
    linarith
    
  have h_T_n_bound : (seq n : ℝ) * (tailResidual seq num denom n : ℝ) - (tailResidual seq num denom n : ℝ) ≤ ((denom : ℝ) * prefixProduct seq n : ℝ) := by
    calc
      (seq n : ℝ) * (tailResidual seq num denom n : ℝ) - (tailResidual seq num denom n : ℝ) = ((seq n : ℝ) - 1) * (tailResidual seq num denom n : ℝ) := by ring
      _ = ((seq n : ℝ) - 1) * ((tailResidual seq num denom n : ℝ) / ((denom : ℝ) * prefixProduct seq n : ℝ) * ((denom : ℝ) * prefixProduct seq n : ℝ)) := by rw [div_mul_cancel (tailResidual seq num denom n : ℝ) (ne_of_gt h_denom_pn)]
      _ ≤ ((seq n : ℝ) - 1) * (1 / ((seq n : ℝ) - 1) * ((denom : ℝ) * prefixProduct seq n : ℝ)) := mul_le_mul_of_nonneg_left (mul_le_mul_of_nonneg_right h_T h_denom_pn.le) ha_sub_pos_n.le
      _ = (((seq n : ℝ) - 1) * (1 / ((seq n : ℝ) - 1))) * ((denom : ℝ) * prefixProduct seq n : ℝ) := by ring
      _ = 1 * ((denom : ℝ) * prefixProduct seq n : ℝ) := by rw [mul_one_div_cancel (ne_of_gt ha_sub_pos_n)]
      _ = ((denom : ℝ) * prefixProduct seq n : ℝ) := by ring
      
  have h_T_rec2 : (tailResidual seq num denom (n + 1) : ℝ) = (seq n : ℝ) * (tailResidual seq num denom n : ℝ) - (denom : ℝ) * (prefixProduct seq n : ℝ) := by
    have : tailResidual seq num denom (n + 1) = (seq n : ℤ) * tailResidual seq num denom n - (denom : ℤ) * (prefixProduct seq n : ℤ) := rfl
    exact_mod_cast this
  have h_final : (tailResidual seq num denom (n + 1) : ℝ) ≤ (tailResidual seq num denom n : ℝ) := by
    linarith [h_T_n_bound, h_T_rec2]
    
  exact_mod_cast h_final

/-- 
  **The Full Chain (Greedy Regime)**
  
  Uses the Greedy bounding strategy:
  1. Greedy condition → T_{n+1} ≤ T_n (monotonicity)
  2. T_n > 0 + monotonic → T_n eventually constant
  3. T_n constant → Sylvester recurrence
  Note: limsup > 1 is NOT used here. It's only needed at the entrypoint 
  (problem_statement.lean) to derive a contradiction with the dual lock-in.
-/
theorem greedy_forces_sylvester_recurrence (seq : ℕ → ℕ) (q : ℚ) 
    (hGe2 : ∀ k, seq k ≥ 2)
    (hSum : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ↑q)
    (hGreedy : ∀ k, seq (k + 1) ≥ seq k * seq k - seq k + 1) :
    ∃ N : ℕ, ∀ n ≥ N, seq (n + 1) + seq n = seq n * seq n + 1 := by
  -- Step 1: Get positivity and num/denom form
  rcases residual_pos_of_rational_sum seq q hGe2 hSum with ⟨hq_num_pos, _, hResPos⟩
  have hSum_nd : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ((q.num.toNat : ℝ) / q.den) := by
    have hq_eq : (q : ℝ) = (q.num.toNat : ℝ) / (q.den : ℝ) := by
      have h_num : (q.num.toNat : ℤ) = q.num := Int.toNat_of_nonneg (le_of_lt hq_num_pos)
      rw [Rat.cast_def]
      congr 1
      exact_mod_cast h_num.symm
    rw [hq_eq] at hSum
    exact hSum
  -- Step 2: T_n / P_n → 0
  have hTendsTo := residual_over_prefix_tendsto_zero seq q.num.toNat q.den hGe2 q.pos hSum_nd
  -- Step 3: Greedy bounds → T_n non-increasing
  have hNonincr : ∃ N : ℕ, ∀ n ≥ N, tailResidual seq q.num.toNat q.den (n + 1) ≤ tailResidual seq q.num.toNat q.den n := 
    tailResidual_eventually_nonincreasing seq q.num.toNat q.den hGe2 q.pos hSum_nd hGreedy
  rcases hNonincr with ⟨N_nonincr, hN_nonincr⟩
  -- Step 4: Eventually constant since positive integers
  rcases nonincr_pos_int_eventually_const (tailResidual seq q.num.toNat q.den) N_nonincr
         hResPos hN_nonincr with ⟨C, N, hC⟩
  -- Step 5: C ≠ 0 and derive the recurrence
  have hC_ne_zero : C ≠ 0 := by
    have hPos := hResPos N
    have hCN := hC N (le_refl N)
    rw [hCN] at hPos; omega
  have hDenom_pos : q.den > 0 := by omega
  exact ⟨N, constant_residual_implies_sylvester seq q.num.toNat q.den C N hC hC_ne_zero hDenom_pos⟩

end
