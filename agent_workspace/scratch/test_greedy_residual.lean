import Mathlib

open Filter Topology BigOperators

noncomputable section

lemma nonpos_of_tendsto_zero_and_nonincr (X : ℕ → ℝ) (h_tendsto : Tendsto X atTop (𝓝 0))
    (h_nonincr : ∀ n, X (n + 1) ≤ X n) :
    ∀ n, 0 ≤ X n := by
  have h_antitone : Antitone X := antitone_nat_of_succ_le h_nonincr
  intro n
  have h_eventually_le : ∀ᶠ m in atTop, X m ≤ X n := 
    eventually_atTop.mpr ⟨n, fun m hm => h_antitone hm⟩
  exact @ge_of_tendsto ℕ ℝ _ _ X atTop 0 (X n) h_tendsto h_eventually_le

lemma greedy_tail_sum_bound (seq : ℕ → ℝ) 
    (hGe2 : ∀ k, seq k ≥ 2)
    (hGreedy : ∀ k, seq (k + 1) ≥ seq k * seq k - seq k + 1)
    (hSummable : Summable seq) :
    ∀ n, ∑' k, seq (n + k) ≤ 1 / (seq n - 1) := by
  sorry

end
