import Mathlib
import «verified_growth»
import «kt_combinatorics»
import «kt_proof_d2»

open Filter Topology Metric Set Finset

/-!
# Erdős Problem #265: The Topological Measure Theory Resolution
Final Capstone Theorem. 
The core functional, algebraic, and analytic components are 100% verified.
The combinatorial synthesis is mapped modulo the Kovač-Tao Interior Axiom.
-/
-- ============================================================================
-- Phase 2 Convergence Sub-Lemmas
-- ============================================================================

lemma p_k_bound (x : ℝ × ℝ) (k : ℕ) 
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
    · exact False.elim (h ih)



noncomputable def C_total_partial (m : ℕ) : ℝ × ℝ :=
  (∑ k ∈ Finset.range m, (f₁ (seq_N k) + f₁ (2 * seq_N k)),
   ∑ k ∈ Finset.range m, (f₂ (seq_N k) + f₂ (2 * seq_N k)))

-- Helper: geometric bound for 1/seq_N
private lemma seq_N_inv_le_geom (k : ℕ) : 1 / seq_N k ≤ (1 / (3 * 10^13 : ℝ)) * (1 / 3) ^ k := by
  induction k with
  | zero =>
    simp only [pow_zero, mul_one]
    have hN0 : seq_N 0 ≥ 3 * 10^13 := seq_N_bound0 0
    have h3_pos : (3 * 10^13 : ℝ) > 0 := by positivity
    exact div_le_div_of_nonneg_left one_pos.le h3_pos hN0
  | succ k ih =>
    have h3 : seq_N (k + 1) ≥ 3 * seq_N k := seq_N_bound3 k
    have h3Nk_pos : 3 * seq_N k > 0 := by have := seq_N_bound0 k; positivity
    calc 1 / seq_N (k + 1) 
        ≤ 1 / (3 * seq_N k) := by
          exact div_le_div_of_nonneg_left one_pos.le h3Nk_pos h3
      _ = (1 / 3) * (1 / seq_N k) := by ring
      _ ≤ (1 / 3) * ((1 / (3 * 10^13 : ℝ)) * (1 / 3) ^ k) := by gcongr
      _ = (1 / (3 * 10^13 : ℝ)) * (1 / 3) ^ (k + 1) := by ring

private lemma seq_N_inv_summable : Summable (fun k => 1 / seq_N k) := by
  apply Summable.of_nonneg_of_le
  · intro k; have : seq_N k > 0 := by have := seq_N_bound0 k; linarith
    exact div_nonneg one_pos.le (le_of_lt this)
  · exact seq_N_inv_le_geom
  · exact (summable_geometric_of_lt_one (by positivity) (by norm_num)).mul_left _

private lemma seq_N_summable_f1 : Summable (fun k => f₁ (seq_N k) + f₁ (2 * seq_N k)) := by
  have hg : Summable (fun k => 2 * (1 / seq_N k)) := seq_N_inv_summable.mul_left 2
  apply hg.of_norm_bounded
  intro k
  have hN : seq_N k > 0 := by have := seq_N_bound0 k; linarith
  have heq : f₁ (seq_N k) + f₁ (2 * seq_N k) = 3 / (2 * seq_N k) := by
    unfold f₁; field_simp; ring
  rw [heq, Real.norm_eq_abs, abs_of_pos (by positivity), mul_one_div]
  rw [div_le_div_iff₀ (by positivity : 2 * seq_N k > 0) hN]
  nlinarith

private lemma seq_N_summable_f2 : Summable (fun k => f₂ (seq_N k) + f₂ (2 * seq_N k)) := by
  have h_nn : ∀ k, 0 ≤ f₂ (seq_N k) + f₂ (2 * seq_N k) := by
    intro k; have hN : seq_N k > 0 := by have := seq_N_bound0 k; linarith
    unfold f₂; apply add_nonneg <;> positivity
  have h_le : ∀ k, f₂ (seq_N k) + f₂ (2 * seq_N k) ≤ 2 / seq_N k := by
    intro k
    have hN : seq_N k > 0 := by have := seq_N_bound0 k; linarith
    have h1 : f₂ (seq_N k) ≤ 1 / seq_N k := by
      unfold f₂; rw [div_le_div_iff₀ (by positivity) hN]; nlinarith
    have h2 : f₂ (2 * seq_N k) ≤ 1 / seq_N k := by
      unfold f₂; rw [div_le_div_iff₀ (by positivity) hN]; nlinarith
    have : 1 / seq_N k + 1 / seq_N k = 2 / seq_N k := by ring
    linarith
  have h_summ : Summable (fun k => 2 / seq_N k) := by
    have : (fun k => 2 / seq_N k) = (fun k => 2 * (1 / seq_N k)) := by ext k; ring
    rw [this]; exact seq_N_inv_summable.mul_left 2
  exact Summable.of_nonneg_of_le h_nn h_le h_summ

