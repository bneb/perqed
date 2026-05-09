---
name: analytic_series
description: Prove rationality and convergence of infinite series using Mathlib's analytic tools. Leverages tsum (∑'), Summable predicates, and Liouville-type arguments for sequences with fast (double-exponential) growth.
---

# Analytic Series and Rationality

## Technique

Proving that an infinite series $\sum a_n$ is rational involves two steps: showing it converges (is `Summable`) and then computing its sum (`tsum`) in $\mathbb{Q}$ or showing it equals some $q \in \mathbb{Q}$.

### Summability and Convergence

In Mathlib, series are handled via `tsum` (the L-series notation `∑' n, f n`). For a series to be well-defined in the sense of having a value, it must be `Summable`.

```lean
import Mathlib.Analysis.SpecificLimits.Basic
import Mathlib.Data.Real.Basic

variable {α : Type*} [TopologicalSpace α] [AddCommGroup α] [T2Space α]
variable (f : ℕ → ℝ)

-- Predicate for convergence
#check Summable f

-- The value of the sum (returns 0 if not summable)
#check ∑' n, f n
```

### Proving Rationality

A common technique for proving the sum of a series is rational is to relate it to a telescoping sum or a geometric series.

**Telescoping Sum:**
If $a_n = g(n) - g(n+1)$ and $g(n) \to L$, then $\sum_{n=0}^\infty a_n = g(0) - L$. If $g(0)$ and $L$ are rational, the sum is rational.

**Geometric Series:**
$\sum_{n=0}^\infty r^n = \frac{1}{1-r}$ for $|r| < 1$. If $r \in \mathbb{Q}$, the sum is in $\mathbb{Q}$.

### Erdős Problem #265 (Kovač-Tao Context)

Kovač and Tao (2024) proved that there exist sequences $a_n$ with double-exponential growth such that $\sum 1/a_n$ and $\sum 1/(a_n-1)$ are both rational. The core idea often involves constructing $a_n$ such that one sum is a simple rational (like 1) and the other is forced to be rational via a recurrence relation.

For example, if $a_{n+1} = a_n^2 - a_n + 1$, then:
$\frac{1}{a_n - 1} - \frac{1}{a_{n+1} - 1} = \frac{1}{a_n}$
Summing this gives a telescoping series for $\sum 1/a_n$.

## When to Apply

- Proving existence of sequences with specific sum properties.
- Dealing with reciprocal sums of integers.
- Problems involving the "rationality" of constants or series values.
- When double-exponential growth ($a_n \approx c^{2^n}$) is suggested or required.

## Lean 4 Template

```lean
import Mathlib.Analysis.SpecificLimits.Basic
import Mathlib.Data.Real.Basic
import Mathlib.Data.Rat.Basic

open Topology

/-- 
Example: Prove that for a specific recurrence, the sum of reciprocals is rational.
Sequence: a_{n+1} = a_n^2 - a_n + 1, a_0 = 2
Then \sum 1/a_n = 1.
-/
def erdos_seq : ℕ → ℕ
  | 0 => 2
  | (n + 1) => (erdos_seq n)^2 - (erdos_seq n) + 1

theorem erdos_seq_sum_rational :
    Summable (fun n => 1 / (erdos_seq n : ℝ)) ∧ 
    (∑' n, 1 / (erdos_seq n : ℝ)) = 1 := by
  sorry -- Telescoping proof: 1/(a_n - 1) - 1/(a_{n+1} - 1) = 1/a_n

/--
General existence statement for Erdős 265.
-/
theorem erdos_265_existence : ∃ (a : ℕ → ℕ),
    StrictMono a ∧ (∀ n, 1 < a n) ∧
    (∃ q₁ : ℚ, (∑' n, 1 / (a n : ℝ)) = q₁) ∧
    (∃ q₂ : ℚ, (∑' n, 1 / (a n - 1 : ℝ)) = q₂) := by
  sorry
```

## Key References

- Kovač, V., and Tao, T. "Double-exponential growth for sequences with rational reciprocal sums." *arXiv preprint*, 2024.
- Erdős, P. "Some problems and results in number theory."
- Mathlib4: `Mathlib.Analysis.SpecificLimits.Basic`, `Mathlib.Data.Real.Series`.
