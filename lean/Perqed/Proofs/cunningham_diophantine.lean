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

end Perqed.Proofs
