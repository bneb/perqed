import Mathlib

open Complex Polynomial

noncomputable section

def phi (w : ℂ) : ℂ := w^2 / (1 - w + w^2)

def SatisfiesMahlerIdentity (P Q : Polynomial ℂ) : Prop :=
  ∀ w : ℂ, w * Q.eval w * Q.eval (phi w) = (1 + w) * (P.eval w * Q.eval (phi w) - P.eval (phi w) * Q.eval w)

/-- Evaluating the identity at w = -1 yields Q(-1) = 0 or Q(1/3) = 0. -/
lemma base_pole (P Q : Polynomial ℂ) (h : SatisfiesMahlerIdentity P Q) :
    Q.eval (-1) = 0 ∨ Q.eval (1 / 3) = 0 := by
  have h1 := h (-1)
  have h_phi : phi (-1) = 1 / 3 := by
    unfold phi; norm_num
  rw [h_phi] at h1
  have h_rhs : (1 + (-1 : ℂ)) = 0 := by norm_num
  have h2 : (-1 : ℂ) * Q.eval (-1) * Q.eval (1 / 3) = 0 := by
    calc (-1 : ℂ) * Q.eval (-1) * Q.eval (1 / 3)
      _ = (1 + -1) * (P.eval (-1) * Q.eval (1 / 3) - P.eval (1 / 3) * Q.eval (-1)) := h1
      _ = 0 * (P.eval (-1) * Q.eval (1 / 3) - P.eval (1 / 3) * Q.eval (-1)) := by rw [h_rhs]
      _ = 0 := zero_mul _
  cases mul_eq_zero.mp h2 with
  | inl h3 =>
      cases mul_eq_zero.mp h3 with
      | inl h4 => norm_num at h4
      | inr h4 => exact Or.inl h4
  | inr h3 => exact Or.inr h3

/-- Forward propagation: If Q(a) = 0 and a ≠ -1, then Q(φ(a)) = 0. -/
lemma forward_propagation (P Q : Polynomial ℂ) (hCoprime : IsCoprime P Q) (h : SatisfiesMahlerIdentity P Q)
    (a : ℂ) (ha_ne : a ≠ -1) (hQa : Q.eval a = 0) :
    Q.eval (phi a) = 0 := by
  have h1 := h a
  have h_lhs : a * Q.eval a * Q.eval (phi a) = 0 := by rw [hQa, mul_zero, zero_mul]
  have h_rhs : (1 + a) * (P.eval a * Q.eval (phi a) - P.eval (phi a) * Q.eval a) = (1 + a) * P.eval a * Q.eval (phi a) := by
    calc (1 + a) * (P.eval a * Q.eval (phi a) - P.eval (phi a) * Q.eval a)
      _ = (1 + a) * (P.eval a * Q.eval (phi a) - P.eval (phi a) * 0) := by rw [hQa]
      _ = (1 + a) * (P.eval a * Q.eval (phi a) - 0) := by rw [mul_zero]
      _ = (1 + a) * P.eval a * Q.eval (phi a) := by ring
  rw [h_lhs, h_rhs] at h1
  have h2 : (1 + a) * P.eval a * Q.eval (phi a) = 0 := h1.symm
  cases mul_eq_zero.mp h2 with
  | inl h3 =>
      cases mul_eq_zero.mp h3 with
      | inl h4 =>
          exfalso
          rw [add_comm] at h4
          have h5 : a = -1 := add_eq_zero_iff_eq_neg.mp h4
          exact ha_ne h5
      | inr hPa =>
          exfalso
          have h_dvd_P : (X - C a) ∣ P := dvd_iff_isRoot.mpr hPa
          have h_dvd_Q : (X - C a) ∣ Q := dvd_iff_isRoot.mpr hQa
          exact not_isUnit_X_sub_C a (hCoprime.isUnit_of_dvd' h_dvd_P h_dvd_Q)
  | inr hQphi => exact hQphi

/-- Backward propagation: If Q(b) = 0 and b ≠ 1/3, then any preimage a satisfies Q(a) = 0. -/
lemma backward_propagation (P Q : Polynomial ℂ) (hCoprime : IsCoprime P Q) (h : SatisfiesMahlerIdentity P Q)
    (b : ℂ) (hb_ne : b ≠ 1/3) (hQb : Q.eval b = 0) (a : ℂ) (ha : phi a = b) :
    Q.eval a = 0 := by
  have h1 := h a
  have h_lhs : a * Q.eval a * Q.eval (phi a) = 0 := by rw [ha, hQb, mul_zero]
  have h_rhs : (1 + a) * (P.eval a * Q.eval (phi a) - P.eval (phi a) * Q.eval a) = -(1 + a) * P.eval b * Q.eval a := by
    calc (1 + a) * (P.eval a * Q.eval (phi a) - P.eval (phi a) * Q.eval a)
      _ = (1 + a) * (P.eval a * Q.eval b - P.eval b * Q.eval a) := by rw [ha]
      _ = (1 + a) * (P.eval a * 0 - P.eval b * Q.eval a) := by rw [hQb]
      _ = (1 + a) * (0 - P.eval b * Q.eval a) := by rw [mul_zero]
      _ = -(1 + a) * P.eval b * Q.eval a := by ring
  rw [h_lhs, h_rhs] at h1
  have h2 : -(1 + a) * P.eval b * Q.eval a = 0 := h1.symm
  cases mul_eq_zero.mp h2 with
  | inl h3 =>
      cases mul_eq_zero.mp h3 with
      | inl h4 =>
          exfalso
          have h5 : 1 + a = 0 := neg_eq_zero.mp h4
          rw [add_comm] at h5
          have ha_neg1 : a = -1 := add_eq_zero_iff_eq_neg.mp h5
          have h_phi_neg1 : phi (-1) = 1/3 := by norm_num [phi]
          rw [ha_neg1] at ha
          rw [h_phi_neg1] at ha
          exact hb_ne ha.symm
      | inr hPb =>
          exfalso
          have h_dvd_P : (X - C b) ∣ P := dvd_iff_isRoot.mpr hPb
          have h_dvd_Q : (X - C b) ∣ Q := dvd_iff_isRoot.mpr hQb
          exact not_isUnit_X_sub_C b (hCoprime.isUnit_of_dvd' h_dvd_P h_dvd_Q)
  | inr hQa => exact hQa

end
