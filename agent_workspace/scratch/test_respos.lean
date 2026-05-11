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

-- Part 1: sum of positive terms is positive → q > 0
lemma hasSum_pos_of_ge_two (seq : ℕ → ℕ) (q : ℚ)
    (hGe2 : ∀ k, seq k ≥ 2)
    (hSum : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ↑q) :
    (q : ℝ) > 0 := by
  have hSummable := hSum.summable
  have h_nonneg : ∀ k, (0 : ℝ) ≤ (1 : ℝ) / (seq k : ℝ) := by
    intro k
    positivity
  have h0_pos : (0 : ℝ) < (1 : ℝ) / (seq 0 : ℝ) := by
    apply div_pos (zero_lt_one)
    have : seq 0 ≥ 2 := hGe2 0
    exact_mod_cast (show (0 : ℕ) < seq 0 by omega)
  have h_tsum_pos : (0 : ℝ) < ∑' k, (1 : ℝ) / (seq k : ℝ) := 
    tsum_pos hSummable h_nonneg 0 h0_pos
  rw [hSum.tsum_eq] at h_tsum_pos
  exact h_tsum_pos

-- Part 2: q.num > 0 follows from (q : ℝ) > 0
lemma rat_num_pos_of_pos (q : ℚ) (hq : (q : ℝ) > 0) : q.num > 0 := by
  have hq_pos : q > 0 := by exact_mod_cast hq
  exact Rat.num_pos.mpr hq_pos

-- Part 3: tailResidual positivity via the identity
-- T_n = denom · P_n · Σ_{k≥n} 1/a_k
-- All three factors are positive, so T_n > 0.
-- But we need T_n to be an integer AND positive.
-- We'll use an inductive argument on the recurrence instead.
lemma tailResidual_pos_inductive (seq : ℕ → ℕ) (num denom : ℕ) 
    (hGe2 : ∀ k, seq k ≥ 2) (hNum : num > 0) (hDenom : denom ≥ 1)
    (hSum : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ((num : ℝ) / denom))
    (k : ℕ) : tailResidual seq num denom k > 0 := by
  -- Use the real-valued identity to show positivity
  have hSummable := hSum.summable
  have hSum_val := hSum.tsum_eq
  have h_pos : ∀ j, seq j > 0 := by intro j; have := hGe2 j; omega
  
  -- T_k as a real number equals denom * P_k * tail_sum
  -- We need tailResidual_eq_sum here, but let's use sorry for now
  -- and prove the positivity via the real-valued representation
  sorry

-- The full lemma
lemma residual_pos_of_rational_sum (seq : ℕ → ℕ) (q : ℚ) 
    (hGe2 : ∀ k, seq k ≥ 2)
    (hSum : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ↑q) :
    q.num > 0 ∧ q.den ≥ 1 ∧ 
    (∀ k, tailResidual seq q.num.toNat q.den k > 0) := by
  have hq_pos := hasSum_pos_of_ge_two seq q hGe2 hSum
  have hq_num_pos := rat_num_pos_of_pos q hq_pos
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

end
