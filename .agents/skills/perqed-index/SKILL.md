---
description: Top-level index of the Perqed computational math pipeline — reusable components, skills, workflows, and project patterns
---

# Perqed Infrastructure Index

Perqed is a computational math pipeline: **SA search → witness → Lean 4 proof**.

## Core Library (`src/math/graph/`)

| Module | Purpose | Key API |
|--------|---------|---------|
| [AdjacencyMatrix.ts](file:///Users/kevin/projects/perqed/src/math/graph/AdjacencyMatrix.ts) | Flat Int8Array graph representation | `randomRegular(n,k)`, `addEdge`, `removeEdge`, `neighbors`, `clone`, `.raw` |
| [IncrementalSRGEngine.ts](file:///Users/kevin/projects/perqed/src/math/graph/IncrementalSRGEngine.ts) | O(k) path-based CN delta engine | `proposeRandomSwap()`, `commitSwap()`, `discardSwap()`, `getTriangleCount()`, `getProposedTriangleDelta()`, `freezeEdge()` |
| [SRGEnergy.ts](file:///Users/kevin/projects/perqed/src/math/graph/SRGEnergy.ts) | Frobenius norm of A² − λA − μ(J−I) − kI | `srgEnergy()`, `srgEnergyAlgebraic()` |
| [DegreePreservingSwap.ts](file:///Users/kevin/projects/perqed/src/math/graph/DegreePreservingSwap.ts) | 2-edge swap preserving regularity | `degreePreservingSwap()` |

### Performance Characteristics (Apple M4)

- Single-core: ~500K proposals/sec (99 vertices, k=14)
- Multi-core (10 workers): ~3.2M aggregate IPS
- Triangle tracking: zero overhead (piggybacks on CN cache)
- Frozen anchor: slight IPS increase (fewer wasted attempts)

## Multi-Core Orchestrator (`projects/conway99/src/`)

| File | Purpose |
|------|---------|
| `conway99_worker.ts` | Configurable SA island (accepts v, k, λ, μ, targetTriangles) |
| `conway99_orchestrator.ts` | Spawns N workers, live dashboard, state persistence. `--spec` flag loads problem specs |
| `conway99_orchestrator_state.ts` | Global best tracking, disk persistence, IPS aggregation |

## Skills (`.agents/skills/`)

| Skill | Use When |
|-------|----------|
| `graph-witness-search` | Formulating a new graph existence problem as SA search |
| `lean-finite-graph` | Writing Lean 4 proofs for finite graph properties via `decide` |
| `srg-parameters` | Looking up open SRG existence questions |

## Workflows (`.agents/workflows/`)

| Workflow | Use When |
|----------|----------|
| `/new-project` | Starting a new proof project |
| `/sa-search` | Running a Simulated Annealing search |
| `/lean-verify` | Compiling and verifying a Lean 4 proof |
| `/archive-project` | Archiving a completed project |

## Test Suite

42 tests across 5 files. Run with `bun test`.

| Test File | Coverage |
|-----------|----------|
| `tests/graph_layer.test.ts` | AdjacencyMatrix, commonNeighborCount, srgEnergy, degreePreservingSwap |
| `tests/incremental_srg.test.ts` | IncrementalSRGEngine correctness (10K swap fuzz) |
| `tests/hot_loop_api.test.ts` | Zero-allocation propose/commit/discard API |
| `tests/cn_delta.test.ts` | CN cache integrity (5K commit fuzz) |
| `tests/triangle_tracker.test.ts` | O(k) triangle tracking (10K commit fuzz vs naive) |

## Completed Projects

| Project | Result | Path |
|---------|--------|------|
| Erdős-Gyárfás n=4 | Proved (4-cycle in min-deg-3 graphs) | `projects/erdos-gyarfas/` |
| Torus Decomposition | Proved (m=4, m=6 Knuth torus) | `projects/torus-decomposition/` |
| Conway 99 | Paused at E≈4000 (SA floor) | `projects/conway99/` |

## Key Lessons from Conway 99

1. SA with 2-edge swaps hits a hard energy floor regardless of energy function
2. Triangle penalty controls spectral moments but doesn't break the floor
3. Frozen anchor eliminates isomorphic paths with zero IPS cost
4. Larger move operators (3-edge, 4-edge) needed for hard landscapes
5. Calibrate on known instances before attacking open problems