lemma C_total_tendsto1 : Tendsto (fun m => (C_total_partial m).1) atTop (𝓝 C_total.1) := by
  change Tendsto (fun m => ∑ k ∈ Finset.range m, (f₁ (seq_N k) + f₁ (2 * seq_N k))) atTop 
    (𝓝 (∑' k, (f₁ (seq_N k) + f₁ (2 * seq_N k))))
  exact seq_N_summable_f1.hasSum.tendsto_sum_nat

lemma C_total_tendsto2 : Tendsto (fun m => (C_total_partial m).2) atTop (𝓝 C_total.2) := by
  change Tendsto (fun m => ∑ k ∈ Finset.range m, (f₂ (seq_N k) + f₂ (2 * seq_N k))) atTop 
    (𝓝 (∑' k, (f₂ (seq_N k) + f₂ (2 * seq_N k))))
  exact seq_N_summable_f2.hasSum.tendsto_sum_nat

lemma residual_decay1 (x : ℝ × ℝ)
    (hx : |x.1| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 2) ∧ 
          |x.2| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 3)) : Tendsto (fun k => (construct_n x k).1.1) atTop (𝓝 0) := by
  apply squeeze_zero_norm
  · intro k; exact (p_k_bound x k hx).1
  · apply squeeze_zero
    · intro k; have := seq_N_bound0 k; positivity
    · intro k
      have hN : seq_N k > 0 := by have := seq_N_bound0 k; linarith
      have hsq : Real.sqrt (seq_N k) ≤ seq_N k := by
        rw [Real.sqrt_le_iff]
        refine ⟨le_of_lt hN, ?_⟩
        have := seq_N_bound0 k; nlinarith
      have hd : 2 * (seq_N k) ^ 2 > 0 := by positivity
      rw [div_le_iff₀ hd]
      have hRHS : (1 / seq_N k) * (2 * (seq_N k) ^ 2) = 2 * seq_N k := by
        have hN_ne : seq_N k ≠ 0 := by linarith
        field_simp
      rw [hRHS]
      calc Real.sqrt (seq_N k) ≤ seq_N k := hsq
        _ ≤ 2 * seq_N k := by linarith
    · exact Summable.tendsto_atTop_zero seq_N_inv_summable

lemma residual_decay2 (x : ℝ × ℝ)
    (hx : |x.1| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 2) ∧ 
          |x.2| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 3)) : Tendsto (fun k => (construct_n x k).1.2) atTop (𝓝 0) := by
  apply squeeze_zero_norm
  · intro k; exact (p_k_bound x k hx).2
  · apply squeeze_zero
    · intro k; have := seq_N_bound0 k; positivity
    · intro k
      have hN : seq_N k > 0 := by have := seq_N_bound0 k; linarith
      have hsq : Real.sqrt (seq_N k) ≤ seq_N k := by
        rw [Real.sqrt_le_iff]
        refine ⟨le_of_lt hN, ?_⟩
        have := seq_N_bound0 k; nlinarith
      have hd : 2 * (seq_N k) ^ 3 > 0 := by positivity
      rw [div_le_iff₀ hd]
      have hRHS : (1 / seq_N k) * (2 * (seq_N k) ^ 3) = 2 * (seq_N k) ^ 2 := by
        have hN_ne : seq_N k ≠ 0 := by linarith
        field_simp
      rw [hRHS]
      calc Real.sqrt (seq_N k) ≤ seq_N k := hsq
        _ ≤ 2 * (seq_N k) ^ 2 := by
          have := seq_N_bound0 k
          nlinarith
    · exact Summable.tendsto_atTop_zero seq_N_inv_summable

lemma seq_N_is_nat (k : ℕ) : seq_N k = ↑((10 : ℕ) ^ E_seq k) := by
  unfold seq_N; push_cast; rfl

lemma nat_floor_of_nonneg_int (n : ℤ) (h : n ≥ 0) : 
    ⌊(↑n : ℝ)⌋₊ = n.toNat := by
  have h_nat : (n.toNat : ℤ) = n := Int.toNat_of_nonneg h
  have h_real : (↑n : ℝ) = ↑(n.toNat) := by 
    rw [show (↑n : ℝ) = (↑(n : ℤ) : ℝ) from rfl]
    rw [show (↑(n.toNat) : ℝ) = (↑(n.toNat : ℤ) : ℝ) from by push_cast; rfl]
    congr 1
    exact h_nat.symm
  rw [h_real, Nat.floor_natCast]

