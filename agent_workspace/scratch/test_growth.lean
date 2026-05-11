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

-- Step 1: Tail of a convergent series → 0
lemma tail_sum_tendsto_zero (seq : ℕ → ℕ) (hGe2 : ∀ k, seq k ≥ 2)
    (hSummable : Summable (fun k => (1 : ℝ) / (seq k : ℝ))) :
    Tendsto (fun n => ∑' k, (1 : ℝ) / (seq (n + k) : ℝ)) atTop (𝓝 0) := by
  -- The shifted tsum equals the tail of the original tsum, which → 0.
  have h_eq : ∀ n, ∑' k, (1 : ℝ) / (seq (n + k) : ℝ) = ∑' k, (fun j => (1 : ℝ) / (seq j : ℝ)) (n + k) := by
    intro n; rfl
  -- Use summable_nat_add and the fact that tails of summable series → 0.
  rw [show (0:ℝ) = ∑' k, (fun j => (1:ℝ)/↑(seq j)) (0 + k) - ∑' k, (fun j => (1:ℝ)/↑(seq j)) (0 + k) from by ring]
  sorry -- This should follow from sum_add_tsum_compl or similar Mathlib lemma

-- Step 2: T_n / P_n → 0  (since T_n / P_n = denom · S_n and S_n → 0)
-- This is the key fact that makes the growth argument work.
lemma residual_over_prefix_tendsto_zero (seq : ℕ → ℕ) (num denom : ℕ)
    (hGe2 : ∀ k, seq k ≥ 2) (hDenom : denom ≥ 1)
    (hSum : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ((num : ℝ) / denom)) :
    Tendsto (fun n => (tailResidual seq num denom n : ℝ) / (prefixProduct seq n : ℝ)) atTop (𝓝 0) := by
  -- T_n / P_n = denom · Σ_{k≥n} 1/a_k → denom · 0 = 0
  sorry

-- Step 3: The growth contradiction.
-- If δ_n = T_{n+1} - T_n ≠ 0 for infinitely many n,
-- then |δ_n| grows at rate ≥ P_n, but T_n/P_n → 0,
-- forcing T negative. Contradiction.
-- Therefore δ_n = 0 eventually, i.e., T_n is eventually constant.
lemma residual_eventually_constant_from_growth (seq : ℕ → ℕ) (num denom : ℕ)
    (hGe2 : ∀ k, seq k ≥ 2)
    (hPos : ∀ k, tailResidual seq num denom k > 0)
    (hTendsTo : Tendsto (fun n => (tailResidual seq num denom n : ℝ) / (prefixProduct seq n : ℝ)) atTop (𝓝 0)) :
    ∃ (C : ℤ) (N : ℕ), ∀ n ≥ N, tailResidual seq num denom n = C := by
  sorry

end
