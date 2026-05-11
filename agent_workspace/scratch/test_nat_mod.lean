import Mathlib

lemma mod_test (b : ℕ) (h : b % 4 = 3) : (b * (b - 1) + 1) % 4 = 3 := by
  have ⟨q, hq⟩ : ∃ q, b = 4 * q + 3 := ⟨b / 4, by omega⟩
  rw [hq]
  have h2 : (4 * q + 3 - 1) = 4 * q + 2 := by omega
  rw [h2]
  have h3 : (4 * q + 3) * (4 * q + 2) + 1 = 4 * (4 * q * q + 5 * q + 1) + 3 := by ring
  rw [h3]
  omega
