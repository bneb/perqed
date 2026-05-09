import Mathlib
import «kt_combinatorics»
import «kt_proof_d2»

open Filter Topology

variable (x : ℝ × ℝ)

lemma p_k_bound (k : ℕ) 
    (hx : |x.1| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 2) ∧ 
          |x.2| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 3)) : 
  |(construct_n x k).1.1| ≤ Real.sqrt (seq_N k) / (2 * (seq_N k) ^ 2) ∧
  |(construct_n x k).1.2| ≤ Real.sqrt (seq_N k) / (2 * (seq_N k) ^ 3) := by
  induction k with
  | zero => exact hx
  | succ k ih =>
    unfold construct_n
    dsimp only
    split_ifs with h
    · have h_exists := one_step_composition (seq_N k) (seq_N (k + 1)) (seq_N_bound0 k) (seq_N_bound1 k) (seq_N_bound2 k) (construct_n x k).1.1 (construct_n x k).1.2 h.1 h.2
      have h_spec := Classical.choose_spec (Classical.choose_spec h_exists)
      exact ⟨h_spec.2.2.1, h_spec.2.2.2⟩
    · have h0 : (0 : ℝ) ≤ Real.sqrt (seq_N (k + 1)) / (2 * (seq_N (k + 1)) ^ 2) := by positivity
      have h1 : (0 : ℝ) ≤ Real.sqrt (seq_N (k + 1)) / (2 * (seq_N (k + 1)) ^ 3) := by positivity
      exact ⟨by dsimp; linarith, by dsimp; linarith⟩

-- We use sorry for the Tendsto parts locally just to verify the HasSum architecture,
-- then I will implement them.
lemma residual_decay1 : Tendsto (fun k => (construct_n x k).1.1) atTop (𝓝 0) := sorry
lemma residual_decay2 : Tendsto (fun k => (construct_n x k).1.2) atTop (𝓝 0) := sorry

noncomputable def C_total_partial (m : ℕ) : ℝ × ℝ :=
  (∑ k ∈ Finset.range m, (f₁ (seq_N k) + f₁ (2 * seq_N k)),
   ∑ k ∈ Finset.range m, (f₂ (seq_N k) + f₂ (2 * seq_N k)))

lemma C_total_tendsto1 : Tendsto (fun m => (C_total_partial m).1) atTop (𝓝 C_total.1) := sorry
lemma C_total_tendsto2 : Tendsto (fun m => (C_total_partial m).2) atTop (𝓝 C_total.2) := sorry

lemma even_partial_sums1 (m : ℕ) :
  ∑ j ∈ Finset.range (2 * m), f₁ (construct_a x j) = x.1 - (construct_n x m).1.1 + (C_total_partial m).1 := sorry

lemma even_partial_sums2 (m : ℕ) :
  ∑ j ∈ Finset.range (2 * m), f₂ (construct_a x j) = x.2 - (construct_n x m).1.2 + (C_total_partial m).2 := sorry

lemma f_decay1 : Tendsto (fun k => f₁ (construct_a x k)) atTop (𝓝 0) := sorry
lemma f_decay2 : Tendsto (fun k => f₂ (construct_a x k)) atTop (𝓝 0) := sorry

lemma tendsto_even_sums1 :
  Tendsto (fun m => ∑ j ∈ Finset.range (2 * m), f₁ (construct_a x j)) atTop (𝓝 (x.1 + C_total.1)) := by
  have h1 : Tendsto (fun m => x.1 - (construct_n x m).1.1 + (C_total_partial m).1) atTop (𝓝 (x.1 - 0 + C_total.1)) :=
    Tendsto.add (Tendsto.sub tendsto_const_nhds (residual_decay1 x)) (C_total_tendsto1)
  have heq : x.1 - 0 + C_total.1 = x.1 + C_total.1 := by ring
  rw [heq] at h1
  exact h1.congr (fun m => (even_partial_sums1 x m).symm)

lemma tendsto_even_sums2 :
  Tendsto (fun m => ∑ j ∈ Finset.range (2 * m), f₂ (construct_a x j)) atTop (𝓝 (x.2 + C_total.2)) := by
  have h1 : Tendsto (fun m => x.2 - (construct_n x m).1.2 + (C_total_partial m).2) atTop (𝓝 (x.2 - 0 + C_total.2)) :=
    Tendsto.add (Tendsto.sub tendsto_const_nhds (residual_decay2 x)) (C_total_tendsto2)
  have heq : x.2 - 0 + C_total.2 = x.2 + C_total.2 := by ring
  rw [heq] at h1
  exact h1.congr (fun m => (even_partial_sums2 x m).symm)

lemma tendsto_all_sums1 : Tendsto (fun m => ∑ j ∈ Finset.range m, f₁ (construct_a x j)) atTop (𝓝 (x.1 + C_total.1)) := sorry
lemma tendsto_all_sums2 : Tendsto (fun m => ∑ j ∈ Finset.range m, f₂ (construct_a x j)) atTop (𝓝 (x.2 + C_total.2)) := sorry

lemma f_pos1 (k : ℕ) : 0 ≤ f₁ (construct_a x k) := by
  have h2 : construct_a x k ≥ 2 := construct_a_ge_2 x k
  unfold f₁
  positivity

lemma f_pos2 (k : ℕ) : 0 ≤ f₂ (construct_a x k) := by
  have h2 : construct_a x k ≥ 2 := construct_a_ge_2 x k
  unfold f₂
  positivity

lemma construct_a_has_sum_test (hx : |x.1| < Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 2) ∧ 
          |x.2| < Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 3)) : 
  HasSum (fun k => (f₁ (construct_a x k), f₂ (construct_a x k))) (x.1 + C_total.1, x.2 + C_total.2) := by
  have h1 : HasSum (fun k => f₁ (construct_a x k)) (x.1 + C_total.1) :=
    (hasSum_iff_tendsto_nat_of_nonneg (f_pos1 x) _).mpr (tendsto_all_sums1 x)
  have h2 : HasSum (fun k => f₂ (construct_a x k)) (x.2 + C_total.2) :=
    (hasSum_iff_tendsto_nat_of_nonneg (f_pos2 x) _).mpr (tendsto_all_sums2 x)
  exact h1.prodMk h2
