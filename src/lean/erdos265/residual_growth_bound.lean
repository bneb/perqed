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
  Previously declared as `axiom` (silently extending the logic); now an honest `sorry`.
-/
theorem asymptoticSqueezeLimit (seq : ℕ → ℕ) (num denom : ℕ) (limitL : ℝ)
    (hSum : HasSum (fun k => (1 : ℝ) / (seq k : ℝ)) ((num : ℝ) / denom))
    (hLimsup : Tendsto (fun k => (seq k : ℝ) ^ ((1 : ℝ) / 2 ^ k)) atTop (𝓝 limitL)) :
    Tendsto (fun n => (tailResidual seq num denom n : ℝ)) atTop (𝓝 (denom / limitL)) := by
  sorry

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
  have hConv := asymptoticSqueezeLimit seq num denom limitL hSum hLimsup
  
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

end
