import Mathlib
import «kt_proof_d2»
import «affirmative_proof_core»

open Filter Topology Metric Set Finset

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

lemma int_nonneg_of_nat_floor_ge_2 (Z : ℤ) (h : 2 ≤ ⌊(Z : ℝ)⌋₊) : Z ≥ 0 := by
  by_contra h_neg
  push_neg at h_neg
  have h1 : (Z : ℝ) < 0 := by exact_mod_cast h_neg
  have h2 : ⌊(Z : ℝ)⌋₊ = 0 := Nat.floor_of_nonpos (le_of_lt h1)
  omega

lemma sum_range_two_mul_succ {α : Type*} [AddCommMonoid α] (f : ℕ → α) (m : ℕ) :
  ∑ j ∈ Finset.range (2 * (m + 1)), f j = ∑ j ∈ Finset.range (2 * m), f j + f (2 * m) + f (2 * m + 1) := by
  have h_eq : 2 * (m + 1) = 2 * m + 2 := by ring
  rw [h_eq, sum_range_succ, sum_range_succ]

lemma even_partial_sums1_proof (x : ℝ × ℝ) (m : ℕ)
    (hx : |x.1| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 2) ∧ 
          |x.2| ≤ Real.sqrt (seq_N 0) / (2 * (seq_N 0) ^ 3)) :
  ∑ j ∈ Finset.range (2 * m), f₁ (construct_a x j) = x.1 - (construct_n x m).1.1 + (C_total_partial m).1 := by
  induction' m with m ih
  · simp only [Nat.mul_zero, Finset.range_zero, Finset.sum_empty, Nat.zero_eq]
    unfold construct_n C_total_partial
    simp
  · rw [sum_range_two_mul_succ]
    rw [ih]
    -- we know h is true by p_k_bound
    have hb := p_k_bound x m hx
    have h : |(construct_n x m).1.1| ≤ √(seq_N m) / (2 * seq_N m ^ 2) ∧ |(construct_n x m).1.2| ≤ √(seq_N m) / (2 * seq_N m ^ 3) := hb
    
    unfold C_total_partial
    rw [sum_range_succ]
    
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
    -- Now the goal is full of tuples, but they are identical on both sides!
    -- We just need to reduce the tuple projections!
    dsimp only
    ring
