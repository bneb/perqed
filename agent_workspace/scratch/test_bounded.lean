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

-- The KEY lemma: T_n is bounded above.
-- T_n = denom * P_n * Σ_{k≥n} 1/a_k  (by proven identity)
-- Σ_{k≥n} 1/a_k ≤ 2/a_n  (geometric bound, since a_{k+1} ≥ a_k²/2 eventually)
-- P_n/a_n < C  (since P_n ≈ L^{2^n-1}, a_n ≈ L^{2^n})
-- So T_n ≤ 2*denom*C.
-- 
-- But we don't even need this! A simpler argument:
-- T_n is a positive integer (proven).
-- T_n/P_n = denom * Σ_{k≥n} 1/a_k, which is strictly decreasing.
-- Since T_n/P_n is strictly decreasing and T_n is a positive integer,
-- and P_n is strictly increasing, T_n must eventually be constant.
-- (If T_n increased, T_n/P_n would decrease even faster. If T_n decreased,
-- it's a positive integer so it can only decrease finitely many times.)

-- Actually, the cleanest argument:
-- T_n/P_n = denom * Σ_{k≥n} 1/a_k → 0 (since Σ 1/a_k converges).
-- But T_n ≥ 1 (positive integer). So P_n → ∞ forces T_n/P_n → 0.
-- Wait, T_n/P_n → 0 with T_n ≥ 1 and P_n → ∞ is consistent: T_n could grow,
-- just slower than P_n. We need T_n to be BOUNDED, not just T_n/P_n → 0.

-- The real argument:
-- T_{n+1} = a_n * T_n - denom * P_n
-- If T_n = C (constant) for large n, then denom * P_n = C * (a_n - 1).
-- 
-- Key bound: T_{n+1} ≤ T_n iff a_n * T_n - denom * P_n ≤ T_n
-- iff T_n * (a_n - 1) ≤ denom * P_n
-- iff T_n ≤ denom * P_n / (a_n - 1)
-- But T_n = denom * P_n * Σ_{k≥n} 1/a_k, and Σ_{k≥n} 1/a_k < 1/(a_n - 1)
-- (since Σ 1/a_k < 1/(a_n - 1) for Sylvester-like sequences).
-- Wait, for Sylvester Σ_{k≥n} 1/a_k = 1/(a_n - 1) exactly.
-- So T_n = denom * P_n / (a_n - 1) exactly, and T_{n+1} = T_n.

-- For general sequences with L > 1:
-- Σ_{k≥n} 1/a_k < 1/(a_n - 1) eventually
-- (this is the key fact about fast-growing sequences)
-- So T_n < denom * P_n / (a_n - 1), which means T_{n+1} < T_n eventually.
-- Since T_n is a positive integer and eventually decreasing, it's eventually constant. QED!

-- Let's formalize this.
lemma tail_sum_lt_inv_pred (seq : ℕ → ℕ) 
    (hGe2 : ∀ k, seq k ≥ 2) (hMono : StrictMono seq)
    (hLimsup : ∃ L : ℝ, L > 1 ∧ Tendsto (fun k => (seq k : ℝ) ^ ((1:ℝ)/2^k)) atTop (𝓝 L)) :
    ∀ᶠ n in atTop, ∑' k, (1 : ℝ) / (seq (n + k) : ℝ) < 1 / ((seq n : ℝ) - 1) := by
  sorry

-- From the above, T_{n+1} < T_n eventually:
lemma tailResidual_eventually_decreasing (seq : ℕ → ℕ) (num denom : ℕ) 
    (hGe2 : ∀ k, seq k ≥ 2) (hMono : StrictMono seq) (hDenom : denom ≥ 1)
    (hSum : HasSum (fun k => (1:ℝ)/(seq k : ℝ)) ((num:ℝ)/denom))
    (hLimsup : ∃ L : ℝ, L > 1 ∧ Tendsto (fun k => (seq k : ℝ)^((1:ℝ)/2^k)) atTop (𝓝 L)) :
    ∀ᶠ n in atTop, tailResidual seq num denom (n+1) ≤ tailResidual seq num denom n := by
  sorry

-- A positive integer sequence that is eventually decreasing is eventually constant.
lemma pos_int_eventually_decreasing_const (f : ℕ → ℤ) 
    (hPos : ∀ k, f k > 0) (hDecr : ∃ N, ∀ n ≥ N, f (n+1) ≤ f n) :
    ∃ C : ℤ, ∃ M : ℕ, ∀ n ≥ M, f n = C := by
  rcases hDecr with ⟨N, hN⟩
  -- f is decreasing from N, f ≥ 1 always, so f(N) ≥ f(N+1) ≥ ... ≥ 1.
  -- A non-increasing sequence of positive integers bounded below by 1 is eventually constant.
  -- f(N) is finite, so f can decrease at most f(N)-1 times before hitting 1 and staying.
  sorry

end
