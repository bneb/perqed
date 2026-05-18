import Mathlib
import Perqed.Erdos265.FundamentalInequality
import Perqed.Erdos265.ProblemStatement
import Perqed.Erdos265.Historical.ValuationGrowth

open Filter Topology Finset Real

noncomputable section

-- ============================================================
-- 1. TOPOLOGICAL INTEGER SQUEEZE
-- ============================================================

/-- A sequence of integers converging in ℝ must eventually lock into a constant. -/
lemma tendsto_int_eventually_const {f : ℕ → ℤ} {L : ℝ}
    (h : Tendsto (fun n => (f n : ℝ)) atTop (nhds L)) :
    ∃ C : ℤ, ∀ᶠ n in atTop, f n = C := by
  have h1 := Metric.tendsto_atTop.mp h (1/4) (by norm_num)
  rcases h1 with ⟨N, hN⟩
  use f N
  rw [Filter.eventually_atTop]
  use N
  intro n hn
  have h_N := hN N (le_refl N)
  have h_n := hN n hn
  have h_dist : |(f n : ℝ) - (f N : ℝ)| < 1/2 := by
    calc |(f n : ℝ) - (f N : ℝ)| = |((f n : ℝ) - L) - ((f N : ℝ) - L)| := by congr 1; ring
      _ ≤ |(f n : ℝ) - L| + |(f N : ℝ) - L| := abs_sub _ _
      _ < 1/4 + 1/4 := add_lt_add h_n h_N
      _ = 1/2 := by norm_num
  have h_eq : f n = f N := by
    by_contra hc
    have h_abs_ge : |f n - f N| ≥ 1 := by 
      exact_mod_cast abs_pos.mpr (sub_ne_zero.mpr hc)
    have h_abs_ge_real : (1 : ℝ) ≤ |(f n : ℝ) - (f N : ℝ)| := by
      have h1 : (1 : ℝ) ≤ (↑(|f n - f N|) : ℝ) := by exact_mod_cast h_abs_ge
      have h2 : (↑(|f n - f N|) : ℝ) = |(↑(f n) : ℝ) - (↑(f N) : ℝ)| := by
        push_cast; rfl
      linarith
    linarith [h_dist]
  exact h_eq

-- ============================================================
-- 2. THE EXACT INTEGER COLLAPSE (NO INTEGER SOLUTIONS)
-- ============================================================

/-- 
  The core arithmetic contradiction: The shifted product X_{N+1} = Y(Y-1) 
  can never equal X_N^2 - X_N + 1 = X(X-1) + 1 for integers X, Y ≥ 2.
  It falls strictly between X(X-1) and X(X+1).
-/
lemma no_integer_collapse (X Y : ℤ) (hX : X ≥ 2) (hY : Y ≥ 2) :
    Y * (Y - 1) ≠ X * (X - 1) + 1 := by
  intro h
  rcases lt_trichotomy Y X with h_lt | h_eq | h_gt
  · have : Y + X - 1 > 0 := by omega
    have : Y - X < 0 := by omega
    have h_bound : Y * (Y - 1) < X * (X - 1) := by nlinarith
    linarith
  · subst h_eq
    nlinarith
  · have : Y - (X + 1) ≥ 0 := by omega
    have : Y + X > 0 := by omega
    have h_bound : Y * (Y - 1) ≥ (X + 1) * X := by nlinarith
    linarith

-- ============================================================
-- 3. CONSTANT COUPLING IMPLIES INTEGER COLLAPSE
-- ============================================================

/-- 
  If the exact coupling variable becomes constant, the sequence X_N = a_N(a_N-1)
  must satisfy X_{N+1} = X_N^2 - X_N + 1. This structurally contradicts `no_integer_collapse`.
