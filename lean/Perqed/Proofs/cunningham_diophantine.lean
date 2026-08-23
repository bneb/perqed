/-
  Perqed.Proofs.cunningham_diophantine
  Automated Formal Proof Artifact for Generalized Cunningham Diophantine Equations.
-/

import Perqed.Spec.cunningham_diophantine

namespace Perqed.Proofs

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

/-- Lemma: For all n >= 1, 2^n >= 2 -/
theorem two_pow_ge_two (n : Nat) (hn : n ≥ 1) : 2^n ≥ 2 := by
  induction n with
  | zero => contradiction
  | succ m ih =>
    cases m with
    | zero => decide
    | succ l =>
      have : 2^(l + 1) ≥ 2 := ih (by omega)
      have : 2^(l + 2) = 2^(l + 1) * 2 := rfl
      omega

/-- Proof of Panda's Sophie Germain identity: p^2 + (2p + 1) = (p + 1)^2 -/
theorem sophie_germain_diophantine (p : Nat) : Perqed.Spec.sophie_germain_diophantine_spec p := by
  dsimp [Perqed.Spec.sophie_germain_diophantine_spec]
  rw [sq_expand p 1]
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
  rw [sq_expand p 1]
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

/-- Proof of Lower-Bound Trapping Condition: (p + 2^(k-1) - 1)^2 < p^2 + (2^k * p + 1) when 2p > (2^(k-1)-1)^2 - 1 -/
theorem cunningham_lower_bound_trap (p k : Nat) : Perqed.Spec.cunningham_lower_bound_trap_spec p k := by
  dsimp [Perqed.Spec.cunningham_lower_bound_trap_spec]
  intro hk hbound
  have hk1 : k - 1 ≥ 1 := by omega
  have hm_ge : 2^(k - 1) ≥ 2 := two_pow_ge_two (k - 1) hk1
  have hm2 : 2^k = 2 * 2^(k - 1) := by
    have : 2^k = 2^(k - 1 + 1) := by congr 1; omega
    rw [this, Nat.pow_succ]
    omega
  revert hbound
  generalize hm : 2^(k - 1) = m
  intro hbound
  have hm_sub : m ≥ 2 := by omega
  have h_assoc : p + m - 1 = p + (m - 1) := by omega
  rw [h_assoc]
  rw [sq_expand p (m - 1)]
  have h2k_p : 2^k * p = 2 * m * p := by rw [hm2, hm, Nat.mul_assoc 2 m p]
  rw [h2k_p]
  have h_mid : 2 * p * (m - 1) = 2 * m * p - 2 * p := by
    calc
      2 * p * (m - 1) = (2 * p) * m - (2 * p) * 1 := Nat.mul_sub_left_distrib (2 * p) m 1
      _ = 2 * p * m - 2 * p := by rw [Nat.mul_one]
      _ = 2 * (p * m) - 2 * p := by rw [Nat.mul_assoc 2 p m]
      _ = 2 * (m * p) - 2 * p := by rw [Nat.mul_comm p m]
      _ = 2 * m * p - 2 * p := by rw [← Nat.mul_assoc 2 m p]
  have h_2p_le : 2 * p ≤ 2 * m * p := by
    have : 2 * m ≥ 2 := by omega
    have := Nat.mul_le_mul_right p this
    omega
  rw [h_mid]
  omega

/-- Proof of Divisor Parametrization: Odd divisor d1 generates exact solution (p, z) -/
theorem cunningham_divisor_param (k d1 p z : Nat) : Perqed.Spec.cunningham_divisor_param_spec k d1 p z := by
  dsimp [Perqed.Spec.cunningham_divisor_param_spec]
  intro hk hd1_gt hd1_lt hd1_odd hdiv hz
  have hm2 : 2^k = 2 * 2^(k - 1) := by
    have : 2^k = 2^(k - 1 + 1) := by congr 1; omega
    rw [this, Nat.pow_succ]
    omega
  have h_sq1 : d1^2 ≥ 1 := by
    have : d1 ≥ 2 := by omega
    rw [Nat.pow_two]
    have := Nat.mul_le_mul this this
    omega
  rw [hz, sq_expand d1 p]
  have hdist : p * (2 * (2^(k - 1) - d1)) = p * (2 * 2^(k - 1)) - p * (2 * d1) := by
    have h1 : 2 * (2^(k - 1) - d1) = 2 * 2^(k - 1) - 2 * d1 := by omega
    rw [h1]
    rw [Nat.mul_sub_left_distrib p (2 * 2^(k - 1)) (2 * d1)]
  rw [hdist] at hdiv
  have h_comm1 : p * (2 * d1) = 2 * d1 * p := by
    calc
      p * (2 * d1) = (2 * d1) * p := Nat.mul_comm p (2 * d1)
      _ = 2 * d1 * p := rfl
  have h_comm2 : 2^k * p = p * (2 * 2^(k - 1)) := by
    rw [hm2, Nat.mul_comm (2 * 2^(k - 1)) p]
  rw [h_comm1] at hdiv
  have h_pos : p * (2 * 2^(k - 1)) ≥ 2 * d1 * p := by
    have hle : 2 * 2^(k - 1) ≥ 2 * d1 := by omega
    have := Nat.mul_le_mul_left p hle
    omega
  have h_add : p * (2 * 2^(k - 1)) = (d1^2 - 1) + 2 * d1 * p := by
    exact Nat.eq_add_of_sub_eq h_pos hdiv
  rw [h_comm2, h_add]
  have h_sub_add : (d1^2 - 1) + 1 = d1^2 := Nat.sub_add_cancel h_sq1
  omega

end Perqed.Proofs
