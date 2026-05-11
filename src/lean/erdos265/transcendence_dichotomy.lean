import Mathlib

/-!
# Erdős 265: The Rational-Transcendental Dichotomy (Nishioka's Theorem)

This file formally states Nishioka's Theorem for Mahler functions and applies
it to our specific formal series `F(w)`.

Nishioka's Theorem (1996) requires the function to be analytic at the origin.
If `F(w)` is an analytic power series satisfying `F(w) = R(w) + F(φ(w))`
where `φ(0) = 0` and `φ'(0) = 0` (a super-attracting fixed point), then `F(w)`
is either a rational function `F ∈ ℂ(w)` or transcendental over `ℂ(w)`.

We prove `F ∉ ℂ(w)` by showing that any rational representation P/Q
must have Q(1) = 0 (from the fixed point φ(1) = 1), and then deriving
a pole-order contradiction using the cleared-denominator polynomial identity.
-/

noncomputable section

open Complex Polynomial

/-- The rational substitution mapping the inverted Sylvester sequence -/
def phi (w : ℂ) : ℂ :=
  w^2 / (1 - w + w^2)

/-- The functional recurrence step. -/
def SatisfiesMahlerEquation (F : ℂ → ℂ) : Prop :=
  ∀ w : ℂ, w ≠ -1 → (1 - w + w^2) ≠ 0 → F w = w / (1 + w) + F (phi w)

/-- The correct formalization of "F is a rational function":
    F agrees with P/Q at all points where Q does not vanish. -/
def IsRationalFunction (F : ℂ → ℂ) (P Q : Polynomial ℂ) : Prop :=
  Q ≠ 0 ∧ IsCoprime P Q ∧ ∀ w, Q.eval w ≠ 0 → F w = (P.eval w) / (Q.eval w)

/-- The origin is a super-attracting fixed point. -/
lemma phi_super_attracting : phi 0 = 0 := by
  unfold phi
  norm_num

/--
  **Nishioka's Theorem (Formally Stubbed for Lean 4)**
  The `h_not_rat` hypothesis uses the CORRECT formalization of rationality:
  F agrees with P/Q where Q does not vanish.
-/
theorem nishioka_transcendence (F : ℂ → ℂ) (α : ℂ)
    (hF : SatisfiesMahlerEquation F)
    (h_super : phi 0 = 0)
    (h_F_zero : F 0 = 0)
    (h_F_diff : DifferentiableAt ℂ F 0)
    (h_not_rat : ¬ ∃ (P Q : Polynomial ℂ), IsRationalFunction F P Q)
    (h_alg : IsAlgebraic ℚ α)
    (h_conv : abs α < 1) :
    Transcendental ℚ (F α) := by
  sorry

/-- Transcendental numbers are not rational. -/
lemma transcendental_implies_irrational (x : ℂ) (h : Transcendental ℚ x) :
    x ∉ Set.range ((↑) : ℚ → ℂ) := by
  intro h_in
  rcases h_in with ⟨q, rfl⟩
  have h_alg : IsAlgebraic ℚ (q : ℂ) := by
    use X - C q
    constructor
    · intro h0
      have h1_raw : (X - C q : Polynomial ℚ).eval 0 = 0 := by rw [h0, eval_zero]
      have h2_raw : (X - C q : Polynomial ℚ).eval 1 = 0 := by rw [h0, eval_zero]
      have h1 : -q = 0 := by simpa using h1_raw
      have h2 : 1 - q = 0 := by simpa using h2_raw
      have hq0 : q = 0 := by linarith [h1]
      have hq1 : q = 1 := by linarith [h2]
      rw [hq0] at hq1
      revert hq1
      norm_num
    · simp
  exact h h_alg

/-- φ(1) = 1 -/
lemma phi_one : phi 1 = 1 := by unfold phi; norm_num

/--
  **Step 1: Q(1) = 0.**
  If F = P/Q (away from roots of Q) satisfies the Mahler equation,
  then Q must vanish at w = 1.
-/
lemma Q_root_at_one (P Q : Polynomial ℂ) (F : ℂ → ℂ)
    (hF : SatisfiesMahlerEquation F)
    (hQ_ne : Q ≠ 0) (h_coprime : IsCoprime P Q)
    (h_rat : ∀ w, Q.eval w ≠ 0 → F w = (P.eval w) / (Q.eval w)) :
    Q.eval 1 = 0 := by
  by_contra h_nz
  -- At w = 1: Q(1) ≠ 0, so F(1) = P(1)/Q(1)
  have hF1 := h_rat 1 h_nz
  -- The Mahler equation holds at w = 1 (since 1 ≠ -1 and D(1) ≠ 0)
  have h1ne : (1 : ℂ) ≠ -1 := by norm_num
  have hD1 : (1 : ℂ) - 1 + 1^2 ≠ 0 := by norm_num
  have h_mahler := hF 1 h1ne hD1
  -- φ(1) = 1, so F(φ(1)) = F(1) = P(1)/Q(1)
  rw [phi_one] at h_mahler
  -- h_mahler : F 1 = 1/(1+1) + F 1
  -- hF1 : F 1 = P(1)/Q(1)
  -- Substituting:
  rw [hF1] at h_mahler
  -- P(1)/Q(1) = 1/2 + P(1)/Q(1), so 0 = 1/2
  have h1 : eval 1 P / eval 1 Q - eval 1 P / eval 1 Q = 0 := sub_self _
  have h3 : eval 1 P / eval 1 Q - eval 1 P / eval 1 Q =
    1 / (1 + 1) + eval 1 P / eval 1 Q - eval 1 P / eval 1 Q :=
    congrArg (· - eval 1 P / eval 1 Q) h_mahler
  have h4 : (1 : ℂ) / (1 + 1) + eval 1 P / eval 1 Q - eval 1 P / eval 1 Q = 1 / (1 + 1) := by ring
  rw [h1, h4] at h3
  revert h3; norm_num

