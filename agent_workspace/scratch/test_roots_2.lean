import Mathlib

open Complex Polynomial

noncomputable section

def phi (w : ℂ) : ℂ := w^2 / (1 - w + w^2)

def SatisfiesMahlerIdentity (P Q : Polynomial ℂ) : Prop :=
  ∀ w : ℂ, w * Q.eval w * Q.eval (phi w) = (1 + w) * (P.eval w * Q.eval (phi w) - P.eval (phi w) * Q.eval w)

def SatisfiesMahlerEquation (F : ℂ → ℂ) : Prop :=
  ∀ w : ℂ, w ≠ -1 → (1 - w + w^2) ≠ 0 → F w = w / (1 + w) + F (phi w)

def IsRationalFunction (F : ℂ → ℂ) (P Q : Polynomial ℂ) : Prop :=
  Q ≠ 0 ∧ IsCoprime P Q ∧ ∀ w, Q.eval w ≠ 0 → F w = (P.eval w) / (Q.eval w)

lemma rational_implies_poly_identity (F : ℂ → ℂ) (P Q : Polynomial ℂ)
    (hF : SatisfiesMahlerEquation F) (hRat : IsRationalFunction F P Q) :
    SatisfiesMahlerIdentity P Q := by
  intro w
  by_cases h_w_neg1 : w = -1
  · subst h_w_neg1
    have h_phi : phi (-1) = 1/3 := by norm_num [phi]
    rw [h_phi]
    have h_zero : 1 + (-1 : ℂ) = 0 := by norm_num
    rw [h_zero, zero_mul]
    sorry -- Need to show LHS = 0. We know Q(-1) = 0 or something? No, we don't know Q(-1) = 0 yet!
    -- Wait. The identity w * Q(w) * Q(φ(w)) = (1+w)[...] holds EVERYWHERE because it's a polynomial identity.
    -- But we only know it holds where Q(w) ≠ 0 and Q(φ(w)) ≠ 0.
    -- Because P, Q are polynomials, if two polynomials agree on a dense set, they agree everywhere.