lemma f1_floor_eq (N_nat : ℕ) (n : ℤ) (h : (N_nat : ℤ) + n ≥ 0) :
    f₁ (↑(⌊(↑N_nat : ℝ) + (↑n : ℝ)⌋₊) : ℝ) = f₁ ((↑N_nat : ℝ) + (↑n : ℝ)) := by
  congr 1
  have h_eq : (↑N_nat : ℝ) + (↑n : ℝ) = ↑((N_nat : ℤ) + n) := by push_cast; ring
  rw [h_eq, nat_floor_of_nonneg_int _ h]
  have hnn : (((N_nat : ℤ) + n).toNat : ℤ) = (N_nat : ℤ) + n := Int.toNat_of_nonneg h
  exact_mod_cast hnn

lemma f2_floor_eq (N_nat : ℕ) (n : ℤ) (h : (N_nat : ℤ) + n ≥ 0) :
    f₂ (↑(⌊(↑N_nat : ℝ) + (↑n : ℝ)⌋₊) : ℝ) = f₂ ((↑N_nat : ℝ) + (↑n : ℝ)) := by
  congr 1
  have h_eq : (↑N_nat : ℝ) + (↑n : ℝ) = ↑((N_nat : ℤ) + n) := by push_cast; ring
  rw [h_eq, nat_floor_of_nonneg_int _ h]
  have hnn : (((N_nat : ℤ) + n).toNat : ℤ) = (N_nat : ℤ) + n := Int.toNat_of_nonneg h
  exact_mod_cast hnn

lemma int_nonneg_of_nat_floor_ge_2 (Z : ℤ) (h : 2 ≤ ⌊(Z : ℝ)⌋₊) : Z ≥ 0 := by
  by_contra h_neg
  push_neg at h_neg
  have h1 : (Z : ℝ) < 0 := by exact_mod_cast h_neg
  have h2 : ⌊(Z : ℝ)⌋₊ = 0 := Nat.floor_of_nonpos (le_of_lt h1)
  omega

lemma sum_range_two_mul_succ {α : Type*} [AddCommMonoid α] (f : ℕ → α) (m : ℕ) :
  ∑ j ∈ Finset.range (2 * (m + 1)), f j = ∑ j ∈ Finset.range (2 * m), f j + f (2 * m) + f (2 * m + 1) := by
  have h_eq : 2 * (m + 1) = 2 * m + 2 := by ring
  rw [h_eq, Finset.sum_range_succ, Finset.sum_range_succ]

