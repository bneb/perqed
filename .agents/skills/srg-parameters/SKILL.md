---
description: Reference table of open strongly regular graph existence problems
---

# Open SRG Existence Problems

## Background

A strongly regular graph SRG(n, k, λ, μ) is a k-regular graph on n vertices where:
- Every pair of adjacent vertices has exactly λ common neighbors
- Every pair of non-adjacent vertices has exactly μ common neighbors

Finding or disproving specific SRGs is a major open area in algebraic graph theory.

## Using Our System

All SRG problems have the same energy function:

```typescript
import { srgEnergy } from "../src/math/graph/SRGEnergy";

// Just change the parameters:
const energy = srgEnergy(graph, k, lambda, mu);
```

E = 0 iff the graph is the target SRG. The SA engine, edge swap mutator, and Lean verification template are fully reusable.

## Open Problems (Feasibility-Ranked)

### High Priority (good SA targets)

| Parameters | Status | Search Space | Notes |
|-----------|--------|-------------|-------|
| SRG(99, 14, 1, 2) | **OPEN** — Conway's $1,000 prize | ~10^132 | Active project |
| SRG(65, 32, 15, 16) | Open | ~10^600 | Needs symmetry reduction |
| SRG(85, 14, 3, 2) | Open | ~10^900 | Related to 99-graph |

### Known SRGs (test fixtures)

| Parameters | Name | Use as |
|-----------|------|--------|
| SRG(9, 4, 1, 2) | Rook graph R(3,3) | Test fixture (E=0 validation) |
| SRG(10, 3, 0, 1) | Petersen graph | Test fixture |
| SRG(16, 6, 2, 2) | Shrikhande graph | Test fixture |
| SRG(243, 22, 1, 2) | Berlekamp–van Lint–Seidel | Same λ,μ as Conway 99 |

## References

- Brouwer's table of SRG parameters: https://www.win.tue.nl/~aeb/graphs/srg/srgtab.html
- Conway's original problem statement (2014)
- Spence's database of known SRGs