-/
theorem constant_coupling_contradiction (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ) (N : ℕ)
    (hGe2 : ∀ k, a k ≥ 2)
    (hC1 : exactCouplingInt a p₁ p₂ q₁ q₂ (N + 1) = exactCouplingInt a p₁ p₂ q₁ q₂ N)
    (hC2 : exactCouplingInt a p₁ p₂ q₁ q₂ (N + 2) = exactCouplingInt a p₁ p₂ q₁ q₂ (N + 1))
    (hPos : exactCouplingInt a p₁ p₂ q₁ q₂ N > 0) :
    False := by
  set C := exactCouplingInt a p₁ p₂ q₁ q₂ N
  set X_N := (a N * (a N - 1) : ℤ)
  set X_N1 := (a (N + 1) * (a (N + 1) - 1) : ℤ)
  set P_N := (q₁ * q₂ : ℤ) * prefixProdUnshiftedInt a N * prefixProdShiftedInt a N
  set P_N1 := (q₁ * q₂ : ℤ) * prefixProdUnshiftedInt a (N + 1) * prefixProdShiftedInt a (N + 1)

  have hRec1 := exact_coupling_recurrence a p₁ p₂ q₁ q₂ N hGe2
  have hRec2 := exact_coupling_recurrence a p₁ p₂ q₁ q₂ (N + 1) hGe2

  have eq1 : C = X_N * C - P_N := by
    calc C = exactCouplingInt a p₁ p₂ q₁ q₂ (N + 1) := hC1.symm
      _ = X_N * exactCouplingInt a p₁ p₂ q₁ q₂ N - P_N := hRec1
      _ = X_N * C - P_N := rfl

  have eq2 : C = X_N1 * C - P_N1 := by
    have : exactCouplingInt a p₁ p₂ q₁ q₂ (N + 1) = C := hC1
    calc C = exactCouplingInt a p₁ p₂ q₁ q₂ (N + 1) := this.symm
      _ = exactCouplingInt a p₁ p₂ q₁ q₂ (N + 2) := hC2.symm
      _ = X_N1 * exactCouplingInt a p₁ p₂ q₁ q₂ (N + 1) - P_N1 := hRec2
      _ = X_N1 * C - P_N1 := by rw [← this]

  have hP_step : P_N1 = P_N * X_N := by
    dsimp [P_N1, P_N, X_N, prefixProdUnshiftedInt, prefixProdShiftedInt]
    rw [prod_range_succ, prod_range_succ]
    push_cast; ring

  have hP_eq1 : P_N = C * (X_N - 1) := by linarith [eq1]
  have hP_eq2 : P_N1 = C * (X_N1 - 1) := by linarith [eq2]

  have h_alg : C * (X_N1 - 1) = C * ((X_N - 1) * X_N) := by
    calc C * (X_N1 - 1) = P_N1 := hP_eq2.symm
      _ = P_N * X_N := hP_step
      _ = C * (X_N - 1) * X_N := by rw [hP_eq1]
      _ = C * ((X_N - 1) * X_N) := by ring

  have hC_ne_zero : C ≠ 0 := ne_of_gt hPos
  have h_X_rec : X_N1 - 1 = (X_N - 1) * X_N := mul_left_cancel₀ hC_ne_zero h_alg
  have h_X_rec2 : X_N1 = X_N * X_N - X_N + 1 := by linarith [h_X_rec]

  -- X_N = a_N * (a_N - 1), X_N1 = a_{N+1} * (a_{N+1} - 1)
  -- h_X_rec2 says: a_{N+1}(a_{N+1}-1) = (a_N(a_N-1))^2 - a_N(a_N-1) + 1
  -- no_integer_collapse says: Y(Y-1) ≠ X(X-1) + 1 for X, Y ≥ 2
  -- But here the recurrence is X_N1 = X_N^2 - X_N + 1 = X_N(X_N - 1) + 1
  -- So we need: a_{N+1}(a_{N+1}-1) ≠ a_N(a_N-1) * (a_N(a_N-1) - 1) + 1
  -- That is: no_integer_collapse with X = a_N(a_N-1), Y = a_{N+1}(a_{N+1}-1) doesn't directly apply
  -- since no_integer_collapse is about Y(Y-1) ≠ X(X-1)+1 with X,Y integers.
  -- 
  -- Actually, X_N = a_N(a_N-1) is already an integer. Set X = X_N, then:
  -- X_N1 = X_N^2 - X_N + 1 = X_N(X_N-1) + 1
  -- And X_N1 = a_{N+1}(a_{N+1}-1), which IS a product Y(Y-1) with Y = a_{N+1}.
  -- So no_integer_collapse(X_N, a_{N+1}) gives: a_{N+1}(a_{N+1}-1) ≠ X_N(X_N-1) + 1
  -- provided X_N ≥ 2 and a_{N+1} ≥ 2.
  
  have hX_N_ge2 : X_N ≥ 2 := by
    have ha := hGe2 N
    have hX_N_eq : X_N = ↑(a N) * (↑(a N) - 1) := rfl
    have : (a N : ℤ) ≥ 2 := by exact_mod_cast ha
    nlinarith
  have ha_N1_ge2 : (a (N + 1) : ℤ) ≥ 2 := by exact_mod_cast hGe2 (N + 1)
  
  -- h_X_rec2: X_N1 = X_N * X_N - X_N + 1 = X_N * (X_N - 1) + 1
  have h_eq : X_N1 = X_N * (X_N - 1) + 1 := by linarith [h_X_rec2]
  -- X_N1 = a_{N+1} * (a_{N+1} - 1), so a_{N+1}(a_{N+1}-1) = X_N(X_N-1) + 1
  -- This contradicts no_integer_collapse(X_N, a_{N+1})
  exact no_integer_collapse X_N (a (N + 1) : ℤ) hX_N_ge2 ha_N1_ge2 h_eq

