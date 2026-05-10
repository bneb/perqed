# Erdős 265: Research Log — Dual-Constraint Discovery

## Date: May 10, 2026

## Session Goal
Attack the open math gap in the Erdős 265 Ceiling Conjecture, pursuing a formal solution.

## Discovery: Two-Residual Squeeze

### Setup
For an Erdős 265 sequence with ∑1/aₖ = p₁/q₁ and ∑1/(aₖ-1) = p₂/q₂:
- R₁(N) = q₁·P₁(N)·T₁(N) is a positive integer (first sum residual)
- Rs(N) = q₂·P₂(N)·T₂(N) is a positive integer (shifted sum residual)

### Recurrences
- R₁(k+1) = aₖ·R₁(k) - q₁·P₁(k)    →  need aₖ > q₁·P₁(k)/R₁(k)
- Rs(k+1) = (aₖ-1)·Rs(k) - q₂·P₂(k)  →  need aₖ > q₂·P₂(k)/Rs(k) + 1

### Key Mechanism
At each step, aₖ must satisfy BOTH constraints. The LARGER lower bound determines aₖ. Computationally verified (`e265d.c` with GMP):
- One constraint eventually dominates permanently (gap between bounds squares each step)
- The dominating residual eventually stabilizes (positive integer, monotone at binding steps)
- Once stable, the sequence is fully determined → Sylvester-type recurrence

### Case Analysis
| Case | Determined by | Makes irrational | Status |
|------|--------------|-----------------|--------|
| R₁ stabilizes | First sum | ∑1/(aₖ-1) via Erdős-Straus | **PROVED** ✅ |
| Rs stabilizes | Shifted sum | ∑1/aₖ = ∑1/(bₖ+1) | **OPEN** ❓ |

### The Asymmetry (Why One Case is Hard)
When R₁ stabilizes: aₖ satisfies the Sylvester recurrence a_{k+1} = a_k²-a_k+1.
Erdős-Straus directly proves ∑1/(aₖ-1) irrational. ✅

When Rs stabilizes: bₖ = aₖ-1 satisfies Sylvester. Erdős-Straus proves ∑1/(bₖ-1) = ∑1/(aₖ-2) irrational.
But we need ∑1/aₖ = ∑1/(bₖ+1) irrational. The "+1 → +1" vs "-1" shift breaks the telescoping identity ∏bₖ = b_{N+1}-1 that ES relies on. ❌

## The Precise Remaining Question

> **Is f(2) irrational, where f(x) = 1/(x+1) + f(x²-x+1)?**
>
> Equivalently: is ∑ 1/(bₖ+1) irrational for Sylvester bₖ = 2, 3, 7, 43, 1807, ...?
>
> Equivalently: is ∏(1 + 1/bₖ) irrational?
>
> Numerically: f(2) ≈ 0.731614009830579...

## Failed Approaches (Total: 7)

| # | Strategy | Fatal flaw |
|---|----------|-----------|
| 1 | Monolithic proof | Can't isolate components |
| 2 | R₁ strict decrease | R₁ can plateau at constant > 0 |
| 3 | Running sum contraction | Greedy phases recover the loss |
| 4 | Pure Diophantine squeeze | C(N) doesn't converge to constant |
| 5 | Bounded greedy runs via C(N) | Large integers aren't contradictions |
| 6 | Deviation cost drives L→0 | Sparse deviations have finite total cost |
| 7 | Irrationality measure | Bound goes wrong way (tail >> 1/q^μ) |

## Key Observations
- Deviations from Sylvester can only go UPWARD (downward = greedy = terminates sequence)
- Rs locks at a constant after finitely many steps (verified computationally for S₂=169/100, 5/3, 1691/1000)
- When Rs locks at C: aₖ = q₂·P₂(k)/C + 2, a Sylvester-type recurrence for bₖ=aₖ-1
- The Mahler functional equation f(x) = 1/(x+1) + f(x²-x+1) uses non-standard substitution; standard Nishioka theorem requires |x| < 1 but we need x = 2

## Computational Tools Created
- `e265.c`: GMP integer-only simulation, single-constraint (fast, 30+ steps)
- `e265d.c`: GMP dual-constraint simulation showing which constraint binds at each step
- `erdos265_sim.c`: Original GMP simulation with fraction tracking (slower)
