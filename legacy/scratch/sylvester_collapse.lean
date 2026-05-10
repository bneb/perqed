import Mathlib

open Filter Topology Finset

/-!
# Erdős Problem 265: The Sylvester Collapse

This file contains the formalized proof of the doubly-exponential growth ceiling
for sequences satisfying the rational sum properties described in Erdős Problem 265.

Given a strictly increasing sequence of positive integers `a_n` where `a_n ≥ 2`,
if the sequence grows at least as fast as the Sylvester recurrence:
  `a_{n+1} ≥ a_n^2 - a_n + 1`
and the sum of reciprocals `∑ 1/a_n` converges to a rational number `q`,
then the sequence must eventually perfectly match the Sylvester recurrence:
  `a_{n+1} = a_n^2 - a_n + 1`

This shows that the growth rate `a_n ~ C^{2^n}` is a strict upper bound.
-/

-- ============================================================================
-- Section 1: Helper Lemmas and Definitions
-- ============================================================================

/-- The partial sum of reciprocals up to index `n`. -/
def partial_sum (a : ℕ → ℕ) (n : ℕ) : ℚ :=
  ∑ i ∈ range n, (1 / (a i : ℚ))

/-- The tail of the infinite series, expressed as `q - S_n`. -/
def rational_tail (q : ℚ) (a : ℕ → ℕ) (n : ℕ) : ℚ :=
  q - partial_sum a n

/-- The common denominator for the finite prefix of the series. -/
def common_denom (q : ℚ) (a : ℕ → ℕ) (n : ℕ) : ℕ :=
  q.den * (∏ i ∈ range n, a i)

/-- Proves that the common denominator is strictly positive. -/
lemma common_denom_pos (a : ℕ → ℕ) (h_pos : ∀ n, a n ≥ 2) (q : ℚ) (n : ℕ) : 
  (common_denom q a n : ℚ) > 0 := by
  dsimp [common_denom]
  have hq : (0 : ℚ) < q.den := by exact_mod_cast q.den_pos
  have hprod : (0 : ℚ) < ∏ i ∈ range n, (a i : ℚ) := by
    apply prod_pos
    intro i _
    have := h_pos i
    norm_cast
    linarith
  exact_mod_cast mul_pos hq hprod

/-- 
Rigidity Lemma: `R_n` is a rational number whose denominator divides `D_n`.
Thus, there exists an integer numerator `k_n` such that `R_n = k_n / D_n`.
-/
lemma rational_tail_rigidity (a : ℕ → ℕ) (h_pos : ∀ n, a n ≥ 2) (q : ℚ) (n : ℕ) :
  ∃ k : ℤ, rational_tail q a n = k / (common_denom q a n : ℚ) := by
  induction' n with n ih
  · use q.num
    dsimp [rational_tail, partial_sum, common_denom]
    simp only [sub_zero, mul_one]
    exact (Rat.num_div_den q).symm 
  · rcases ih with ⟨k_n, hk_n⟩
    use k_n * (a n : ℤ) - (∏ i ∈ range n, a i : ℤ) * q.den
    have hS : partial_sum a (n + 1) = partial_sum a n + 1 / (a n : ℚ) := by 
      dsimp [partial_sum]
      rw [sum_range_succ]
    have hR : rational_tail q a (n + 1) = rational_tail q a n - 1 / (a n : ℚ) := by 
      dsimp [rational_tail]
      rw [hS]
      ring
    have hD : (common_denom q a (n + 1) : ℚ) = (common_denom q a n : ℚ) * (a n : ℚ) := by 
      dsimp [common_denom]
      rw [prod_range_succ]
      push_cast
      ring
    rw [hR, hk_n, hD]
    have ha_ne : (a n : ℚ) ≠ 0 := by 
      have := h_pos n
      norm_cast
      linarith
    have hD_ne : (common_denom q a n : ℚ) ≠ 0 := 
      (common_denom_pos a h_pos q n).ne'
    push_cast
    field_simp [hD_ne, ha_ne]
    dsimp [common_denom]
    push_cast
    ring

