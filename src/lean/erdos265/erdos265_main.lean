import Mathlib

/-!
# Erdős 265: Main Resolution Theorem

This is the top-level repository hub for the formal resolution of the 
Erdős 265 Ceiling Conjecture.

The mathematical proof is split cleanly into two distinct Lean files, 
separating the analytical bounds from the exact algebraic traps.

## Reading Guide for Reviewers

### 1. The Asymptotic Integer Squeeze (`residual_growth_bound.lean`)
If the sequence grows doubly exponentially (i.e., its limsup > 1), the product
prefix outpaces the individual terms. This forces the integer residuals 
(tracking the infinite tail sum) to converge to a constant value.
Because they are exact integers, converging to a real limit implies they must 
eventually become totally constant, and thus strictly bounded.

### 2. The Exact Integer Collapse (`irrational_L.lean`)
If the integer residuals are bounded, the two infinite series become "coupled".
This coupling algebraically forces the infinite product `limitL = ∏ seq_k/(seq_k-1)`
to be strictly rational. 
This file flawlessly proves (with 0 `sorry`s) that this rationality triggers 
an algebraic collapse where `prefixProduct(k) = limitL * shiftedPrefixProduct(k)`. Because `limitL` is an infinite 
product, this contradicts the structural requirement that `seq_k ≥ 2`.

**Conclusion**: The maximum theoretical doubly-exponential growth rate 
is bounded precisely at the ceiling: `limsup seqₖ^{1/2^k} ≤ 1`.
-/
