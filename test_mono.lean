import Mathlib

lemma nat_decreasing_eventually_constant (f : ℕ → ℕ) (hf : ∀ n, f (n + 1) ≤ f n) :
    ∃ N₀, ∀ n ≥ N₀, f (n + 1) = f n := by
  have h_bound : ∃ M, ∀ n, M ≤ f n := ⟨0, fun _ => Nat.zero_le _⟩
  -- using exists_min or Inf
  sorry