lemma even_partial_sums1 (x : ℝ × ℝ) (m : ℕ)
    (hx : |x.1| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 2) ∧ 
          |x.2| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 3)) :
  ∑ j ∈ Finset.range (2 * m), f₁ (construct_a x j) = x.1 - (construct_n x m).1.1 + (C_total_partial m).1 := by
  induction' m with m ih
  · unfold construct_n C_total_partial
    simp
  · rw [sum_range_two_mul_succ]
    rw [ih]
    -- we know h is true by p_k_bound
    have hb := p_k_bound x m hx
    have h : |(construct_n x m).1.1| ≤ √(seq_N m) / (2 * seq_N m ^ 2) ∧ |(construct_n x m).1.2| ≤ √(seq_N m) / (2 * seq_N m ^ 3) := hb
    
    unfold C_total_partial
    simp only [sum_range_succ]
    
    have h_div1 : (2 * m) / 2 = m := by omega
    have h_div2 : (2 * m + 1) / 2 = m := by omega
    
    have h_a_2m : construct_a x (2 * m) = ⌊seq_N m + (construct_n x (m + 1)).2.1⌋₊ := by
      unfold construct_a; simp [h_div1, Nat.even_mul]
    have h_a_2m1 : construct_a x (2 * m + 1) = ⌊2 * seq_N m + (construct_n x (m + 1)).2.2⌋₊ := by
      unfold construct_a; simp [h_div2]
    
    rw [h_a_2m, h_a_2m1]
      
    have h1 : f₁ ↑⌊seq_N m + ↑(construct_n x (m + 1)).2.1⌋₊ = f₁ (seq_N m + ↑(construct_n x (m + 1)).2.1) := by
      have hN_nat : seq_N m = ↑((10:ℕ)^E_seq m) := seq_N_is_nat m
      have h_ge : 2 ≤ ⌊seq_N m + ↑(construct_n x (m + 1)).2.1⌋₊ := by
        rw [← h_a_2m]
        exact construct_a_ge_2 x (2 * m)
      rw [hN_nat] at h_ge ⊢
      have h_ge_cast : 2 ≤ ⌊( (((10:ℕ)^E_seq m : ℤ) + (construct_n x (m + 1)).2.1 : ℤ) : ℝ)⌋₊ := by
        exact_mod_cast h_ge
      exact f1_floor_eq ((10:ℕ)^E_seq m) (construct_n x (m + 1)).2.1 (int_nonneg_of_nat_floor_ge_2 _ h_ge_cast)
    
    have h2 : f₁ ↑⌊2 * seq_N m + ↑(construct_n x (m + 1)).2.2⌋₊ = f₁ (2 * seq_N m + ↑(construct_n x (m + 1)).2.2) := by
      have hN_nat : seq_N m = ↑((10:ℕ)^E_seq m) := seq_N_is_nat m
      have hN_nat2 : 2 * seq_N m = ↑(2 * (10:ℕ)^E_seq m) := by rw [hN_nat]; push_cast; ring
      have h_ge : 2 ≤ ⌊2 * seq_N m + ↑(construct_n x (m + 1)).2.2⌋₊ := by
        rw [← h_a_2m1]
        exact construct_a_ge_2 x (2 * m + 1)
      rw [hN_nat2] at h_ge ⊢
      have h_ge_cast : 2 ≤ ⌊( (((2 * (10:ℕ)^E_seq m) : ℤ) + (construct_n x (m + 1)).2.2 : ℤ) : ℝ)⌋₊ := by
        exact_mod_cast h_ge
      exact f1_floor_eq (2 * (10:ℕ)^E_seq m) (construct_n x (m + 1)).2.2 (int_nonneg_of_nat_floor_ge_2 _ h_ge_cast)
    
    rw [h1, h2]
    
    rw [construct_n]
    rw [dif_pos h]
    dsimp only
    ring

lemma even_partial_sums2 (x : ℝ × ℝ) (m : ℕ)
    (hx : |x.1| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 2) ∧ 
          |x.2| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 3)) :
  ∑ j ∈ Finset.range (2 * m), f₂ (construct_a x j) = x.2 - (construct_n x m).1.2 + (C_total_partial m).2 := by
  induction' m with m ih
  · unfold construct_n C_total_partial
    simp
  · rw [sum_range_two_mul_succ]
    rw [ih]
    have hb := p_k_bound x m hx
    have h : |(construct_n x m).1.1| ≤ √(seq_N m) / (2 * seq_N m ^ 2) ∧ |(construct_n x m).1.2| ≤ √(seq_N m) / (2 * seq_N m ^ 3) := hb
    
    unfold C_total_partial
    simp only [sum_range_succ]
    
    have h_div1 : (2 * m) / 2 = m := by omega
    have h_div2 : (2 * m + 1) / 2 = m := by omega
    
    have h_a_2m : construct_a x (2 * m) = ⌊seq_N m + (construct_n x (m + 1)).2.1⌋₊ := by
      unfold construct_a; simp [h_div1, Nat.even_mul]
    have h_a_2m1 : construct_a x (2 * m + 1) = ⌊2 * seq_N m + (construct_n x (m + 1)).2.2⌋₊ := by
      unfold construct_a; simp [h_div2]
    
    rw [h_a_2m, h_a_2m1]
      
    have h1 : f₂ ↑⌊seq_N m + ↑(construct_n x (m + 1)).2.1⌋₊ = f₂ (seq_N m + ↑(construct_n x (m + 1)).2.1) := by
      have hN_nat : seq_N m = ↑((10:ℕ)^E_seq m) := seq_N_is_nat m
      have h_ge : 2 ≤ ⌊seq_N m + ↑(construct_n x (m + 1)).2.1⌋₊ := by
        rw [← h_a_2m]
        exact construct_a_ge_2 x (2 * m)
      rw [hN_nat] at h_ge ⊢
      have h_ge_cast : 2 ≤ ⌊( (((10:ℕ)^E_seq m : ℤ) + (construct_n x (m + 1)).2.1 : ℤ) : ℝ)⌋₊ := by
        exact_mod_cast h_ge
      exact f2_floor_eq ((10:ℕ)^E_seq m) (construct_n x (m + 1)).2.1 (int_nonneg_of_nat_floor_ge_2 _ h_ge_cast)
    
    have h2 : f₂ ↑⌊2 * seq_N m + ↑(construct_n x (m + 1)).2.2⌋₊ = f₂ (2 * seq_N m + ↑(construct_n x (m + 1)).2.2) := by
      have hN_nat : seq_N m = ↑((10:ℕ)^E_seq m) := seq_N_is_nat m
      have hN_nat2 : 2 * seq_N m = ↑(2 * (10:ℕ)^E_seq m) := by rw [hN_nat]; push_cast; ring
      have h_ge : 2 ≤ ⌊2 * seq_N m + ↑(construct_n x (m + 1)).2.2⌋₊ := by
        rw [← h_a_2m1]
        exact construct_a_ge_2 x (2 * m + 1)
      rw [hN_nat2] at h_ge ⊢
      have h_ge_cast : 2 ≤ ⌊( (((2 * (10:ℕ)^E_seq m) : ℤ) + (construct_n x (m + 1)).2.2 : ℤ) : ℝ)⌋₊ := by
        exact_mod_cast h_ge
      exact f2_floor_eq (2 * (10:ℕ)^E_seq m) (construct_n x (m + 1)).2.2 (int_nonneg_of_nat_floor_ge_2 _ h_ge_cast)
    
    rw [h1, h2]
    
    rw [construct_n]
    rw [dif_pos h]
    dsimp only
    ring

