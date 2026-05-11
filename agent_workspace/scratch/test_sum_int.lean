import Mathlib

open scoped BigOperators

lemma sum_is_int {n : ℕ} {g : ℕ → ℚ} (h_int : ∀ k ∈ Finset.range n, ∃ (z : ℤ), g k = z) :
    ∃ (z : ℤ), Finset.sum (Finset.range n) g = z := by
  let f (k : ℕ) : ℤ := if hk : k ∈ Finset.range n then Classical.choose (h_int k hk) else 0
  have hf : ∀ k ∈ Finset.range n, g k = f k := by
    intro k hk
    dsimp [f]
    rw [dif_pos hk]
    exact Classical.choose_spec (h_int k hk)
  use Finset.sum (Finset.range n) f
  have h_sum : Finset.sum (Finset.range n) g = Finset.sum (Finset.range n) (fun k => (f k : ℚ)) := by
    apply Finset.sum_congr rfl
    intro x hx
    rw [hf x hx]
  rw [h_sum]
  push_cast
  rfl
