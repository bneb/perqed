import Mathlib

lemma nat_decreasing_eventually_constant (f : ℕ → ℕ) (hf : ∀ n, f (n + 1) ≤ f n) :
    ∃ N₀, ∀ n ≥ N₀, f (n + 1) = f n := by
  have H : ∃ M, ∃ N₀, ∀ n ≥ N₀, f n = M := by
    let S := { m | ∃ n, f n = m }
    have hS_ne : S.Nonempty := ⟨f 0, 0, rfl⟩
    let M := sInf S
    have hM : M ∈ S := Nat.sInf_mem hS_ne
    rcases hM with ⟨N₀, hN₀⟩
    use M, N₀
    intro n hn
    have h_le : f n ≤ f N₀ := by
      induction' hn with k hk ih
      · rfl
      · exact le_trans (hf k) ih
    have h_M_le : M ≤ f n := Nat.sInf_le ⟨n, rfl⟩
    linarith
  rcases H with ⟨M, N₀, hN₀⟩
  use N₀
  intro n hn
  have hn1 : n + 1 ≥ N₀ := by omega
  rw [hN₀ n hn, hN₀ (n + 1) hn1]
