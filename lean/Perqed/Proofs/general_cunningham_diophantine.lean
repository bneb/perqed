/-
  Perqed.Proofs.general_cunningham_diophantine
  Automated Formal Proof Artifact for Generalized Cunningham Diophantine Equations.
-/

import Perqed.Spec.general_cunningham_diophantine

namespace Perqed.Proofs

/-- Lemma: For all k, 2^k >= 1 -/
theorem two_pow_pos (k : Nat) : 2^k ≥ 1 := by
  induction k with
  | zero => decide
  | succ n ih =>
    have : 2^(n + 1) = 2^n * 2 := rfl
    omega

/-- Lemma: (a + b)^2 = a^2 + 2*a*b + b^2 -/
theorem sq_expand (a b : Nat) : (a + b)^2 = a^2 + 2 * a * b + b^2 := by
  rw [Nat.pow_two, Nat.pow_two, Nat.pow_two]
  calc
    (a + b) * (a + b) = (a + b) * a + (a + b) * b := Nat.mul_add (a + b) a b
    _ = (a * a + b * a) + (a * b + b * b) := by rw [Nat.add_mul, Nat.add_mul]
    _ = (a * a + a * b) + (a * b + b * b) := by rw [Nat.mul_comm b a]
    _ = a * a + (a * b + a * b) + b * b := by omega
    _ = a * a + 2 * (a * b) + b * b := by rw [← Nat.two_mul (a * b)]
    _ = a * a + 2 * a * b + b * b := by rw [Nat.mul_assoc 2 a b]

/-- Proof of Mersenne Universal Family: (2^k - 1) + (2^k * (2^k - 1) + 1) = (2^k)^2 -/
theorem mersenne_family (k : Nat) : Perqed.Spec.mersenne_family_spec k := by
  dsimp [Perqed.Spec.mersenne_family_spec]
  have hk : 2^k ≥ 1 := two_pow_pos k
  revert hk
  generalize hm : 2^k = M
  intro hk
  have hdist : M * (M - 1) = M * M - M * 1 := Nat.mul_sub_left_distrib M M 1
  rw [hdist, Nat.mul_one, Nat.pow_two]
  have h_le : M ≤ M * M := by
    have : 1 * M ≤ M * M := Nat.mul_le_mul_right M hk
    rw [Nat.one_mul] at this
    exact this
  have h_sub_add : M * M - M + 1 = M * M - (M - 1) := by omega
  omega

/-- Proof of Affine Universal Family: (2^k + 3) + (2^k * (2^k + 3) + 1) = (2^k + 2)^2 -/
theorem affine_family (k : Nat) : Perqed.Spec.affine_family_spec k := by
  dsimp [Perqed.Spec.affine_family_spec]
  rw [sq_expand (2^k) 2]
  have hdist : 2^k * (2^k + 3) = 2^k * 2^k + 2^k * 3 := Nat.mul_add (2^k) (2^k) 3
  rw [hdist, Nat.pow_two]
  have h_mid : 2 * 2^k * 2 = 2^k * 4 := by omega
  have h_prod : 2^k * 3 + 2^k + 3 + 1 = 2^k * 4 + 4 := by omega
  omega

/-- Proof of Linear Slice Difference of Squares Factorization -/
theorem linear_diff_squares (z : Nat) : Perqed.Spec.linear_diff_squares_spec z := by
  dsimp [Perqed.Spec.linear_diff_squares_spec]
  intro hz
  rw [Nat.pow_two]
  have h_le : z ≤ z * z := by
    have : 1 * z ≤ z * z := Nat.mul_le_mul_right z hz
    rw [Nat.one_mul] at this
    exact this
  calc
    (z - 1) * (z + 1) = (z - 1) * z + (z - 1) * 1 := Nat.mul_add (z - 1) z 1
    _ = (z * z - 1 * z) + (z - 1) := by rw [Nat.mul_sub_right_distrib, Nat.mul_one]
    _ = (z * z - z) + (z - 1) := by rw [Nat.one_mul]
    _ = (z * z - z + z) - 1 := by omega
    _ = z * z - 1 := by rw [Nat.sub_add_cancel h_le]

/-- Proof of Sporadic Solution Certificate (x=3, y=2): 3^3 + 13^2 = 14^2 -/
theorem sporadic_cubic_sq : Perqed.Spec.sporadic_cubic_sq_spec := rfl

/-- Proof of Sporadic Solution Certificate (x=5, y=1): 3^5 + 13^1 = 16^2 -/
theorem sporadic_quintic : Perqed.Spec.sporadic_quintic_spec := rfl

