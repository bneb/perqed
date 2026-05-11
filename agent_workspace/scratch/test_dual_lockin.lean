import Mathlib

theorem dual_lockin_contradiction (a : ℕ → ℕ) (N : ℕ)
    (h1 : ∀ n ≥ N, a (n + 1) + a n = a n * a n + 1)
    (h2 : ∀ n ≥ N, a (n + 1) + 3 * a n = a n * a n + 4) :
    False := by
  have h1N := h1 N (le_refl N)
  have h2N := h2 N (le_refl N)
  
  have h1Z : (a (N + 1) : ℤ) + (a N : ℤ) = (a N : ℤ) * (a N : ℤ) + 1 := by exact_mod_cast h1N
  have h2Z : (a (N + 1) : ℤ) + 3 * (a N : ℤ) = (a N : ℤ) * (a N : ℤ) + 4 := by exact_mod_cast h2N
  
  have h_sub : ((a (N + 1) : ℤ) + 3 * (a N : ℤ)) - ((a (N + 1) : ℤ) + (a N : ℤ)) = 
               ((a N : ℤ) * (a N : ℤ) + 4) - ((a N : ℤ) * (a N : ℤ) + 1) := by
    rw [h1Z, h2Z]
    
  have h_simp_lhs : ((a (N + 1) : ℤ) + 3 * (a N : ℤ)) - ((a (N + 1) : ℤ) + (a N : ℤ)) = 2 * (a N : ℤ) := by ring
  have h_simp_rhs : ((a N : ℤ) * (a N : ℤ) + 4) - ((a N : ℤ) * (a N : ℤ) + 1) = 3 := by ring
  
  rw [h_simp_lhs, h_simp_rhs] at h_sub
  
  -- We have 2 * a N = 3
  have h_mod : (2 * (a N : ℤ)) % 2 = 3 % 2 := by rw [h_sub]
  have h_even : (2 * (a N : ℤ)) % 2 = 0 := by exact Int.mul_emod_right 2 ↑(a N)
  rw [h_even] at h_mod
  revert h_mod
  norm_num