lemma tendsto_even_sums1 (x : ℝ × ℝ)
    (hx : |x.1| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 2) ∧ 
          |x.2| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 3)) :
  Tendsto (fun m => ∑ j ∈ Finset.range (2 * m), f₁ (construct_a x j)) atTop (𝓝 (x.1 + C_total.1)) := by
  have h1 : Tendsto (fun m => x.1 - (construct_n x m).1.1 + (C_total_partial m).1) atTop (𝓝 (x.1 - 0 + C_total.1)) :=
    Tendsto.add (Tendsto.sub tendsto_const_nhds (residual_decay1 x hx)) (C_total_tendsto1)
  have heq : x.1 - 0 + C_total.1 = x.1 + C_total.1 := by ring
  rw [heq] at h1
  exact h1.congr (fun m => (even_partial_sums1 x m hx).symm)

lemma tendsto_even_sums2 (x : ℝ × ℝ)
    (hx : |x.1| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 2) ∧ 
          |x.2| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 3)) :
  Tendsto (fun m => ∑ j ∈ Finset.range (2 * m), f₂ (construct_a x j)) atTop (𝓝 (x.2 + C_total.2)) := by
  have h1 : Tendsto (fun m => x.2 - (construct_n x m).1.2 + (C_total_partial m).2) atTop (𝓝 (x.2 - 0 + C_total.2)) :=
    Tendsto.add (Tendsto.sub tendsto_const_nhds (residual_decay2 x hx)) (C_total_tendsto2)
  have heq : x.2 - 0 + C_total.2 = x.2 + C_total.2 := by ring
  rw [heq] at h1
  exact h1.congr (fun m => (even_partial_sums2 x m hx).symm)

lemma tendsto_all_sums1 (x : ℝ × ℝ)
    (hx : |x.1| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 2) ∧ 
          |x.2| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 3)) : Tendsto (fun m => ∑ j ∈ Finset.range m, f₁ (construct_a x j)) atTop (𝓝 (x.1 + C_total.1)) := by
  have h_even := tendsto_even_sums1 x hx
  have h_even_succ : Tendsto (fun m => ∑ j ∈ Finset.range (2 * (m + 1)), f₁ (construct_a x j)) atTop (𝓝 (x.1 + C_total.1)) := by
    have h1 : (fun m => ∑ j ∈ Finset.range (2 * (m + 1)), f₁ (construct_a x j)) = (fun m => ∑ j ∈ Finset.range (2 * m), f₁ (construct_a x j)) ∘ (fun m => m + 1) := rfl
    rw [h1]
    exact h_even.comp (tendsto_add_atTop_nat 1)
  apply tendsto_of_tendsto_of_tendsto_of_le_of_le'
  · have hf : Tendsto (fun n : ℕ => n / 2) atTop atTop := tendsto_atTop_atTop.mpr (fun b => ⟨2 * b, fun a ha => by omega⟩)
    exact h_even.comp hf
  · have hf : Tendsto (fun n : ℕ => n / 2) atTop atTop := tendsto_atTop_atTop.mpr (fun b => ⟨2 * b, fun a ha => by omega⟩)
    exact h_even_succ.comp hf
  · filter_upwards [] with n
    have h_sub : Finset.range (2 * (n / 2)) ⊆ Finset.range n := by intro i hi; rw [Finset.mem_range] at *; omega
    exact sum_le_sum_of_subset_of_nonneg h_sub (fun i _ _ => f_pos1 x i)
  · filter_upwards [] with n
    have h_sub : Finset.range n ⊆ Finset.range (2 * (n / 2 + 1)) := by intro i hi; rw [Finset.mem_range] at *; omega
    exact sum_le_sum_of_subset_of_nonneg h_sub (fun i _ _ => f_pos1 x i)
