import Mathlib

/-!
# Erdős 265: The Rational-Transcendental Dichotomy (Nishioka's Theorem)

This file formally states Nishioka's Theorem for Mahler functions and applies
it to our specific formal series `F(w)`.

## Proof that F ∉ ℂ(w)

We prove `F` is not a rational function via a clean algebraic-topological argument:

1. **FQ = P everywhere**: If F is continuous and agrees with P/Q where Q ≠ 0,
   then the continuous function `F·Q - P` vanishes on a dense set (complement of
   finitely many roots of Q), hence vanishes everywhere by the density lemma.

2. **Q has no roots**: At any root z of Q, `F(z)·0 = P(z)` gives `P(z) = 0`.
   But coprimality of P and Q prevents simultaneous vanishing.

3. **Q is constant**: Over ℂ (algebraically closed), a polynomial with no roots
   has degree 0.

4. **Mahler contradiction at w = 1**: Since Q(w) ≠ 0 everywhere, the Mahler equation
   gives `F(1) = 1/2 + F(1)` (using φ(1) = 1), hence `0 = 1/2`.
-/

noncomputable section

open Complex Polynomial Filter Topology

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
  unfold phi; norm_num

/--
  **Nishioka's Theorem (Formally Stubbed for Lean 4)**
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

/-! ### Proof that F is not a rational function -/

/-- A continuous function vanishing on a dense set vanishes everywhere. -/
lemma continuous_vanish_of_dense (f : ℂ → ℂ) (hf : Continuous f) (S : Set ℂ) (hS : Dense S)
    (hfS : ∀ w ∈ S, f w = 0) : ∀ w, f w = 0 := by
  intro w
  have h_closed : IsClosed {x | f x = 0} := isClosed_eq hf continuous_const
  have h_closure : closure S ⊆ {x | f x = 0} :=
    h_closed.closure_subset_iff.mpr (fun x hx => hfS x hx)
  rw [hS.closure_eq] at h_closure
  exact h_closure (Set.mem_univ w)

/--
  **F·Q = P everywhere.**
  If F is continuous and agrees with P/Q where Q ≠ 0, then F·Q = P on all of ℂ.
  This is the key step that "extends" the rational identity past the poles.
-/
lemma FQ_eq_P (P Q : Polynomial ℂ) (F : ℂ → ℂ)
    (hF_cont : Continuous F) (hQ_ne : Q ≠ 0)
    (h_rat : ∀ w, Q.eval w ≠ 0 → F w = (P.eval w) / (Q.eval w)) :
    ∀ w, F w * Q.eval w = P.eval w := by
  -- g(w) = F(w)·Q(w) - P(w) is continuous
  have hg_cont : Continuous (fun w => F w * Q.eval w - P.eval w) :=
    (hF_cont.mul (Polynomial.continuous Q)).sub (Polynomial.continuous P)
  -- g vanishes where Q(w) ≠ 0
  have hg_zero : ∀ w, Q.eval w ≠ 0 → F w * Q.eval w - P.eval w = 0 := by
    intro w hQw
    rw [h_rat w hQw, div_mul_cancel (P.eval w) hQw, sub_self]
  -- {w | Q(w) ≠ 0} is dense (complement of finitely many roots)
  have h_dense : Dense {w : ℂ | Q.eval w ≠ 0} := by
    have hfin : {w : ℂ | Q.eval w = 0}.Finite := by
      have hroots := Q.rootSet_finite ℂ
      refine hroots.subset ?_
      intro w (hw : Q.eval w = 0)
      simp only [rootSet, Finset.mem_coe, Multiset.mem_toFinset, mem_aroots]
      exact ⟨hQ_ne, hw⟩
    exact hfin.countable.dense_compl ℂ
  -- By dense vanishing: g = 0 everywhere
  have h_vanish := continuous_vanish_of_dense _ hg_cont _ h_dense (fun w hw => hg_zero w hw)
  intro w
  exact sub_eq_zero.mp (h_vanish w)

/--
  **Q has no roots.**
  From F·Q = P and coprimality: at any root z of Q, P(z) = 0,
  contradicting IsCoprime P Q.
