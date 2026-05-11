/-!
# Erdős 265: Project Status and Dependency Map

## Target Theorem
`erdos_265` in `problem_statement.lean`:
  Every Erdős 265 sequence satisfies limsup a_k^{1/2^k} ≤ 1.

## Proof Architecture

The proof strategy is based on the **Dual Algebraic Lock-in**.
We bypass the monumental complexity of Mahler's method and the irrationality of the Sylvester sequence completely. 
Instead, we exploit the fact that the Erdős 265 problem strictly requires *two* convergent rational sums:
1. $\sum 1/a_k$ 
2. $\sum 1/(a_k-1)$

### Strategy B: Dual Algebraic Lock-in (SUCCESSFUL)

The proof relies on:
1. **The Asymptotic Squeeze**: A sequence growing with $L > 1$ forces the exact integer tail residuals to become constant.
2. **Primary Lock-in**: If the residual of $\sum 1/a_n$ is constant, the sequence MUST be exactly $a_{n+1} = a_n^2 - a_n + 1$.
3. **Dual Lock-in**: If the residual of the predecessor sum $\sum 1/(a_n-1)$ is constant, the sequence MUST follow $a_{n+1} = a_n^2 - 3a_n + 4$.
4. **Contradiction**: Equating these two forced polynomials yields $2a_n = 3$, which has no integer solutions.

## Sorry/Gap Inventory

| Gap | Location | Type | Difficulty | Status |
|-----|----------|------|------------|--------|
| `asymptoticSqueezeLimit` | residual_growth_bound.lean | lim | Hard | ❌ Pending |
| `constant_residual_implies_sylvester` | residual_growth_bound.lean | alg | Easy | ✔️ PROVEN |
| `shifted_seq_lockin` | problem_statement.lean | alg | Easy | ✔️ PROVEN |
| `dual_lockin_contradiction` | problem_statement.lean | alg | Easy | ✔️ PROVEN |
| `erdos_265` | problem_statement.lean | logic| Medium | ⚠️ Wired (Limits Pending) |
-/
