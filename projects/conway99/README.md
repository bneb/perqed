# Conway's 99-Graph Problem

> **Status: Active** — Searching for SRG(99, 14, 1, 2).

## The Problem

*Does there exist a strongly regular graph with parameters (99, 14, 1, 2)?*

This means a 99-vertex graph where:
- Every vertex has degree 14
- Every edge has exactly 1 common neighbor (λ=1)
- Every non-edge has exactly 2 common neighbors (μ=2)

John Horton Conway offered a $1,000 prize for its construction or disproof in 2014.

## Approach

- **SA search** with degree-preserving edge swaps on random 14-regular graphs
- **Energy function**: Σ (common_neighbors − λ)² for edges + Σ (common_neighbors − μ)² for non-edges
- **Lean 4 verification** if a witness is found: symmetry, regularity, λ/μ via `decide`

## Running

```bash
bun run projects/conway99/src/conway99_hunt.ts         # 10 restarts × 1M iters
bun run projects/conway99/src/conway99_hunt.ts 50 5000000  # 50 restarts × 5M iters
```
