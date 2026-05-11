import Mathlib

open Complex Real

lemma inv_disk_bound (θ : ℝ) :
  let z : ℂ := (1/2 : ℝ) * (Real.cos θ + Real.sin θ * I)
  normSq (1 - z + z^2) = (Real.cos θ)^2 - (5/4) * Real.cos θ + 13/16 := by
  intro z
  have h_z : z = ⟨(1/2) * Real.cos θ, (1/2) * Real.sin θ⟩ := by
    ext
    · simp [z]
    · simp [z]
  
  have h_sin_sq : (Real.sin θ)^2 = 1 - (Real.cos θ)^2 := by
    have h := Real.sin_sq_add_cos_sq θ
    linarith
  sorry
