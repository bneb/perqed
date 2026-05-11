import Mathlib

open Complex Polynomial

noncomputable section

def phi (w : ℂ) : ℂ := w^2 / (1 - w + w^2)

def SatisfiesMahlerIdentity (P Q : Polynomial ℂ) : Prop :=
  ∀ w : ℂ, w ≠ -1 → (1 - w + w^2) ≠ 0 →
    w * Q.eval w * Q.eval (phi w) = (1 + w) * (P.eval w * Q.eval (phi w) - P.eval (phi w) * Q.eval w)

/-- Evaluating the identity at w = -1 yields Q(-1) = 0 or Q(1/3) = 0. -/
lemma base_pole (P Q : Polynomial ℂ) (h : SatisfiesMahlerIdentity P Q) :
    Q.eval (-1) = 0 ∨ Q.eval (1 / 3) = 0 := by
  sorry -- we need to evaluate at -1, but the identity requires w ≠ -1 !
