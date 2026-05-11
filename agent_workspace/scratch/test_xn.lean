import Mathlib

open Filter Topology

noncomputable section

lemma nonpos_of_tendsto_zero_and_nonincr (X : ℕ → ℝ) (h_tendsto : Tendsto X atTop (𝓝 0))
    (h_nonincr : ∀ n, X (n + 1) ≤ X n) :
    ∀ n, 0 ≤ X n := by
  have h_antitone : Antitone X := antitone_nat_of_succ_le h_nonincr
  intro n
  have h_eventually_le : ∀ᶠ m in atTop, X m ≤ X n := 
    eventually_atTop.mpr ⟨n, fun m hm => h_antitone hm⟩
  exact @ge_of_tendsto ℕ ℝ _ _ X atTop 0 (X n) h_tendsto h_eventually_le

lemma tail_sum_eq (seq : ℕ → ℝ) (hSummable : Summable seq) :
    ∀ n, ∑' k, seq (n + k) - ∑' k, seq (n + 1 + k) = seq n := by
  intro n
  have hSummable_shift : Summable (fun k => seq (n + k)) := Summable.comp_add_right hSummable n -- Wait, is it `Summable.comp_add_right`? `summable_nat_add`? No, maybe just `Summable` on shifted.
  -- Let's just use `tsum_eq_add_tsum_nat_add` or similar. Let's try `tsum_eq_zero_add`.
  have h1 : ∑' k, seq (n + k) = seq (n + 0) + ∑' k, seq (n + (k + 1)) := tsum_eq_zero_add (Summable.hasSum hSummable) -- oops, no.
  sorry

end
