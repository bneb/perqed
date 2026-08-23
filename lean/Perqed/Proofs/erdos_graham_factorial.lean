/-
  Perqed.Proofs.erdos_graham_factorial
  Automated Formal Proof Artifact for Terence Tao's Erdős-Graham Factorial Problem.
-/

import Perqed.Spec.erdos_graham_factorial

namespace Perqed.Proofs

open Perqed.Spec

/-- Lemma: Step equation for factorial function -/
theorem factorial_succ (n : Nat) : fact (n + 1) = (n + 1) * fact n := rfl

/-- Lemma: General algebraic squaring identity -/
theorem mul_sq_comm (f n : Nat) : f * (n^2 * f) = (n * f)^2 := by
  rw [Nat.pow_two, Nat.pow_two]
  calc
    f * (n * n * f) = f * (n * (n * f)) := by rw [Nat.mul_assoc n n f]
    _ = f * ((n * f) * n) := by rw [Nat.mul_comm n (n * f)]
    _ = (f * (n * f)) * n := by rw [Nat.mul_assoc f (n * f) n]
    _ = ((n * f) * f) * n := by rw [Nat.mul_comm f (n * f)]
    _ = (n * f) * (f * n) := by rw [Nat.mul_assoc (n * f) f n]
    _ = (n * f) * (n * f) := by rw [Nat.mul_comm f n]

/-- Proof of Consecutive Square Neighbor Factorial Reducibility -/
theorem factorial_square_neighbor (n : Nat) : Perqed.Spec.factorial_square_neighbor_spec n := by
  dsimp [Perqed.Spec.factorial_square_neighbor_spec]
  intro hn
  have h_succ : n^2 = (n^2 - 1) + 1 := by
    have : n^2 = n * n := Nat.pow_two n
    have : 1 * 1 ≤ n * n := Nat.mul_le_mul hn hn
    omega
  have h_fact_step : fact (n^2) = n^2 * fact (n^2 - 1) := by
    conv => lhs; rw [h_succ]
    rw [factorial_succ (n^2 - 1)]
    have : n^2 - 1 + 1 = n^2 := by omega
    rw [this]
  rw [h_fact_step]
  exact mul_sq_comm (fact (n^2 - 1)) n

/-- Proof of Universal Infinite Solution Family for F_3 with a_1 = 1 -/
theorem f3_universal_family_one (n : Nat) : Perqed.Spec.f3_universal_family_one_spec n := by
  dsimp [Perqed.Spec.f3_universal_family_one_spec]
  intro hn
  have : fact 1 = 1 := rfl
  rw [this, Nat.one_mul]
  exact factorial_square_neighbor n hn

/-- Proof of Sporadic F_3 Solution Certificate (H=2): 2! * 7! * 9! = (12 * 7!)^2 -/
theorem f3_sporadic_two_seven_nine : Perqed.Spec.f3_sporadic_two_seven_nine_spec := rfl

/-- Proof of Sporadic F_3 Solution Certificate (H=3): 6! * 7! * 10! = (6! * 7!)^2 -/
theorem f3_sporadic_six_seven_ten : Perqed.Spec.f3_sporadic_six_seven_ten_spec := rfl

/-- Proof of Sporadic F_3 Solution Certificate (H=2): 3! * 23! * 25! = (60 * 23!)^2 -/
theorem f3_sporadic_three_twentythree_twentyfive : Perqed.Spec.f3_sporadic_three_twentythree_twentyfive_spec := rfl

/-- Proof of Universal Pairwise Orthogonal 4-Factorial Family (k=4) -/
theorem f4_universal_orthogonal (m n : Nat) : Perqed.Spec.f4_universal_orthogonal_spec m n := by
  dsimp [Perqed.Spec.f4_universal_orthogonal_spec]
  intro hm hn
  rw [factorial_square_neighbor m hm, factorial_square_neighbor n hn]
  rw [Nat.pow_two (m * fact (m^2 - 1)), Nat.pow_two (n * fact (n^2 - 1))]
  rw [Nat.pow_two (m * fact (m^2 - 1) * (n * fact (n^2 - 1)))]
  generalize hA : m * fact (m^2 - 1) = A
  generalize hB : n * fact (n^2 - 1) = B
  calc
    A * A * (B * B) = A * (A * (B * B)) := by rw [Nat.mul_assoc]
    _ = A * ((A * B) * B) := by rw [Nat.mul_assoc A B B]
    _ = A * (B * (A * B)) := by rw [Nat.mul_comm (A * B) B]
    _ = (A * B) * (A * B) := by rw [← Nat.mul_assoc A B (A * B)]

end Perqed.Proofs
