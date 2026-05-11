import Mathlib

lemma b_mod_four_step (b : ℤ) (h : b % 4 = 3) : (b * b - b + 1) % 4 = 3 := by
  have ⟨q, hq⟩ : ∃ q, b = 4 * q + 3 := by
    use b / 4
    omega
  calc
    (b * b - b + 1) % 4 = ((4 * q + 3) * (4 * q + 3) - (4 * q + 3) + 1) % 4 := by rw [hq]
    _ = (4 * (4 * q * q + 5 * q + 1) + 3) % 4 := by ring_nf
    _ = 3 := by
      rw [Int.add_mod]
      simp