lemma tendsto_all_sums2 (x : ℝ × ℝ)
    (hx : |x.1| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 2) ∧ 
          |x.2| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 3)) : Tendsto (fun m => ∑ j ∈ Finset.range m, f₂ (construct_a x j)) atTop (𝓝 (x.2 + C_total.2)) := by
  have h_even := tendsto_even_sums2 x hx
  have h_even_succ : Tendsto (fun m => ∑ j ∈ Finset.range (2 * (m + 1)), f₂ (construct_a x j)) atTop (𝓝 (x.2 + C_total.2)) := by
    have h1 : (fun m => ∑ j ∈ Finset.range (2 * (m + 1)), f₂ (construct_a x j)) = (fun m => ∑ j ∈ Finset.range (2 * m), f₂ (construct_a x j)) ∘ (fun m => m + 1) := rfl
    rw [h1]
    exact h_even.comp (tendsto_add_atTop_nat 1)
  apply tendsto_of_tendsto_of_tendsto_of_le_of_le'
  · have hf : Tendsto (fun n : ℕ => n / 2) atTop atTop := tendsto_atTop_atTop.mpr (fun b => ⟨2 * b, fun a ha => by omega⟩)
    exact h_even.comp hf
  · have hf : Tendsto (fun n : ℕ => n / 2) atTop atTop := tendsto_atTop_atTop.mpr (fun b => ⟨2 * b, fun a ha => by omega⟩)
    exact h_even_succ.comp hf
  · filter_upwards [] with n
    have h_sub : Finset.range (2 * (n / 2)) ⊆ Finset.range n := by intro i hi; rw [Finset.mem_range] at *; omega
    exact sum_le_sum_of_subset_of_nonneg h_sub (fun i _ _ => f_pos2 x i)
  · filter_upwards [] with n
    have h_sub : Finset.range n ⊆ Finset.range (2 * (n / 2 + 1)) := by intro i hi; rw [Finset.mem_range] at *; omega
    exact sum_le_sum_of_subset_of_nonneg h_sub (fun i _ _ => f_pos2 x i)

lemma construct_a_has_sum (x : ℝ × ℝ) 
    (hx : |x.1| < Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 2) ∧ 
          |x.2| < Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 3)) : 
  HasSum (fun k => (f₁ (construct_a x k), f₂ (construct_a x k))) (x.1 + C_total.1, x.2 + C_total.2) := by
  have hx_le : |x.1| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 2) ∧ |x.2| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 3) := 
    ⟨le_of_lt hx.1, le_of_lt hx.2⟩
  have h1 : HasSum (fun k => f₁ (construct_a x k)) (x.1 + C_total.1) :=
    (hasSum_iff_tendsto_nat_of_nonneg (f_pos1 x) _).mpr (tendsto_all_sums1 x hx_le)
  have h2 : HasSum (fun k => f₂ (construct_a x k)) (x.2 + C_total.2) :=
    (hasSum_iff_tendsto_nat_of_nonneg (f_pos2 x) _).mpr (tendsto_all_sums2 x hx_le)
  exact h1.prodMk h2

-- ============================================================================
-- The full theorem
-- ============================================================================

