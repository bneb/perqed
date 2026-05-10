import Mathlib

open Filter Topology Finset

def IsEventuallySylvester (a : ℕ → ℕ) : Prop :=
  ∃ N, ∀ n ≥ N, a (n + 1) = a n ^ 2 - a n + 1

lemma hx_step (a : ℕ → ℕ) (h_sylv : IsEventuallySylvester a) (h_pos : ∀ n, a n ≥ 2) :
  let x := fun n => a n - 1
  ∃ N, ∀ n ≥ N, x (n + 1) = x n ^ 2 + x n := by
  intro x
  obtain ⟨N, hN⟩ := h_sylv
  use N
  intro n hn
  have h_rec := hN n hn
  dsimp [x]
  rw [h_rec]
  have h1 : a n ^ 2 ≥ a n := Nat.le_self_mul (a n) (a n)
  have h2 : a n ≥ 1 := by omega
  omega