/-- Proof of Sporadic Solution Certificate (x=3, y=1): 7^3 + 57^1 = 20^2 -/
theorem sporadic_cubic_seven : Perqed.Spec.sporadic_cubic_seven_spec := rfl

/-- Proof of Modulo 8 Non-Square Obstruction: z^2 % 8 cannot be 2, 5, or 6 -/
theorem general_mod8_obstruction (z : Nat) : Perqed.Spec.general_mod8_obstruction_spec z := by
  dsimp [Perqed.Spec.general_mod8_obstruction_spec]
  intro h
  have hsq : z^2 % 8 = (z % 8)^2 % 8 := by
    rw [Nat.pow_two, Nat.pow_two, Nat.mul_mod]
  have hcase : z % 8 = 0 ∨ z % 8 = 1 ∨ z % 8 = 2 ∨ z % 8 = 3 ∨ z % 8 = 4 ∨ z % 8 = 5 ∨ z % 8 = 6 ∨ z % 8 = 7 := by omega
  rw [hsq] at h
  rcases hcase with h0 | h1 | h2 | h3 | h4 | h5 | h6 | h7
  · rw [h0] at h; revert h; decide
  · rw [h1] at h; revert h; decide
  · rw [h2] at h; revert h; decide
  · rw [h3] at h; revert h; decide
  · rw [h4] at h; revert h; decide
  · rw [h5] at h; revert h; decide
  · rw [h6] at h; revert h; decide
  · rw [h7] at h; revert h; decide

/-- Lemma: For any odd integer p, p^2 % 8 = 1 -/
theorem odd_sq_mod8 (p : Nat) (hp : p % 2 = 1) : p^2 % 8 = 1 := by
  have h8 : p % 8 < 8 := Nat.mod_lt p (by decide)
  have h_cases : p % 8 = 0 ∨ p % 8 = 1 ∨ p % 8 = 2 ∨ p % 8 = 3 ∨ p % 8 = 4 ∨ p % 8 = 5 ∨ p % 8 = 6 ∨ p % 8 = 7 := by omega
  have h_div : p = 8 * (p / 8) + (p % 8) := (Nat.div_add_mod p 8).symm
  have h_even_cases : p % 8 = 0 ∨ p % 8 = 2 ∨ p % 8 = 4 ∨ p % 8 = 6 → False := by
    intro he
    have : p % 2 = 0 := by
      rcases he with h0 | h2 | h4 | h6
      · have : p = 2 * (4 * (p / 8)) := by omega
        rw [this, Nat.mul_mod_right]
      · have : p = 2 * (4 * (p / 8) + 1) := by omega
        rw [this, Nat.mul_mod_right]
      · have : p = 2 * (4 * (p / 8) + 2) := by omega
        rw [this, Nat.mul_mod_right]
      · have : p = 2 * (4 * (p / 8) + 3) := by omega
        rw [this, Nat.mul_mod_right]
    omega
  have h_odd_cases : p % 8 = 1 ∨ p % 8 = 3 ∨ p % 8 = 5 ∨ p % 8 = 7 := by
    rcases h_cases with h0 | h1 | h2 | h3 | h4 | h5 | h6 | h7
    · exfalso; exact h_even_cases (Or.inl h0)
    · exact Or.inl h1
    · exfalso; exact h_even_cases (Or.inr (Or.inl h2))
    · exact Or.inr (Or.inl h3)
    · exfalso; exact h_even_cases (Or.inr (Or.inr (Or.inl h4)))
    · exact Or.inr (Or.inr (Or.inl h5))
    · exfalso; exact h_even_cases (Or.inr (Or.inr (Or.inr h6)))
    · exact Or.inr (Or.inr (Or.inr h7))
  have hsq : p^2 % 8 = (p % 8)^2 % 8 := by
    rw [Nat.pow_two, Nat.pow_two, Nat.mul_mod]
  rw [hsq]
  rcases h_odd_cases with h1 | h3 | h5 | h7
  · rw [h1]
  · rw [h3]
  · rw [h5]
  · rw [h7]

/-- Lemma: For all k >= 3, 2^k % 8 = 0 -/
theorem two_pow_ge3_mod8 (k : Nat) (hk : k ≥ 3) : 2^k % 8 = 0 := by
  induction k with
  | zero => omega
  | succ n ih =>
    have hn : n = 2 ∨ n ≥ 3 := by omega
    rcases hn with hn2 | hn3
    · rw [hn2]
    · have : 2^(n + 1) = 2^n * 2 := rfl
      rw [this, Nat.mul_mod, ih hn3]