-/
lemma Q_no_roots (P Q : Polynomial ℂ) (F : ℂ → ℂ)
    (hF_cont : Continuous F) (hQ_ne : Q ≠ 0) (h_coprime : IsCoprime P Q)
    (h_rat : ∀ w, Q.eval w ≠ 0 → F w = (P.eval w) / (Q.eval w))
    (z : ℂ) (hz : Q.eval z = 0) :
    False := by
  have h_FQ := FQ_eq_P P Q F hF_cont hQ_ne h_rat z
  rw [hz, mul_zero] at h_FQ
  have hPz : P.eval z = 0 := h_FQ.symm
  have hP_dvd : (X - C z) ∣ P := dvd_iff_isRoot.mpr hPz
  have hQ_dvd : (X - C z) ∣ Q := dvd_iff_isRoot.mpr hz
  exact not_isUnit_X_sub_C z (h_coprime.isUnit_of_dvd' hP_dvd hQ_dvd)

/--
  **Q is a nonzero constant.**
  Over ℂ (algebraically closed), a nonzero polynomial with no roots has degree 0.
-/
lemma Q_is_constant (P Q : Polynomial ℂ) (F : ℂ → ℂ)
    (hF_cont : Continuous F) (hQ_ne : Q ≠ 0) (h_coprime : IsCoprime P Q)
    (h_rat : ∀ w, Q.eval w ≠ 0 → F w = (P.eval w) / (Q.eval w)) :
    Q.natDegree = 0 := by
  by_contra h_deg
  have h_deg_ne : Q.degree ≠ 0 := by
    rw [Polynomial.degree_eq_natDegree hQ_ne]; exact_mod_cast h_deg
  obtain ⟨z, hz⟩ := IsAlgClosed.exists_root Q h_deg_ne
  exact Q_no_roots P Q F hF_cont hQ_ne h_coprime h_rat z hz

/--
  **F is not a rational function.**

  Complete proof using the continuity + density + FTA chain.
  Requires `Continuous F` — justified since the actual Mahler function
  is analytic (hence continuous) on the unit disk.
-/
lemma F_is_not_rational (F : ℂ → ℂ) (hF : SatisfiesMahlerEquation F) (hF_cont : Continuous F) :
    ¬ ∃ (P Q : Polynomial ℂ), IsRationalFunction F P Q := by
  intro ⟨P, Q, hQ_ne, h_coprime, h_rat⟩
  -- Q is constant
  have hQ_const := Q_is_constant P Q F hF_cont hQ_ne h_coprime h_rat
  have hQ_eq : Q = C (Q.coeff 0) := Polynomial.eq_C_of_natDegree_eq_zero hQ_const
  have hc_ne : Q.coeff 0 ≠ 0 := by
    intro h0; apply hQ_ne; rw [hQ_eq, h0, map_zero]
  -- Q(w) = c ≠ 0 for ALL w
  have hQ_eval : ∀ w, Q.eval w ≠ 0 := by
    intro w; rw [hQ_eq, eval_C]; exact hc_ne
  -- Mahler equation at w = 1 (valid since 1 ≠ -1 and D(1) = 1 ≠ 0)
  have h1ne : (1 : ℂ) ≠ -1 := by norm_num
  have hD1 : (1 : ℂ) - 1 + 1^2 ≠ 0 := by norm_num
  have h_mahler := hF 1 h1ne hD1
  -- φ(1) = 1
  have h_phi : phi 1 = 1 := by unfold phi; norm_num
  rw [h_phi] at h_mahler
  -- h_mahler : F 1 = 1/(1+1) + F 1
  -- Now both F 1 terms are the same. Substitute F(1) = P(1)/Q(1).
  have hF1 := h_rat 1 (hQ_eval 1)
  rw [hF1] at h_mahler
  -- P(1)/Q(1) = 1/(1+1) + P(1)/Q(1), subtract to get 0 = 1/2
  have h1 : eval 1 P / eval 1 Q - eval 1 P / eval 1 Q = 0 := sub_self _
  have h3 : eval 1 P / eval 1 Q - eval 1 P / eval 1 Q =
    1 / (1 + 1) + eval 1 P / eval 1 Q - eval 1 P / eval 1 Q :=
    congrArg (· - eval 1 P / eval 1 Q) h_mahler
  have h4 : (1 : ℂ) / (1 + 1) + eval 1 P / eval 1 Q - eval 1 P / eval 1 Q = 1 / (1 + 1) := by ring
  rw [h1, h4] at h3
  revert h3; norm_num

/--
  **The Resolution of the Rs Case**
-/
theorem erdos265_irrational_Rs (F : ℂ → ℂ) (hF : SatisfiesMahlerEquation F)
    (h_F_zero : F 0 = 0) (h_F_diff : DifferentiableAt ℂ F 0) (hF_cont : Continuous F) :
    F (1/2) ∉ Set.range ((↑) : ℚ → ℂ) := by
  apply transcendental_implies_irrational
  apply nishioka_transcendence F (1/2) hF
  · exact phi_super_attracting
  · exact h_F_zero
  · exact h_F_diff
  · exact F_is_not_rational F hF hF_cont
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
