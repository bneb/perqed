/-
  Perqed.Proofs.general_cunningham_diophantine
  Automated Formal Proof Artifact for Generalized Multi-Exponent Cunningham Diophantine Equations.
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

/-- Proof of Sporadic Solution (x=3, y=2): 3^3 + 13^2 = 14^2 -/
theorem sporadic_cubic_sq : Perqed.Spec.sporadic_cubic_sq_spec := rfl

/-- Proof of Sporadic Solution (x=5, y=1): 3^5 + 13^1 = 16^2 -/
theorem sporadic_quintic : Perqed.Spec.sporadic_quintic_spec := rfl

/-- Proof of Sporadic Solution (x=3, y=1): 7^3 + 57^1 = 20^2 -/
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

end Perqed.Proofs
