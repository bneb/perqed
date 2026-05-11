import Mathlib

open Complex Real

lemma inv_disk_denom (c s : ℝ) (h : s^2 + c^2 = 1) :
  let z : ℂ := ⟨(1/2) * c, (1/2) * s⟩
  normSq (1 - z + z^2) = c^2 - (5/4) * c + 13/16 := by
  intro z
  have hz_re : z.re = (1/2) * c := rfl
  have hz_im : z.im = (1/2) * s := rfl
  -- normSq (x + iy) = x^2 + y^2
  -- (1 - z + z^2) = (1 - z.re + z.re^2 - z.im^2) + i (-z.im + 2 z.re z.im)
  have h_re : (1 - z + z^2).re = 1 - (1/2) * c + (1/4) * c^2 - (1/4) * s^2 := by
    dsimp [z]
    ring
  have h_im : (1 - z + z^2).im = -(1/2) * s + 2 * ((1/2) * c) * ((1/2) * s) := by
    dsimp [z]
    ring
  have h_normSq : normSq (1 - z + z^2) = (1 - (1/2) * c + (1/4) * c^2 - (1/4) * s^2)^2 + (-(1/2) * s + 2 * ((1/2) * c) * ((1/2) * s))^2 := by
    dsimp [normSq]
    rw [h_re, h_im]
  rw [h_normSq]
  have hs2 : s^2 = 1 - c^2 := by linarith
  nlinarith
