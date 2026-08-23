/-
  Perqed.Spec.cunningham_diophantine
  Frozen, hash-locked specification for the Generalized Cunningham Exponential Diophantine Equation.
  Extends Subhasis Panda (arXiv:2608.18608) to Cunningham prime parameterizations.
-/

namespace Perqed.Spec

/-- Panda's Sophie Germain identity: p^2 + (2p + 1) = (p + 1)^2 -/
def sophie_germain_diophantine_spec (p : Nat) : Prop :=
  p^2 + (2 * p + 1) = (p + 1)^2

/-- Difference of squares factoring for Cunningham equation: z^2 - p^2 = 2^k * p + 1 -/
def cunningham_diff_squares_spec (p k z : Nat) : Prop :=
  z^2 = p^2 + (2^k * p + 1) ↔ (z - p) * (z + p) = 2^k * p + 1

/-- Cunningham k >= 2 no consecutive-integer solution spec:
    For all k >= 2, (p + 1)^2 < p^2 + (2^k * p + 1) whenever p >= 1 -/
def cunningham_strict_gap_spec (p k : Nat) : Prop :=
  p ≥ 1 → k ≥ 2 → (p + 1)^2 < p^2 + (2^k * p + 1)

end Perqed.Spec
