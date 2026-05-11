import Mathlib

open Filter Topology BigOperators

noncomputable section

lemma greedy_tail_sum_bound (seq : ℕ → ℕ) (hGe2 : ∀ k, seq k ≥ 2)
    (hGreedy : ∀ k, seq (k + 1) ≥ seq k * seq k - seq k + 1)
    (hSummable : Summable (fun k => (1 : ℝ) / (seq k : ℝ))) :
    ∀ n, ∑' k, (1 : ℝ) / (seq (n + k) : ℝ) ≤ 1 / ((seq n : ℝ) - 1) := by
  intro n
  have h_bound : ∀ m, ∑ k ∈ Finset.range m, (1 : ℝ) / (seq (n + k) : ℝ) ≤ 
      1 / ((seq n : ℝ) - 1) - 1 / ((seq (n + m) : ℝ) - 1) := by
    intro m
    induction m with
    | zero => simp
    | succ m ih =>
      rw [Finset.sum_range_succ]
      -- ih : sum <= 1/(a_n - 1) - 1/(a_{n+m} - 1)
      -- We add 1/a_{n+m}
      have h1 : 1 / ((seq (n + m) : ℝ) - 1) - 1 / (seq (n + m) : ℝ) = 1 / ((seq (n + m) : ℝ) * ((seq (n + m) : ℝ) - 1)) := by
        have ha : (seq (n + m) : ℝ) ≥ 2 := by exact_mod_cast hGe2 (n + m)
        have ha1 : (seq (n + m) : ℝ) - 1 ≥ 1 := by linarith
        have ha_pos : (seq (n + m) : ℝ) > 0 := by linarith
        have ha1_pos : (seq (n + m) : ℝ) - 1 > 0 := by linarith
        have ha_ne_zero : (seq (n + m) : ℝ) ≠ 0 := by linarith
        have ha1_ne_zero : (seq (n + m) : ℝ) - 1 ≠ 0 := by linarith
        calc
          1 / ((seq (n + m) : ℝ) - 1) - 1 / (seq (n + m) : ℝ) =
            ((seq (n + m) : ℝ) - ((seq (n + m) : ℝ) - 1)) / ((seq (n + m) : ℝ) * ((seq (n + m) : ℝ) - 1)) := by
              rw [div_sub_div _ _ ha1_ne_zero ha_ne_zero]
              ring
          _ = 1 / ((seq (n + m) : ℝ) * ((seq (n + m) : ℝ) - 1)) := by ring
      have h2 : 1 / ((seq (n + m) : ℝ) * ((seq (n + m) : ℝ) - 1)) ≥ 1 / ((seq (n + m + 1) : ℝ) - 1) := by
        have ha_succ : seq (n + m + 1) ≥ seq (n + m) * seq (n + m) - seq (n + m) + 1 := hGreedy (n + m)
        have ha_succ_re : (seq (n + m + 1) : ℝ) ≥ (seq (n + m) : ℝ) * (seq (n + m) : ℝ) - (seq (n + m) : ℝ) + 1 := by exact_mod_cast ha_succ
        have h_denom : (seq (n + m + 1) : ℝ) - 1 ≥ (seq (n + m) : ℝ) * ((seq (n + m) : ℝ) - 1) := by
          calc (seq (n + m + 1) : ℝ) - 1 ≥ (seq (n + m) : ℝ) * (seq (n + m) : ℝ) - (seq (n + m) : ℝ) := by linarith
               _ = (seq (n + m) : ℝ) * ((seq (n + m) : ℝ) - 1) := by ring
        have ha : (seq (n + m) : ℝ) ≥ 2 := by exact_mod_cast hGe2 (n + m)
        have h_pos1 : (seq (n + m) : ℝ) * ((seq (n + m) : ℝ) - 1) > 0 := by nlinarith
        have h_pos2 : (seq (n + m + 1) : ℝ) - 1 > 0 := by nlinarith
        exact one_div_le_one_div_of_le h_pos1 h_denom
      have h3 : 1 / ((seq (n + m) : ℝ) - 1) - 1 / (seq (n + m) : ℝ) ≥ 1 / ((seq (n + m + 1) : ℝ) - 1) := by
        linarith
      have h4 : 1 / ((seq n : ℝ) - 1) - 1 / ((seq (n + m) : ℝ) - 1) + 1 / (seq (n + m) : ℝ) ≤
                1 / ((seq n : ℝ) - 1) - 1 / ((seq (n + m + 1) : ℝ) - 1) := by
        linarith
      exact le_trans (add_le_add_right ih (1 / (seq (n + m) : ℝ))) h4

  have h_tendsto_sum : Tendsto (fun m => ∑ k ∈ Finset.range m, (1 : ℝ) / (seq (n + k) : ℝ)) atTop (𝓝 (∑' k, (1 : ℝ) / (seq (n + k) : ℝ))) :=
    HasSum.tendsto_sum_nat (Summable.hasSum (Summable.comp_add_right hSummable n))

  have h_bound_limit : ∀ m, ∑ k ∈ Finset.range m, (1 : ℝ) / (seq (n + k) : ℝ) ≤ 1 / ((seq n : ℝ) - 1) := by
    intro m
    have h1 := h_bound m
    have ha : (seq (n + m) : ℝ) ≥ 2 := by exact_mod_cast hGe2 (n + m)
    have ha1 : (seq (n + m) : ℝ) - 1 > 0 := by linarith
    have h2 : 1 / ((seq (n + m) : ℝ) - 1) > 0 := one_div_pos.mpr ha1
    linarith
  exact ge_of_tendsto' h_tendsto_sum h_bound_limit

end
