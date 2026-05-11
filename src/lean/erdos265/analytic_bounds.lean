import Mathlib

open Complex Real

noncomputable section

/-- The rational substitution mapping the inverted Sylvester sequence -/
def phi (w : ℂ) : ℂ :=
  w^2 / (1 - w + w^2)

/-- The polynomial representing the squared modulus of the denominator of phi. -/
def phi_denom_norm_sq (x : ℝ) : ℝ :=
  x^2 - (5/4) * x + 13/16

/-- The minimum of the squared modulus on the real interval [-1, 1] is exactly 27/64. -/
lemma phi_denom_norm_sq_min (x : ℝ) :
    phi_denom_norm_sq x ≥ 27/64 := by
  have h_eq : x^2 - (5/4) * x + 13/16 = (x - 5/8)^2 + 27/64 := by ring
  unfold phi_denom_norm_sq
  rw [h_eq]
  have h_sq : 0 ≤ (x - 5/8)^2 := sq_nonneg (x - 5/8)
  linarith

/-- The norm of phi(z) is strictly bounded by 2*sqrt(3)/9 for any z with |z| = 1/2. -/
lemma phi_invariant_disk_boundary (θ : ℝ) :
    let z : ℂ := (1/2 : ℝ) * (Real.cos θ + Real.sin θ * I)
    normSq (phi z) ≤ 4/27 := by
  sorry

end
