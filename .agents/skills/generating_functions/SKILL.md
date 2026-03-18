---
name: generating_functions
description: Encode a sequence as coefficients of a formal power series and exploit algebraic operations on the series to derive recurrences, closed forms, and identities.
---

# Generating Functions

## Technique

A generating function `F(x) = ∑_{n≥0} a_n x^n` encodes the sequence `(a_n)` as coefficients of a formal power series. Operations on `F` correspond to operations on the sequence: multiplication is convolution, differentiation shifts and weights, and partial fractions yield closed forms via geometric series.

Ordinary generating functions (OGFs) handle unlabeled combinatorial structures; exponential generating functions (EGFs) handle labeled structures (permutations, set partitions). The key step is translating a combinatorial recurrence into an algebraic equation for `F(x)` and then solving it.

In Lean 4 / mathlib4, `PowerSeries` provides the formal power series ring. `PowerSeries.coeff` extracts the n-th coefficient. Most identities about binomial coefficients and recurrences have generating function proofs that translate cleanly to `PowerSeries` algebra.

## When to Apply

- The goal is a closed form for a sequence satisfying a linear recurrence.
- A combinatorial identity follows from an algebraic identity of power series.
- Partition counting problems: `∑ p(n) xⁿ` has a product formula `∏_k 1/(1-xᵏ)`.
- The ARCHITECT's context shows a sequence `a(n)` with a known recurrence but no closed form yet attempted.
- A Ramsey or graph-theoretic counting sequence satisfies a recognizable recurrence.

## Lean 4 Template

```lean
import Mathlib

open PowerSeries

-- Define OGF from a sequence
noncomputable def ogf (a : ℕ → ℝ) : PowerSeries ℝ :=
  PowerSeries.mk (fun n => a n)

-- Fibonacci OGF: F(x) = x / (1 - x - x²)
noncomputable def fibOGF : PowerSeries ℝ :=
  PowerSeries.mk (fun n => Nat.fib n)

-- Coefficient extraction
theorem fib_coeff (n : ℕ) : coeff ℝ n fibOGF = Nat.fib n :=
  PowerSeries.coeff_mk n _

-- Geometric series: 1/(1-x) = ∑ xⁿ
theorem geometric_series (R : Type*) [CommRing R] :
    (1 - PowerSeries.X (R := R)) * (∑' n, PowerSeries.X ^ n) = 1 := by
  sorry  -- follows from PowerSeries.inv_one_sub_X

-- Convolution: (A * B).coeff n = ∑ k ≤ n, a.coeff k * b.coeff (n-k)  
theorem convolution_coeffs {R : Type*} [CommSemiring R]
    (A B : PowerSeries R) (n : ℕ) :
    coeff R n (A * B) = ∑ k ∈ Finset.range (n + 1), coeff R k A * coeff R (n - k) B :=
  PowerSeries.coeff_mul n A B

-- EGF template for labeled structures
-- eᵒˢ = ∑ n, xⁿ/n! encodes counting of labeled sets
noncomputable def egf (a : ℕ → ℝ) : PowerSeries ℝ :=
  PowerSeries.mk (fun n => a n / n.factorial)
```

## Worked Example

Proving the Fibonacci recurrence via OGF:

```lean
import Mathlib
open PowerSeries

-- F satisfies F = xF + x²F + x: algebraic relation encodes fib recurrence
-- Fib recurrence: fib(n+2) = fib(n+1) + fib(n)
theorem fib_recurrence (n : ℕ) : Nat.fib (n + 2) = Nat.fib (n + 1) + Nat.fib n :=
  Nat.fib_add_two n
```

## DAG Node Config Template

```json
{
  "id": "apply_generating_functions",
  "kind": "skill_apply",
  "label": "Encode sequence as power series coefficient to find closed form",
  "dependsOn": ["[previous_node]"],
  "config": {
    "skillPath": ".agents/skills/generating_functions/SKILL.md",
    "inputFromNode": "[previous_node]"
  }
}
```

## Key References

- Mathlib4: `Mathlib.RingTheory.PowerSeries.Basic`, `Mathlib.Data.Nat.Fib`.
- Wilf, Herbert. *Generatingfunctionology*, 3rd ed. A K Peters, 2006 (freely available online).
- Stanley, Richard. *Enumerative Combinatorics*, Vol. 1, Cambridge University Press.
