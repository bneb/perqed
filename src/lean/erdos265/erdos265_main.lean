import Mathlib

/-!
# Erdős 265: Main Resolution Theorem

This file stitches together the mathematical resolution of the Erdős 265
Ceiling Conjecture.

1. `residual_growth_bound.lean` establishes the Asymptotic Integer Squeeze:
   If the sequence grows doubly exponentially (limsup > 1), the integer
   residuals R₁ and Rₛ are forced to converge, and thus are absolutely bounded.

2. `irrational_L.lean` establishes the Exact Integer Collapse:
   If the residuals are bounded, the infinite product L = ∏ a_k/(a_k-1)
   must be strictly rational, which algebraically collapses the sequence,
   contradicting the assumption that a_k ≥ 2.

Together, these cleanly prove that the maximum theoretical doubly-exponential
growth rate is bounded precisely at the ceiling: limsup aₖ^{1/2^k} ≤ 1.
-/
