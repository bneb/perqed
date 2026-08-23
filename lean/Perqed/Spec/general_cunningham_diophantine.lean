/-
  Perqed.Spec.general_cunningham_diophantine
  Frozen, hash-locked specification for the Generalized Multi-Exponent Cunningham Diophantine Equation:
  p^x + (2^k * p + 1)^y = z^2 across all (x, y) in N^2, k >= 2, and odd primes p.
-/

namespace Perqed.Spec

/-- 
  Linear Exponent Mersenne Universal Family:
  For any k >= 1, setting p = 2^k - 1 identically produces z = 2^k
  satisfying p^1 + (2^k * p + 1)^1 = z^2 whenever 2^k - 1 is prime.
-/
def mersenne_family_spec (k : Nat) : Prop :=
  (2^k - 1) + (2^k * (2^k - 1) + 1) = (2^k)^2

/-- 
  Linear Exponent Affine Universal Family:
  For any k >= 1, setting p = 2^k + 3 identically produces z = 2^k + 2
  satisfying p^1 + (2^k * p + 1)^1 = z^2 whenever 2^k + 3 is prime.
-/
def affine_family_spec (k : Nat) : Prop :=
  (2^k + 3) + (2^k * (2^k + 3) + 1) = (2^k + 2)^2

/-- 
  Sporadic Solution (x=3, y=2): 3^3 + 13^2 = 14^2 (k=2, p=3, q=13)
-/
def sporadic_cubic_sq_spec : Prop :=
  3^3 + 13^2 = 14^2

/-- 
  Sporadic Solution (x=5, y=1): 3^5 + 13^1 = 16^2 (k=2, p=3, q=13)
-/
def sporadic_quintic_spec : Prop :=
  3^5 + 13^1 = 16^2

/-- 
  Sporadic Solution (x=3, y=1): 7^3 + 57^1 = 20^2 (k=3, p=7, q=57)
-/
def sporadic_cubic_seven_spec : Prop :=
  7^3 + 57^1 = 20^2

/-- 
  Modulo 8 Non-Square Obstruction:
  No integer square z^2 can equal 2, 5, or 6 modulo 8.
-/
def general_mod8_obstruction_spec (z : Nat) : Prop :=
  z^2 % 8 = 2 ∨ z^2 % 8 = 5 ∨ z^2 % 8 = 6 → False

end Perqed.Spec