/--
  **TAUTOLOGICAL — DO NOT CITE AS A RESOLUTION**
  
  This theorem is logically vacuous. The hypothesis `hBoundedSubseq` 
  (limsup > 1 → C_N frequently bounded) is equivalent to the conclusion 
  (limsup ≤ 1), because `bounded_coupling_impossible` proves C_N is 
  NEVER frequently bounded — unconditionally, for ALL dual-rational sequences.

  Since the consequent of `hBoundedSubseq` is always false, the implication 
  P → ⊥ reduces to ¬P, which is exactly limsup ≤ 1.

  This theorem is retained only as documentation of a proof strategy that 
  turned out to be circular. The unconditional result is 
  `greedy_erdos265_impossible` in Main.lean.
-/
theorem erdos265_limsup_le_one (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ)
    (hq1 : q₁ > 0) (hq2 : q₂ > 0) (hp1 : p₁ > 0) (hp2 : p₂ > 0)
    (hGe2 : ∀ k, a k ≥ 2)
    (hSum1 : HasSum (fun k => 1 / (a k : ℝ)) (p₁ / q₁))
    (hSum2 : HasSum (fun k => 1 / ((a k : ℝ) - 1)) (p₂ / q₂))
    (hBoundedSubseq : 1 < limsup (fun n => (a n : ℝ) ^ ((1 : ℝ) / 2 ^ n)) atTop → 
      ∃ M : ℤ, ∃ᶠ n in atTop, exactCouplingInt a p₁ p₂ q₁ q₂ n ≤ M) :
    limsup (fun n => (a n : ℝ) ^ ((1 : ℝ) / 2 ^ n)) atTop ≤ 1 := by
  by_contra h_contra
  push_neg at h_contra
  
  -- Extract the uniform bound forced by doubly-exponential growth
  have h_bound_ex := hBoundedSubseq h_contra
  rcases h_bound_ex with ⟨M, hM⟩

  -- The sequence hits the 2-Adic Divergence trap
  have h_recur : ∀ N, exactCouplingInt a p₁ p₂ q₁ q₂ (N + 1) = 
      (a N * (a N - 1) : ℤ) * exactCouplingInt a p₁ p₂ q₁ q₂ N - 
      ((q₁ * q₂ : ℤ) * prefixProdUnshiftedInt a N * prefixProdShiftedInt a N) := by
    intro N
    exact exact_coupling_recurrence a p₁ p₂ q₁ q₂ N hGe2

  have h_X_even : ∀ N, 2 ∣ (a N * (a N - 1) : ℤ) := by
    intro N
    -- The product of two consecutive integers is always even
    cases Int.emod_two_eq_zero_or_one (a N : ℤ) with
    | inl he => 
      have h_dvd : 2 ∣ (a N : ℤ) := Int.dvd_of_emod_eq_zero he
      exact dvd_mul_of_dvd_left h_dvd _
    | inr ho =>
      have he2 : ((a N : ℤ) - 1) % 2 = 0 := by omega
      have h_dvd : 2 ∣ ((a N : ℤ) - 1) := Int.dvd_of_emod_eq_zero he2
      exact dvd_mul_of_dvd_right h_dvd _

  have h_P_div : ∀ N, (2 : ℤ) ^ N ∣ ((q₁ * q₂ : ℤ) * prefixProdUnshiftedInt a N * prefixProdShiftedInt a N) := by
    intro N
    induction' N with N ih
    · simp
    · rw [prefixProdUnshiftedInt_succ, prefixProdShiftedInt_succ]
      have h1 : (2 : ℤ) ^ (N + 1) = (2 : ℤ) ^ N * 2 := by ring
      rw [h1]
      -- Rearrange the product to pull out a_N * (a_N - 1)
      have h_alg : (q₁ * q₂ : ℤ) * (prefixProdUnshiftedInt a N * (a N : ℤ)) * (prefixProdShiftedInt a N * ((a N : ℤ) - 1)) =
          ((q₁ * q₂ : ℤ) * prefixProdUnshiftedInt a N * prefixProdShiftedInt a N) * ((a N : ℤ) * ((a N : ℤ) - 1)) := by ring
      rw [h_alg]
      -- Apply divisibility
      have h_even_N := h_X_even N
      have h_prod_even : 2 ∣ (a N : ℤ) * ((a N : ℤ) - 1) := by
        exact h_even_N
      exact mul_dvd_mul ih h_prod_even

  have h_pos : ∀ N, exactCouplingInt a p₁ p₂ q₁ q₂ N > 0 := by
    intro N
    have := exact_coupling_int_ge_one a p₁ p₂ q₁ q₂ N hq1 hq2 hp1 hp2 hGe2 hSum1 hSum2
    linarith

  exact bounded_coupling_impossible 
    (fun n => exactCouplingInt a p₁ p₂ q₁ q₂ n)
    (fun n => (a n * (a n - 1) : ℤ))
    (fun n => (q₁ * q₂ : ℤ) * prefixProdUnshiftedInt a n * prefixProdShiftedInt a n)
    h_recur h_X_even h_P_div h_pos M hM