lemma sumset_has_interior :
    ∃ (U : Set (ℝ × ℝ)), IsOpen U ∧ U.Nonempty ∧ 
    ∀ x ∈ U, ∃ (a : ℕ → ℕ), StrictMono a ∧ (∀ k, a k ≥ 2) ∧
      (∃ β : ℝ, β > 1 ∧ Tendsto (fun k => (a k : ℝ) ^ ((1 : ℝ) / β ^ k)) atTop atTop) ∧
      HasSum (fun k => (f₁ (a k), f₂ (a k))) x := by
  let U : Set (ℝ × ℝ) := {x | |x.1 - C_total.1| < Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 2) ∧ 
                              |x.2 - C_total.2| < Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 3)}
  use U
  refine ⟨?_, ?_, ?_⟩
  · have h1 : IsOpen {x : ℝ × ℝ | |x.1 - C_total.1| < Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 2)} :=
      isOpen_lt (Continuous.comp continuous_abs (Continuous.sub continuous_fst continuous_const)) continuous_const
    have h2 : IsOpen {x : ℝ × ℝ | |x.2 - C_total.2| < Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 3)} :=
      isOpen_lt (Continuous.comp continuous_abs (Continuous.sub continuous_snd continuous_const)) continuous_const
    exact IsOpen.inter h1 h2
  · use C_total
    change |C_total.1 - C_total.1| < _ ∧ |C_total.2 - C_total.2| < _
    rw [sub_self, sub_self, abs_zero]
    have hN : seq_N 0 > 0 := by
      have : seq_N 0 ≥ 3 * 10^13 := seq_N_bound0 0
      linarith
    have h_r1 : Real.sqrt (seq_N 0) / (2 * seq_N 0 ^ 2) > 0 := by positivity
    have h_r2 : Real.sqrt (seq_N 0) / (2 * seq_N 0 ^ 3) > 0 := by positivity
    exact ⟨h_r1, h_r2⟩
  · intro x hx
    let x' := (x.1 - C_total.1, x.2 - C_total.2)
    use construct_a x'
    refine ⟨construct_a_strict_mono x', construct_a_ge_2 x', construct_a_growth x', ?_⟩
    have h_sum := construct_a_has_sum x' hx
    have h_eq1 : x'.1 + C_total.1 = x.1 := by
      dsimp [x']; ring
    have h_eq2 : x'.2 + C_total.2 = x.2 := by
      dsimp [x']; ring
    have h_eq : (x'.1 + C_total.1, x'.2 + C_total.2) = x := Prod.ext h_eq1 h_eq2
    rwa [h_eq] at h_sum

-- ============================================================================
-- [G] FINAL THEOREM (Corollary 2.9 for d=2)
-- Difficulty: 🟡 Medium (density of ℚ² in ℝ² + partial fractions)
-- Strategy: 
--   1. [F] gives an open set U ⊂ ℝ² where each point is realized by a sequence.
--   2. ℚ × ℚ is dense in ℝ × ℝ, so U contains a point (q₁, q₂) ∈ ℚ².
--   3. F gives sequence (aₖ) with Σ 1/aₖ = q₁, Σ 1/(aₖ(aₖ+1)) = q₂.
--   4. Partial fractions: 1/(n(n+1)) = 1/n - 1/(n+1).
--      So Σ 1/(aₖ+1) = Σ 1/aₖ - Σ 1/(aₖ(aₖ+1)) = q₁ - q₂ ∈ ℚ.
--   5. Set bₖ = aₖ + 1. Then:
--      - Σ 1/bₖ = Σ 1/(aₖ+1) = q₁ - q₂ ∈ ℚ
--      - Σ 1/(bₖ-1) = Σ 1/aₖ = q₁ ∈ ℚ
--      - bₖ ≥ 3, StrictMono, same growth rate.
-- ============================================================================

-- Helper lemmas for rational density
lemma rat_prod_dense (U : Set (ℝ × ℝ)) (hU : IsOpen U) (hU_nonempty : U.Nonempty) :
    ∃ (q₁ q₂ : ℚ), ((q₁ : ℝ), (q₂ : ℝ)) ∈ U := by
  obtain ⟨⟨x₁, x₂⟩, hx⟩ := hU_nonempty
  rw [isOpen_prod_iff] at hU
  obtain ⟨u₁, u₂, hu₁, hu₂, hx₁, hx₂, hsub⟩ := hU x₁ x₂ hx
  have hd : DenseRange (fun q : ℚ => (q : ℝ)) := Rat.denseRange_cast
  obtain ⟨q₁, hq₁⟩ := hd.exists_mem_open hu₁ ⟨x₁, hx₁⟩
  obtain ⟨q₂, hq₂⟩ := hd.exists_mem_open hu₂ ⟨x₂, hx₂⟩
  exact ⟨q₁, q₂, hsub (Set.mk_mem_prod hq₁ hq₂)⟩

-- Helper lemmas for HasSum projection
lemma hasSum_fst {f : ℕ → ℝ × ℝ} {x : ℝ × ℝ} (h : HasSum f x) : HasSum (fun n => (f n).1) x.1 :=
  h.map (ContinuousLinearMap.fst ℝ ℝ ℝ) (ContinuousLinearMap.fst ℝ ℝ ℝ).continuous

lemma hasSum_snd {f : ℕ → ℝ × ℝ} {x : ℝ × ℝ} (h : HasSum f x) : HasSum (fun n => (f n).2) x.2 :=
  h.map (ContinuousLinearMap.snd ℝ ℝ ℝ) (ContinuousLinearMap.snd ℝ ℝ ℝ).continuous

-- Helper lemma for sum decomposition
lemma has_sum_shift (a : ℕ → ℕ) (ha_pos : ∀ k, a k ≥ 2) (q₁ q₂ : ℝ) 
    (h₁ : HasSum (fun k => 1 / (a k : ℝ)) q₁)
    (h₂ : HasSum (fun k => 1 / ((a k : ℝ) * ((a k : ℝ) + 1))) q₂) :
    HasSum (fun k => 1 / ((a k : ℝ) + 1)) (q₁ - q₂) := by
  have h_sub := h₁.sub h₂
  suffices h_eq : (fun k => 1 / (a k : ℝ) - 1 / ((a k : ℝ) * ((a k : ℝ) + 1))) = 
                  (fun k => 1 / ((a k : ℝ) + 1)) by
    rwa [h_eq] at h_sub
  ext k
  have hak : (a k : ℝ) > 0 := by
    have := ha_pos k; exact_mod_cast Nat.pos_of_ne_zero (by omega)
  have ha : (a k : ℝ) ≠ 0 := ne_of_gt hak
  have ha1 : (a k : ℝ) + 1 > 0 := by linarith
  field_simp
  ring

lemma tendsto_shift (a : ℕ → ℕ) (β : ℝ) (hβ : β > 0)
    (h_tendsto : Tendsto (fun k => (a k : ℝ) ^ ((1 : ℝ) / β ^ k)) atTop atTop) : 
    Tendsto (fun k => ((a k : ℝ) + 1) ^ ((1 : ℝ) / β ^ k)) atTop atTop := by
  apply Filter.tendsto_atTop_mono _ h_tendsto
  intro k
  apply Real.rpow_le_rpow (Nat.cast_nonneg _) (by linarith) (by positivity)

/--
Erdős Problem #265 (Formal Specification — Kovač-Tao Theorem 2.8/2.9):
There exist β > 1 and a strictly increasing sequence of integers aₖ ≥ 2
growing at least double-exponentially (i.e., aₖ^{1/βᵏ} → ∞),
such that both ∑ 1/aₖ and ∑ 1/(aₖ - 1) converge to rational numbers.
-/
theorem erdos_265 : ∃ (β : ℝ) (a : ℕ → ℕ),
    β > 1 ∧ (∀ k, a k ≥ 2) ∧ StrictMono a ∧
    Tendsto (fun k => (a k : ℝ) ^ ((1 : ℝ) / β ^ k)) atTop atTop ∧
    (∃ q₁ : ℚ, HasSum (fun k => (1 : ℝ) / (a k : ℝ)) ↑q₁) ∧
    (∃ q₂ : ℚ, HasSum (fun k => (1 : ℝ) / ((a k : ℝ) - 1)) ↑q₂) := by
  rcases sumset_has_interior with ⟨U, hU_open, hU_nonempty, hU_prop⟩
  have ⟨q₁, q₂, hq⟩ := rat_prod_dense U hU_open hU_nonempty
  rcases hU_prop (↑q₁, ↑q₂) hq with ⟨a, h_mono, h_ge2, h_growth, h_sum⟩
  have h_sum1 : HasSum (fun k => f₁ (a k)) ↑q₁ := hasSum_fst h_sum
  have h_sum2 : HasSum (fun k => f₂ (a k)) ↑q₂ := hasSum_snd h_sum
  -- The actual sequence is b(k) = a(k) + 1, so 1/b(k) and 1/(b(k)-1) are rational
  rcases h_growth with ⟨β, hβ, h_tendsto⟩
  use β, fun k => a k + 1
  refine ⟨hβ, ?_, ?_, ?_, ?_, ?_⟩
  · -- ≥ 2
    intro k; linarith [h_ge2 k]
  · -- StrictMono
    intro x y hxy; exact Nat.add_lt_add_right (h_mono hxy) 1
  · -- Double exponential growth: (a(k)+1)^{1/β^k} → ∞
    convert tendsto_shift a β (by linarith) h_tendsto using 1
    ext k
    push_cast
    rfl
  · -- ∑ 1/(a(k)+1) is rational (= q₁ - q₂, by partial fractions)
    use q₁ - q₂
    push_cast
    exact has_sum_shift a h_ge2 ↑q₁ ↑q₂ h_sum1 h_sum2
  · -- ∑ 1/((a(k)+1) - 1) = ∑ 1/a(k) is rational (= q₁)
    use q₁
    push_cast
    have h_eq : (fun k => 1 / ((a k : ℝ) + 1 - 1)) = fun k => 1 / (a k : ℝ) := by
      ext k; congr 1; ring
    rw [h_eq]
    exact h_sum1


