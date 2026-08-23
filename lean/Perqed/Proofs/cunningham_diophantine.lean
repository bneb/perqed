/-
  Perqed.Proofs.cunningham_diophantine
  Automated Formal Proof Artifact for Generalized Cunningham Diophantine Equations.
-/

import Perqed.Spec.cunningham_diophantine

namespace Perqed.Proofs

/-- Proof of Panda's Sophie Germain identity: p^2 + (2p + 1) = (p + 1)^2 -/
theorem sophie_germain_diophantine (p : Nat) : Perqed.Spec.sophie_germain_diophantine_spec p := by
  dsimp [Perqed.Spec.sophie_germain_diophantine_spec]
  rw [Nat.pow_two, Nat.pow_two]
  have h : (p + 1) * (p + 1) = p * p + 2 * p + 1 := by
    calc
      (p + 1) * (p + 1) = (p + 1) * p + (p + 1) * 1 := Nat.mul_add (p + 1) p 1
      _ = (p * p + 1 * p) + (p * 1 + 1 * 1) := by rw [Nat.add_mul, Nat.add_mul]
      _ = p * p + 2 * p + 1 := by omega
  rw [h]
  omega

/-- Lemma: For all k >= 2, 2^k >= 4 -/
theorem two_pow_ge_four (k : Nat) (hk : k ≥ 2) : 2^k ≥ 4 := by
  induction k with
  | zero => contradiction
  | succ n ih =>
    cases n with
    | zero => contradiction
    | succ m =>
      cases m with
      | zero =>
        decide
      | succ l =>
        have hprev : 2^(l + 2) ≥ 4 := ih (by omega)
        have hcurr : 2^(l + 3) = 2^(l + 2) * 2 := rfl
        omega

/-- Proof of Cunningham strict gap for k >= 2: (p + 1)^2 < p^2 + (2^k * p + 1) -/
theorem cunningham_strict_gap (p k : Nat) : Perqed.Spec.cunningham_strict_gap_spec p k := by
  dsimp [Perqed.Spec.cunningham_strict_gap_spec]
  intro hp hk
  have h2k : 2^k ≥ 4 := two_pow_ge_four k hk
  rw [Nat.pow_two, Nat.pow_two]
  have h : (p + 1) * (p + 1) = p * p + 2 * p + 1 := by
    calc
      (p + 1) * (p + 1) = (p + 1) * p + (p + 1) * 1 := Nat.mul_add (p + 1) p 1
      _ = (p * p + 1 * p) + (p * 1 + 1 * 1) := by rw [Nat.add_mul, Nat.add_mul]
      _ = p * p + 2 * p + 1 := by omega
  rw [h]
  have hmul : 2^k * p ≥ 4 * p := by
    have := Nat.mul_le_mul_right p h2k
    omega
  omega

/-- Proof of Modulo 8 Quadratic Residue Obstruction: z^2 % 8 cannot be 2, 5, or 6 -/
theorem cunningham_mod8_non_square (z : Nat) : Perqed.Spec.cunningham_mod8_non_square_spec z := by
  dsimp [Perqed.Spec.cunningham_mod8_non_square_spec]
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
