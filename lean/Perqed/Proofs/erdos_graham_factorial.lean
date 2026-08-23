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

/-- Proof of Strict Ordering of the Dominant H=1 Factorial Family -/
theorem h1_strictly_increasing (a1 s1 n : Nat) : Perqed.Spec.h1_strictly_increasing_spec a1 s1 n := by
  dsimp [Perqed.Spec.h1_strictly_increasing_spec]
  intro ha1 hn
  constructor
  · omega
  · omega

/-- Proof of Unit Interval Width of the Dominant Asymptotic Family -/
theorem h1_interval_length_one (s1 n : Nat) : Perqed.Spec.h1_interval_length_one_spec s1 n := by
  dsimp [Perqed.Spec.h1_interval_length_one_spec]
  intro hn
  omega

/-- Proof of Universal Composite 5-Factorial Product (k=5) -/
theorem f5_composite_family (a1 a2 a3 a4 a5 A B : Nat) :
    Perqed.Spec.f5_composite_family_spec a1 a2 a3 a4 a5 A B := by
  dsimp [Perqed.Spec.f5_composite_family_spec]
  intro h3 h2
  have h_prod : (fact a1 * fact a2 * fact a3) * (fact a4 * fact a5) = A^2 * B^2 := by
    rw [h3, h2]
  have h_sq : A^2 * B^2 = (A * B)^2 := by
    rw [Nat.pow_two A, Nat.pow_two B, Nat.pow_two (A * B)]
    calc
      (A * A) * (B * B) = A * (A * (B * B)) := by rw [Nat.mul_assoc]
      _ = A * ((A * B) * B) := by rw [Nat.mul_assoc A B B]
      _ = A * (B * (A * B)) := by rw [Nat.mul_comm (A * B) B]
      _ = (A * B) * (A * B) := by rw [← Nat.mul_assoc A B (A * B)]
  rw [h_prod, h_sq]

/-- Proof of Universal Triple-Orthogonal 6-Factorial Family (k=6) -/
theorem f6_triple_orthogonal (m1 m2 m3 : Nat) :
    Perqed.Spec.f6_triple_orthogonal_spec m1 m2 m3 := by
  dsimp [Perqed.Spec.f6_triple_orthogonal_spec]
  intro hm1 hm2 hm3
  have h1 := factorial_square_neighbor m1 hm1
  have h2 := factorial_square_neighbor m2 hm2
  have h3 := factorial_square_neighbor m3 hm3
  rw [h1, h2, h3]
  let A := m1 * fact (m1^2 - 1)
  let B := m2 * fact (m2^2 - 1)
  let C := m3 * fact (m3^2 - 1)
  change A^2 * (B^2 * C^2) = (A * (B * C))^2
  rw [Nat.pow_two A, Nat.pow_two B, Nat.pow_two C, Nat.pow_two (A * (B * C))]
  calc
    (A * A) * ((B * B) * (C * C)) = (A * A) * (B * (B * (C * C))) := by rw [Nat.mul_assoc B B (C * C)]
    _ = (A * A) * (B * ((B * C) * C)) := by rw [Nat.mul_assoc B C C]
    _ = (A * A) * (B * (C * (B * C))) := by rw [Nat.mul_comm (B * C) C]
    _ = (A * A) * ((B * C) * (B * C)) := by rw [← Nat.mul_assoc B C (B * C)]
    _ = A * (A * ((B * C) * (B * C))) := by rw [Nat.mul_assoc]
    _ = A * ((A * (B * C)) * (B * C)) := by rw [Nat.mul_assoc A (B * C) (B * C)]
    _ = A * ((B * C) * (A * (B * C))) := by rw [Nat.mul_comm (A * (B * C)) (B * C)]
    _ = (A * (B * C)) * (A * (B * C)) := by rw [← Nat.mul_assoc A (B * C) (A * (B * C))]

end Perqed.Proofs
