import Mathlib

open Filter Topology Finset

def IsEventuallySylvester (a : ℕ → ℕ) : Prop :=
  ∃ N, ∀ n ≥ N, a (n + 1) = a n ^ 2 - a n + 1

lemma hx_step_lem (a : ℕ → ℕ) (h_sylv : IsEventuallySylvester a) (h_pos : ∀ n, a n ≥ 2) :
  let x := fun n => a n - 1
  ∃ N, ∀ n ≥ N, x (n + 1) = x n ^ 2 + x n := by
  intro x
  obtain ⟨N, hN⟩ := h_sylv
  use N
  intro n hn
  have h_rec := hN n hn
  have hp : a n ≥ 2 := h_pos n
  have hp1 : a (n + 1) ≥ 2 := h_pos (n + 1)
  have h_z : (x (n + 1) : ℤ) = (x n : ℤ) ^ 2 + (x n : ℤ) := by
    dsimp [x]
    have hs1 : (a (n + 1) - 1 : ℤ) = (a (n + 1) : ℤ) - 1 := by rw [Nat.cast_sub (by linarith)]; rfl
    have hs2 : (a n - 1 : ℤ) = (a n : ℤ) - 1 := by rw [Nat.cast_sub (by linarith)]; rfl
    have hs3 : (a n ^ 2 - a n + 1 : ℤ) = (a n : ℤ) ^ 2 - (a n : ℤ) + 1 := by
      rw [Nat.cast_add, Nat.cast_sub (by nlinarith)]
      push_cast; rfl
    zify at h_rec hp hp1
    rw [hs1, hs2, h_rec, hs3]
    ring
  exact_mod_cast h_z