/--
  **Corollary**: Under the additional assumption that `aₙ^{1/2ⁿ}` is bounded above,
  the limsup bound upgrades to a genuine limit: `aₙ^{1/2ⁿ} → 1`.
  
  The lower bound `aₙ^{1/2ⁿ} ≥ 1` is immediate from `aₙ ≥ 2`.
-/
theorem erdos265_tendsto_one (a : ℕ → ℕ) (p₁ p₂ : ℤ) (q₁ q₂ : ℕ)
    (hq1 : q₁ > 0) (hq2 : q₂ > 0) (hp1 : p₁ > 0) (hp2 : p₂ > 0)
    (hGe2 : ∀ k, a k ≥ 2)
    (hSum1 : HasSum (fun k => 1 / (a k : ℝ)) (p₁ / q₁))
    (hSum2 : HasSum (fun k => 1 / ((a k : ℝ) - 1)) (p₂ / q₂))
    (hBdd : IsBoundedUnder (· ≤ ·) atTop (fun n => (a n : ℝ)^(1 / (2:ℝ)^n)))
    (hBoundedSubseq : 1 < limsup (fun n => (a n : ℝ) ^ ((1 : ℝ) / 2 ^ n)) atTop → 
      ∃ M : ℤ, ∃ᶠ n in atTop, exactCouplingInt a p₁ p₂ q₁ q₂ n ≤ M) :
    Tendsto (fun n => (a n : ℝ)^(1 / (2:ℝ)^n)) atTop (nhds 1) := by
  have h_limsup_le_one := erdos265_limsup_le_one a p₁ p₂ q₁ q₂ hq1 hq2 hp1 hp2 hGe2 hSum1 hSum2 hBoundedSubseq
  
  have h_le : ∀ n, (1 : ℝ) ≤ (a n : ℝ) ^ ((1 : ℝ) / 2 ^ n) := by
    intro n
    have hn2 : 1 ≤ a n := by have := hGe2 n; omega
    have : (1 : ℝ) ≤ (a n : ℝ) := by exact_mod_cast hn2
    have hp : (0 : ℝ) ≤ (1 : ℝ) / 2 ^ n := by positivity
    exact Real.one_le_rpow this hp
  
  rw [Metric.tendsto_atTop]
  intro ε hε
  have h_lt : limsup (fun n => (a n : ℝ) ^ ((1 : ℝ) / 2 ^ n)) atTop < 1 + ε := lt_of_le_of_lt h_limsup_le_one (by linarith)
  have h_ev : ∀ᶠ n in atTop, (a n : ℝ) ^ ((1 : ℝ) / 2 ^ n) < 1 + ε := eventually_lt_of_limsup_lt h_lt hBdd
  obtain ⟨N, hN⟩ := eventually_atTop.mp h_ev
  use N
  intro n hn
  have h_bound := hN n hn
  rw [Real.dist_eq, abs_of_nonneg (by linarith [h_le n])]
  linarith

end