/-- 
Analytic Positivity Lemma: `k_n > 0` follows from the fact that the sum of 
positive terms converges to `q`, meaning the tail is always strictly positive.
-/
lemma integer_numerator_pos (a : ℕ → ℕ) (h_pos : ∀ n, a n ≥ 2) (q : ℚ) 
  (h_sum : HasSum (fun n => (1 : ℝ) / (a n : ℝ)) (q : ℝ)) (n : ℕ)
  (k : ℕ → ℤ) (hk_def : ∀ n, rational_tail q a n = (k n : ℚ) / (common_denom q a n : ℚ)) :
  k n > 0 := by
  have h_lim_S : Tendsto (fun N => (partial_sum a N : ℝ)) atTop (𝓝 (q : ℝ)) := by
    have := h_sum.tendsto_sum_nat
    have h_eq : (fun n => (partial_sum a n : ℝ)) = (fun n => ∑ i ∈ range n, 1 / (a i : ℝ)) := by
      ext m
      simp only [partial_sum]
      push_cast
      rfl
    rw [h_eq]
    exact this
    
  have h_lim_diff : Tendsto (fun N => (partial_sum a N : ℝ) - (partial_sum a n : ℝ)) atTop (𝓝 ((q : ℝ) - (partial_sum a n : ℝ))) := 
    Tendsto.sub h_lim_S tendsto_const_nhds
    
  have h_diff_pos : ∀ N > n, (partial_sum a N : ℝ) - (partial_sum a n : ℝ) ≥ 1 / (a n : ℝ) := by
    intro N hN
    induction' hN with M hM ih
    · dsimp [partial_sum]
      rw [sum_range_succ]
      push_cast
      ring_nf
      exact le_rfl
    · have hS_succ : partial_sum a (M + 1) = partial_sum a M + 1 / (a M : ℚ) := by 
        dsimp [partial_sum]
        rw [sum_range_succ]
      have h1 : (partial_sum a (M + 1) : ℝ) - (partial_sum a n : ℝ) = (partial_sum a M : ℝ) - (partial_sum a n : ℝ) + 1 / (a M : ℝ) := by 
        rw [hS_succ]
        push_cast
        ring
      rw [h1]
      have h_a_M : (a M : ℝ) > 0 := by 
        have := h_pos M
        exact_mod_cast (by linarith : (a M : ℤ) > 0)
      have h2 : 1 / (a M : ℝ) > 0 := one_div_pos.mpr h_a_M
      linarith
      
  have h_limit_ge : (q : ℝ) - (partial_sum a n : ℝ) ≥ 1 / (a n : ℝ) := by
    have h_eventual_ge : ∀ᶠ N in atTop, (partial_sum a N : ℝ) - (partial_sum a n : ℝ) ≥ 1 / (a n : ℝ) := by
      apply eventually_atTop.mpr
      use (n + 1)
      intro N hN
      exact h_diff_pos N hN
    exact ge_of_tendsto h_lim_diff h_eventual_ge
    
  have hR_real : (rational_tail q a n : ℝ) = (q : ℝ) - (partial_sum a n : ℝ) := by 
    dsimp [rational_tail]
    push_cast
    rfl
    
  have hR_pos_real : (rational_tail q a n : ℝ) > 0 := by
    have h_an_pos : (a n : ℝ) > 0 := by 
      have := h_pos n
      exact_mod_cast (by linarith : (a n : ℤ) > 0)
    have : 1 / (a n : ℝ) > 0 := one_div_pos.mpr h_an_pos
    linarith
    
  have hR_pos : rational_tail q a n > 0 := by exact_mod_cast hR_pos_real
  have hD0 : (common_denom q a n : ℚ) > 0 := common_denom_pos a h_pos q n
  have hk_eq : (k n : ℚ) = rational_tail q a n * common_denom q a n := by 
    rw [hk_def n]
    field_simp [hD0.ne']
  have hk_q_pos : (k n : ℚ) > 0 := by 
    rw [hk_eq]
    exact mul_pos hR_pos hD0
  exact_mod_cast hk_q_pos

/-- Telescoping inequality for sequences growing at least as fast as Sylvester. -/
lemma telescoping_inequality (a : ℕ → ℕ) (h_growth : ∀ n, a (n + 1) ≥ a n ^ 2 - a n + 1) 
  (h_pos : ∀ n, a n ≥ 2) (k : ℕ) :
  (1 : ℚ) / (a k : ℚ) ≤ 1 / ((a k : ℚ) - 1) - 1 / ((a (k + 1) : ℚ) - 1) := by
  have hg := h_growth k
  have hp := h_pos k
  have hp1 := h_pos (k + 1)
  
  have h1 : (a k : ℚ) - 1 > 0 := by
    have : (a k : ℤ) ≥ 2 := by exact_mod_cast hp
    exact_mod_cast (by linarith : (a k : ℤ) - 1 > 0)
  have h2 : (a (k + 1) : ℚ) - 1 > 0 := by
    have : (a (k + 1) : ℤ) ≥ 2 := by exact_mod_cast hp1
    exact_mod_cast (by linarith : (a (k + 1) : ℤ) - 1 > 0)
  have h3 : (a k : ℚ) > 0 := by
    have : (a k : ℤ) ≥ 2 := by exact_mod_cast hp
    exact_mod_cast (by linarith : (a k : ℤ) > 0)
    
  have H_right : 1 / ((a k : ℚ) - 1) - 1 / ((a (k + 1) : ℚ) - 1) = ((a (k + 1) : ℚ) - (a k : ℚ)) / (((a k : ℚ) - 1) * ((a (k + 1) : ℚ) - 1)) := by
    field_simp [h1.ne', h2.ne']
    ring
  rw [H_right]
  
  have H_cross : 1 * (((a k : ℚ) - 1) * ((a (k + 1) : ℚ) - 1)) ≤ ((a (k + 1) : ℚ) - (a k : ℚ)) * (a k : ℚ) ↔ (1 : ℚ) / (a k : ℚ) ≤ ((a (k + 1) : ℚ) - (a k : ℚ)) / (((a k : ℚ) - 1) * ((a (k + 1) : ℚ) - 1)) := by
    exact (div_le_div_iff₀ h3 (mul_pos h1 h2)).symm
  rw [← H_cross]
  
  have hg_z : (a (k + 1) : ℤ) ≥ (a k : ℤ) ^ 2 - (a k : ℤ) + 1 := by
    have hs : ((a k ^ 2 - a k + 1 : ℕ) : ℤ) = (a k : ℤ) ^ 2 - (a k : ℤ) + 1 := by
      rw [Nat.cast_add, Nat.cast_sub (by nlinarith : a k ≤ a k ^ 2)]
      push_cast
      rfl
    have hg' : (a (k + 1) : ℤ) ≥ ((a k ^ 2 - a k + 1 : ℕ) : ℤ) := by exact_mod_cast hg
    rw [hs] at hg'
    exact hg'
    
  exact_mod_cast (by nlinarith : 1 * (((a k : ℤ) - 1) * ((a (k + 1) : ℤ) - 1)) ≤ ((a (k + 1) : ℤ) - (a k : ℤ)) * (a k : ℤ))

/-- Finite bound on the partial sums using the telescoping inequality. -/
lemma partial_sum_finite_bound (a : ℕ → ℕ) (h_growth : ∀ n, a (n + 1) ≥ a n ^ 2 - a n + 1) 
  (h_pos : ∀ n, a n ≥ 2) (n : ℕ) (N : ℕ) (hN : N ≥ n) :
  partial_sum a N - partial_sum a n ≤ 1 / ((a n : ℚ) - 1) - 1 / ((a N : ℚ) - 1) := by
  induction' N, hN using Nat.le_induction with M hM ih
  · simp [partial_sum]
  · have hS_succ : partial_sum a (M + 1) - partial_sum a n = (partial_sum a M - partial_sum a n) + 1 / (a M : ℚ) := by 
      dsimp [partial_sum]
      rw [sum_range_succ]
      ring
    rw [hS_succ]
    have h_tele := telescoping_inequality a h_growth h_pos M
    linarith

/-- Simplified finite bound on the partial sums. -/
lemma partial_sum_simplified_bound (a : ℕ → ℕ) (h_growth : ∀ n, a (n + 1) ≥ a n ^ 2 - a n + 1) 
  (h_pos : ∀ n, a n ≥ 2) (n N : ℕ) (hN : N ≥ n) :
  partial_sum a N - partial_sum a n ≤ 1 / ((a n : ℚ) - 1) := by
  have H := partial_sum_finite_bound a h_growth h_pos n N hN
  have hp : (a N : ℤ) ≥ 2 := by exact_mod_cast h_pos N
  have hpos : (a N : ℚ) - 1 > 0 := by
    have : (a N : ℤ) - 1 > 0 := by linarith
    exact_mod_cast this
  have hpos2 : 1 / ((a N : ℚ) - 1) > 0 := one_div_pos.mpr hpos
  linarith

/-- The analytic tail bound crossing from ℝ to ℚ. -/
lemma rational_tail_analytic_bound (a : ℕ → ℕ) (h_growth : ∀ n, a (n + 1) ≥ a n ^ 2 - a n + 1) 
  (h_pos : ∀ n, a n ≥ 2) (q : ℚ) (h_sum : HasSum (fun n => (1 : ℝ) / (a n : ℝ)) (q : ℝ)) (n : ℕ) :
  rational_tail q a n ≤ 1 / ((a n : ℚ) - 1) := by
  have h_real_bound : (rational_tail q a n : ℝ) ≤ 1 / ((a n : ℝ) - 1) := by
    have h_lim_S : Tendsto (fun N => (partial_sum a N : ℝ)) atTop (𝓝 (q : ℝ)) := by
      have := h_sum.tendsto_sum_nat
      have h_eq : (fun n => (partial_sum a n : ℝ)) = (fun n => ∑ i ∈ range n, 1 / (a i : ℝ)) := by
        ext m
        simp only [partial_sum]
        push_cast
        rfl
      rw [h_eq]
      exact this
      
    have h_lim_diff : Tendsto (fun N => (partial_sum a N : ℝ) - (partial_sum a n : ℝ)) atTop (𝓝 ((q : ℝ) - (partial_sum a n : ℝ))) := 
      Tendsto.sub h_lim_S tendsto_const_nhds
      
    have h_eventual_bound : ∀ᶠ N in atTop, (partial_sum a N : ℝ) - (partial_sum a n : ℝ) ≤ 1 / ((a n : ℝ) - 1) := by
      apply eventually_atTop.mpr
      use n
      intro N hN
      have H := partial_sum_simplified_bound a h_growth h_pos n N hN
      exact_mod_cast H
      
    have h_limit_le := le_of_tendsto h_lim_diff h_eventual_bound
    
    have hR_real : (rational_tail q a n : ℝ) = (q : ℝ) - (partial_sum a n : ℝ) := by 
      dsimp [rational_tail]
      push_cast
      rfl
    rw [← hR_real] at h_limit_le
    exact h_limit_le
    
  exact_mod_cast h_real_bound


-- ============================================================================
-- Section 2: The Main Theorem
-- ============================================================================

/-- 
The Sylvester Collapse.
Final fully verified formal proof establishing the doubly-exponential 
growth ceiling constraint.
-/
theorem sylvester_collapse (a : ℕ → ℕ)
  (h_growth : ∀ n, a (n + 1) ≥ a n ^ 2 - a n + 1)
  (h_pos : ∀ n, a n ≥ 2)
  (q : ℚ) (h_sum : HasSum (fun n => (1 : ℝ) / (a n : ℝ)) (q : ℝ)) :
  ∃ N, ∀ n ≥ N, a (n + 1) = a n ^ 2 - a n + 1 := by
  
  -- Aliases for definitions
  let S := partial_sum a
  let R := rational_tail q a
  let D := common_denom q a
  
  -- Step 1: Establish Rigidity (Extracting k_n)
  have h_rational : ∀ n, ∃ k : ℤ, R n = k / (D n : ℚ) := by
    intro n
    exact rational_tail_rigidity a h_pos q n

  let k (n : ℕ) : ℤ := (h_rational n).choose
  have hk_def (n : ℕ) : R n = (k n : ℚ) / (D n : ℚ) := (h_rational n).choose_spec

  -- Step 2: Establish the Diophantine Recurrence
  have hk_step (n : ℕ) : (k (n + 1) : ℚ) = (k n : ℚ) * (a n : ℚ) - (D n : ℚ) := by
    have hR : R (n + 1) = R n - 1 / (a n : ℚ) := by 
      dsimp [R, rational_tail, S, partial_sum]
      rw [sum_range_succ]
      ring
    have hD : (D (n + 1) : ℚ) = (D n : ℚ) * (a n : ℚ) := by 
      dsimp [D, common_denom]
      rw [prod_range_succ]
      push_cast
      ring
    have ha_ne : (a n : ℚ) ≠ 0 := by 
      have := h_pos n
      norm_cast
      linarith
    have hD_ne : (D n : ℚ) ≠ 0 := (common_denom_pos a h_pos q n).ne'
    have h_frac : (k (n + 1) : ℚ) / ((D n : ℚ) * (a n : ℚ)) = (k n : ℚ) / (D n : ℚ) - 1 / (a n : ℚ) := by
      rw [← hD, ← hk_def (n + 1), hR, hk_def n]
    have h_mult := congrArg (fun x => x * ((D n : ℚ) * (a n : ℚ))) h_frac
    dsimp at h_mult
    rw [div_mul_cancel₀ _ (mul_ne_zero hD_ne ha_ne)] at h_mult
    have h_right : ((k n : ℚ) / (D n : ℚ) - 1 / (a n : ℚ)) * ((D n : ℚ) * (a n : ℚ)) = (k n : ℚ) * (a n : ℚ) - (D n : ℚ) := by
      rw [sub_mul]
      have H1 : (k n : ℚ) / (D n : ℚ) * ((D n : ℚ) * (a n : ℚ)) = (k n : ℚ) * (a n : ℚ) := by
        rw [← mul_assoc, div_mul_cancel₀ _ hD_ne]
      have H2 : 1 / (a n : ℚ) * ((D n : ℚ) * (a n : ℚ)) = (D n : ℚ) := by 
        field_simp [ha_ne]
      rw [H1, H2]
    rw [h_right] at h_mult
    exact h_mult

  -- Step 3: Extract Analytic Tail Bound
  have h_tail_bound : ∀ n, R n ≤ 1 / ((a n : ℚ) - 1) := by
    intro n
    exact rational_tail_analytic_bound a h_growth h_pos q h_sum n

  -- Step 4: Diophantine Descent (k_n is non-increasing)
  have hk_mono : ∀ n, k (n + 1) ≤ k n := by
    intro n
    have h_bound := h_tail_bound n
    rw [hk_def n] at h_bound
    have ha1 : (a n : ℚ) - 1 > 0 := by 
      have : (a n : ℤ) ≥ 2 := by exact_mod_cast h_pos n
      exact_mod_cast (by linarith : (a n : ℤ) - 1 > 0)
    have hD0 : (D n : ℚ) > 0 := common_denom_pos a h_pos q n
    have h_le : (k (n + 1) : ℚ) ≤ (k n : ℚ) := by
      have h_bound_mult : (k n : ℚ) * ((a n : ℚ) - 1) ≤ (D n : ℚ) := by
        rw [div_le_iff₀ hD0] at h_bound
        field_simp [ha1.ne'] at h_bound
        exact h_bound
      -- Combine the recurrence and the bound
      have h_step := hk_step n
      nlinarith
    exact_mod_cast h_le

  -- Step 5: Integer Collapse (k_n eventually constant via Order Theory)
  have hk_pos_val : ∀ n, k n > 0 := by
    intro n
    exact integer_numerator_pos a h_pos q h_sum n k hk_def

  have hk_const : ∃ N, ∀ n ≥ N, k (n + 1) = k n := by
    let K : ℕ → ℕ := fun n => (k n).toNat
    have hK_mono : Antitone K := by
      intro n m hnm
      apply Int.toNat_le_toNat
      induction' hnm with m hnm ih
      · exact le_rfl
      · exact (hk_mono m).trans ih
    have h_min_exists := WellFounded.has_min Nat.lt_wfRel.wf (Set.range K) (Set.range_nonempty K)
    rcases h_min_exists with ⟨min, ⟨N, hN_eq⟩, h_not_lt⟩
    have h_le : ∀ x ∈ Set.range K, min ≤ x := fun x hx => not_lt.mp (h_not_lt x hx)
    obtain ⟨N', hN_eq'⟩ : ∃ N, ∀ n ≥ N, K n = K (n + 1) := by
      use N
      intro m hm
      have h1 : K m ≤ K N := hK_mono hm
      have h2 : K N ≤ K m := by rw [hN_eq]; exact h_le (K m) (Set.mem_range_self m)
      have h3 : K (m + 1) ≤ K m := hK_mono (Nat.le_succ m)
      have h4 : K N ≤ K (m + 1) := by rw [hN_eq]; exact h_le (K (m + 1)) (Set.mem_range_self (m + 1))
      linarith
    use N'
    intro m hm
    have h_K_eq := hN_eq' m hm
    have hkp1 : 0 ≤ k (m + 1) := (hk_pos_val (m + 1)).le
    have hkp0 : 0 ≤ k m := (hk_pos_val m).le
    have h_symm : (k (m + 1)).toNat = (k m).toNat := h_K_eq.symm
    have hz1 : k (m + 1) = ((k (m + 1)).toNat : ℤ) := by exact (Int.toNat_of_nonneg hkp1).symm
    have hz0 : k m = ((k m).toNat : ℤ) := by exact (Int.toNat_of_nonneg hkp0).symm
    rw [hz1, hz0, h_symm]

  -- Step 6: Final Collapse (Stabilized k_n forces the Sylvester Identity)
  obtain ⟨N, hN⟩ := hk_const
  use N
  intro n hn
  
  -- The invariant equality derived from stabilization
  have h_eq : (k (n + 1) : ℚ) = (k n : ℚ) := by norm_cast; exact hN n hn
  
  -- Identity: D n = k n * (a n - 1)
  have h_step := hk_step n
  rw [h_eq] at h_step
  have hD_kn : (D n : ℚ) = (k n : ℚ) * ((a n : ℚ) - 1) := by linarith
  
  -- Identity for n + 1
  have h_step_next := hk_step (n + 1)
  have h_kn_eq_next : (k (n + 2) : ℚ) = (k (n + 1) : ℚ) := by 
    norm_cast
    exact hN (n + 1) (by linarith)
  rw [h_kn_eq_next] at h_step_next
  have hD_kn_next : (D (n + 1) : ℚ) = (k (n + 1) : ℚ) * ((a (n + 1) : ℚ) - 1) := by linarith
  
  -- Relate D (n+1) to D n
  have hD_step : (D (n + 1) : ℚ) = (D n : ℚ) * (a n : ℚ) := by
    dsimp [D, common_denom]
    rw [prod_range_succ]
    push_cast
    ring
  
  -- Final algebraic identity forced by k_n stabilization
  have h_final_q : (a (n + 1) : ℚ) = (a n : ℚ) ^ 2 - (a n : ℚ) + 1 := by
    rw [hD_kn_next, hD_kn] at hD_step
    rw [h_eq] at hD_step
    have hkp : (k n : ℚ) > 0 := by norm_cast; exact hk_pos_val n
    nlinarith

  -- Bridge the gap from ℚ to ℕ safely
  have ha_le : a n ≤ a n ^ 2 := by
    have hp := h_pos n
    nlinarith
  
  zify [ha_le]
  exact_mod_cast h_final_q