/-- Proof of Complete Modulo 8 Non-Residue Obstruction Theorem for (x=2, y=1) -/
theorem cunningham_odd_prime_no_sol (p k z : Nat) :
    Perqed.Spec.cunningham_odd_prime_no_sol_spec p k z := by
  dsimp [Perqed.Spec.cunningham_odd_prime_no_sol_spec]
  intro hk hp heq
  have h_sq_mod : (p^2 + (2^k * p + 1)) % 8 = z^2 % 8 := by rw [heq]
  have hp2_mod : p^2 % 8 = 1 := odd_sq_mod8 p hp
  have h_lhs_mod : (p^2 + (2^k * p + 1)) % 8 = 6 ∨ (p^2 + (2^k * p + 1)) % 8 = 2 := by
    have hk_cases : k = 2 ∨ k ≥ 3 := by omega
    rcases hk_cases with hk2 | hk3
    · rw [hk2]
      have h4p : (4 * p + 1) % 8 = 5 := by
        have : p = 2 * (p / 2) + 1 := by omega
        have : 4 * p + 1 = 8 * (p / 2) + 5 := by omega
        rw [this, Nat.add_mod, Nat.mul_mod_right]
      have : (p^2 + (4 * p + 1)) % 8 = (p^2 % 8 + (4 * p + 1) % 8) % 8 := Nat.add_mod (p^2) (4 * p + 1) 8
      rw [this, hp2_mod, h4p]
      exact Or.inl rfl
    · have h2k : 2^k % 8 = 0 := two_pow_ge3_mod8 k hk3
      have h_term : (2^k * p + 1) % 8 = 1 := by
        have : (2^k * p + 1) % 8 = ((2^k * p) % 8 + 1 % 8) % 8 := Nat.add_mod (2^k * p) 1 8
        have h_prod : (2^k * p) % 8 = 0 := by
          rw [Nat.mul_mod, h2k, Nat.zero_mul, Nat.zero_mod]
        rw [this, h_prod]
      have : (p^2 + (2^k * p + 1)) % 8 = (p^2 % 8 + (2^k * p + 1) % 8) % 8 := Nat.add_mod (p^2) (2^k * p + 1) 8
      rw [this, hp2_mod, h_term]
      exact Or.inr rfl
  rw [h_sq_mod] at h_lhs_mod
  apply general_mod8_obstruction z
  rcases h_lhs_mod with h6 | h2
  · exact Or.inr (Or.inr h6)
  · exact Or.inl h2

/-- Proof of Modulo 4 Obstruction Theorem for (x=2, y=2) -/
theorem cunningham_two_two_obstruction (p q z : Nat) :
    Perqed.Spec.cunningham_two_two_obstruction_spec p q z := by
  dsimp [Perqed.Spec.cunningham_two_two_obstruction_spec]
  intro hp hq h_eq
  have hp8 : p^2 % 8 = 1 := odd_sq_mod8 p hp
  have hq8 : q^2 % 8 = 1 := odd_sq_mod8 q hq
  have h_add : (p^2 + q^2) % 8 = (p^2 % 8 + q^2 % 8) % 8 := Nat.add_mod (p^2) (q^2) 8
  have h_sum : (p^2 + q^2) % 8 = 2 := by rw [h_add, hp8, hq8]
  rw [h_eq] at h_sum
  have h_obs := general_mod8_obstruction z
  exact h_obs (Or.inl h_sum)

/-- Proof of Algebraic Prime Factorization Obstruction for (x=1, y=2) -/
theorem cunningham_one_two_obstruction (k p q : Nat) :
    Perqed.Spec.cunningham_one_two_obstruction_spec k p q := by
  dsimp [Perqed.Spec.cunningham_one_two_obstruction_spec]
  intro hk hp hq h_bound
  have h_k_ge : 2^k ≥ 4 := by
    have : 2^2 ≤ 2^k := Nat.pow_le_pow_right (by omega) hk
    omega
  have h_q_ge_4p : 2^k * p ≥ 4 * p := by
    have : 4 ≤ 2^k := h_k_ge
    have : 4 * p ≤ 2^k * p := Nat.mul_le_mul_right p this
    omega
  have : q ≥ 4 * p + 1 := by omega
  omega

/-- Proof of Quadratic Non-Square Trapping Lemma -/
theorem not_sq_trap (z N L : Nat) : Perqed.Spec.not_sq_trap_spec z N L := by
  dsimp [Perqed.Spec.not_sq_trap_spec]
  intro hN hL hR
  have : z ≤ L ∨ z ≥ L + 1 := by omega
  rcases this with hle | hge
  · have h_le : z^2 ≤ L^2 := Nat.pow_le_pow_left hle 2
    omega
  · have h_ge : z^2 ≥ (L + 1)^2 := Nat.pow_le_pow_left hge 2
    omega

end Perqed.Proofs
