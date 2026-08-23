/-
  Perqed.Spec.cunningham_diophantine
  Frozen, hash-locked specification for the Generalized Cunningham Exponential Diophantine Equation.
  Extends Subhasis Panda (arXiv:2608.18608) to Cunningham prime parameterizations.
-/

namespace Perqed.Spec

/-- Panda's Sophie Germain identity: p^2 + (2p + 1) = (p + 1)^2 -/
def sophie_germain_diophantine_spec (p : Nat) : Prop :=
  p^2 + (2 * p + 1) = (p + 1)^2

/-- Cunningham k >= 2 no consecutive-integer solution spec:
    For all k >= 2, (p + 1)^2 < p^2 + (2^k * p + 1) whenever p >= 1 -/
def cunningham_strict_gap_spec (p k : Nat) : Prop :=
  p ≥ 1 → k ≥ 2 → (p + 1)^2 < p^2 + (2^k * p + 1)

/-- Modulo 8 Quadratic Residue Obstruction:
    For any integer z, z^2 % 8 cannot equal 2, 5, or 6 -/
def cunningham_mod8_non_square_spec (z : Nat) : Prop :=
  z^2 % 8 = 2 ∨ z^2 % 8 = 5 ∨ z^2 % 8 = 6 → False

end Perqed.Spec
