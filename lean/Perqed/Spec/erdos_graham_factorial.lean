/-
  Perqed.Spec.erdos_graham_factorial
  Frozen, hash-locked specification for Terence Tao's Erdős-Graham Factorial Problem:
  Squarefree components and Diophantine solvability of a_1! a_2! a_3! = m^2 and a_1! a_2! a_3! a_4! = m^2.
-/

namespace Perqed.Spec

/-- Factorial definition on Nat -/
def fact : Nat → Nat
  | 0 => 1
  | n + 1 => (n + 1) * fact n

/-- 
  Consecutive Square Neighbor Factorial Reducibility:
  For any natural number n >= 1, (n^2 - 1)! * (n^2)! = (n * (n^2 - 1)!)^2.
-/
def factorial_square_neighbor_spec (n : Nat) : Prop :=
  n ≥ 1 → fact (n^2 - 1) * fact (n^2) = (n * fact (n^2 - 1))^2

/-- 
  Universal Infinite Solution Family for F_3 with a_1 = 1:
  For any natural number n >= 1, 1! * (n^2 - 1)! * (n^2)! = (n * (n^2 - 1)!)^2.
-/
def f3_universal_family_one_spec (n : Nat) : Prop :=
  n ≥ 1 → fact 1 * fact (n^2 - 1) * fact (n^2) = (n * fact (n^2 - 1))^2

/-- 
  Sporadic F_3 Solution Certificate (H=2): 2! * 7! * 9! = (12 * 7!)^2
-/
def f3_sporadic_two_seven_nine_spec : Prop :=
  fact 2 * fact 7 * fact 9 = (12 * fact 7)^2

/-- 
  Sporadic F_3 Solution Certificate (H=3): 6! * 7! * 10! = (6! * 7!)^2
-/
def f3_sporadic_six_seven_ten_spec : Prop :=
  fact 6 * fact 7 * fact 10 = (fact 6 * fact 7)^2

/-- 
  Sporadic F_3 Solution Certificate (H=2): 3! * 23! * 25! = (60 * 23!)^2
-/
def f3_sporadic_three_twentythree_twentyfive_spec : Prop :=
  fact 3 * fact 23 * fact 25 = (60 * fact 23)^2

/-- 
  Universal Pairwise Orthogonal 4-Factorial Family (k=4):
  For all m, n >= 1, (m^2 - 1)! * (m^2)! * (n^2 - 1)! * (n^2)! = (m * (m^2 - 1)! * (n * (n^2 - 1)!))^2.
-/
def f4_universal_orthogonal_spec (m n : Nat) : Prop :=
  m ≥ 1 → n ≥ 1 →
  (fact (m^2 - 1) * fact (m^2)) * (fact (n^2 - 1) * fact (n^2)) =
    (m * fact (m^2 - 1) * (n * fact (n^2 - 1)))^2

end Perqed.Spec
