import Mathlib
import erdos265.irrational_Rs

lemma lcm_le_mul (a b : ℕ) : Nat.lcm a b ≤ a * b := by
  have h : Nat.gcd a b * Nat.lcm a b = a * b := Nat.gcd_mul_lcm a b
  rcases Nat.eq_zero_or_pos a with rfl | ha
  · simp
  · have hg : 1 ≤ Nat.gcd a b := Nat.gcd_pos_of_pos_left b ha
    have hlcm : 1 * Nat.lcm a b ≤ Nat.gcd a b * Nat.lcm a b := Nat.mul_le_mul_right (Nat.lcm a b) hg
    rw [h] at hlcm
    rw [one_mul] at hlcm
    exact hlcm

lemma D_le_prod (k : ℕ) : D k ≤ (Finset.range k).prod (fun j => b j + 1) := by
  induction k with
  | zero => simp [D]
  | succ k ih =>
    rw [Finset.prod_range_succ]
    dsimp [D]
    have h_lcm : Nat.lcm (D k) (b k + 1) ≤ D k * (b k + 1) := lcm_le_mul (D k) (b k + 1)
    have h_mul : D k * (b k + 1) ≤ (Finset.range k).prod (fun j => b j + 1) * (b k + 1) := by
      apply Nat.mul_le_mul_right
      exact ih
    omega

lemma prod_add_one_le (k : ℕ) : (Finset.range k).prod (fun j => b j + 1) ≤ 2^k * (Finset.range k).prod b := by
  induction k with
  | zero => simp
  | succ k ih =>
    rw [Finset.prod_range_succ, Finset.prod_range_succ, pow_succ]
    have h_b_ge2 : 2 ≤ b k := b_ge_two k
    have h_b1_le : b k + 1 ≤ 2 * b k := by omega
    have h_mul : (Finset.range k).prod (fun j => b j + 1) * (b k + 1) ≤ (2^k * (Finset.range k).prod b) * (2 * b k) := by
      apply Nat.mul_le_mul ih h_b1_le
    have h_ring : (2^k * (Finset.range k).prod b) * (2 * b k) = 2 * 2^k * ((Finset.range k).prod b * b k) := by ring
    rw [h_ring] at h_mul
    exact h_mul

lemma b_prod (k : ℕ) : (Finset.range k).prod b = b k - 1 := by
  induction k with
  | zero => rfl
  | succ k ih =>
    rw [Finset.prod_range_succ, ih]
    calc
      (b k - 1) * b k = b k * b k - b k := by rw [Nat.mul_sub_right_distrib, Nat.one_mul]
      _ = b k * b k - b k + 1 - 1 := by omega
      _ = b (k + 1) - 1 := rfl

lemma D_le_bound (k : ℕ) : D k ≤ 2^k * b k := by
  have h1 : D k ≤ (Finset.range k).prod (fun j => b j + 1) := D_le_prod k
  have h2 : (Finset.range k).prod (fun j => b j + 1) ≤ 2^k * (Finset.range k).prod b := prod_add_one_le k
  have h3 : (Finset.range k).prod b = b k - 1 := b_prod k
  rw [h3] at h2
  have h4 : 2^k * (b k - 1) ≤ 2^k * b k := by
    apply Nat.mul_le_mul_left
    omega
  omega