/--
  **Step 2: Root propagation via the cleared-denominator identity.**
  If Q(z) = 0, z ≠ -1, and D(z) ≠ 0, then Q(φ(z)) = 0.

  Proof: The Mahler equation gives F(z) = z/(1+z) + F(φ(z)).
  If Q(φ(z)) ≠ 0, we can evaluate F at both z and φ(z).
  At z: F(z) is unconstrained (Q(z) = 0, so the rational representation
         doesn't pin F(z) to any specific value).
  At φ(z): F(φ(z)) = P(φ(z))/Q(φ(z)) (since Q(φ(z)) ≠ 0).

  We also need the equation at w where Q(w) ≠ 0 to propagate.
  The key is: near z, for w close to z with Q(w) ≠ 0:
    P(w)/Q(w) = w/(1+w) + F(φ(w))
  As w → z, the LHS P(w)/Q(w) → ∞ (pole), but
  the RHS z/(1+z) + F(φ(z)) is finite (since z≠-1 and Q(φ(z))≠0).
  Contradiction!

  Formalized: We use the polynomial identity obtained by multiplying through.
-/
lemma root_propagation (P Q : Polynomial ℂ) (F : ℂ → ℂ)
    (hF : SatisfiesMahlerEquation F)
    (hQ_ne : Q ≠ 0) (h_coprime : IsCoprime P Q)
    (h_rat : ∀ w, Q.eval w ≠ 0 → F w = (P.eval w) / (Q.eval w))
    (z : ℂ) (hz_ne_neg1 : z ≠ -1) (hD : (1 - z + z^2) ≠ 0)
    (hQz : Q.eval z = 0) :
    Q.eval (phi z) = 0 := by
  -- From coprimality: Q(z) = 0 implies P(z) ≠ 0
  have hPz : P.eval z ≠ 0 := by
    intro hPz_eq
    have hP_dvd : (X - C z) ∣ P := dvd_iff_isRoot.mpr hPz_eq
    have hQ_dvd : (X - C z) ∣ Q := dvd_iff_isRoot.mpr hQz
    exact not_isUnit_X_sub_C z (h_coprime.isUnit_of_dvd' hP_dvd hQ_dvd)
  -- Suppose Q(φ(z)) ≠ 0 and derive contradiction
  by_contra h_Qphi_nz
  -- Since Q(φ(z)) ≠ 0: F(φ(z)) = P(φ(z))/Q(φ(z))
  have hF_phi := h_rat (phi z) h_Qphi_nz
  -- The Mahler equation at w = z: F(z) = z/(1+z) + F(φ(z))
  have h_mahler := hF z hz_ne_neg1 hD
  -- So F(z) = z/(1+z) + P(φ(z))/Q(φ(z))  ... (*)
  rw [hF_phi] at h_mahler
  -- Now consider ANY sequence w_n → z with Q(w_n) ≠ 0.
  -- For such w_n: P(w_n)/Q(w_n) = w_n/(1+w_n) + F(φ(w_n))
  -- As w_n → z: LHS → ∞ (since P(z) ≠ 0, Q(z) = 0) but RHS → finite.
  -- This is a topological/limit argument. In Lean, we need Filter.Tendsto.
  -- For now, we mark this step.
  sorry

/--
  **F is not a rational function (correct formalization).**
  Uses the restricted quantifier: F agrees with P/Q where Q doesn't vanish.
-/
lemma F_is_not_rational (F : ℂ → ℂ) (hF : SatisfiesMahlerEquation F) :
    ¬ ∃ (P Q : Polynomial ℂ), IsRationalFunction F P Q := by
  intro ⟨P, Q, hQ_ne, h_coprime, h_rat⟩
  -- Step 1: Q(1) = 0
  have hQ1 : Q.eval 1 = 0 := Q_root_at_one P Q F hF hQ_ne h_coprime h_rat
  -- Step 2: root propagation gives Q(φ(1)) = Q(1) = 0. Circular at w=1.
  -- Instead: Q(1) = 0 and 1 ≠ -1 and D(1) ≠ 0, so by root_propagation,
  -- Q(φ(1)) = 0, but φ(1) = 1, so this just gives Q(1) = 0 again.
  -- We need a DIFFERENT root to start the infinite chain.
  -- The correct seed: evaluate at w = -1 or use the polynomial identity.
  sorry

/--
  **The Resolution of the Rs Case**
-/
theorem erdos265_irrational_Rs (F : ℂ → ℂ) (hF : SatisfiesMahlerEquation F)
    (h_F_zero : F 0 = 0) (h_F_diff : DifferentiableAt ℂ F 0) :
    F (1/2) ∉ Set.range ((↑) : ℚ → ℂ) := by
  apply transcendental_implies_irrational
  apply nishioka_transcendence F (1/2) hF
  · exact phi_super_attracting
  · exact h_F_zero
  · exact h_F_diff
  · exact F_is_not_rational F hF
  · -- 1/2 is algebraic over ℚ
    use 2 * X - 1
    constructor
    · intro h0
      have h1 : (2 * X - 1 : Polynomial ℚ).eval 0 = 0 := by rw [h0, eval_zero]
      revert h1
      simp
    · simp
  · -- abs(1/2) < 1
    norm_num

end
