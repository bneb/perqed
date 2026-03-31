---
description: Top-level index of the Perqed computational math pipeline — reusable components, skills, workflows, and project patterns
---

# Perqed Infrastructure Index

Perqed is a computational math pipeline: **prompt → ARCHITECT → auto-detect ∃ → SA search → Lean 4 proof → LaTeX + PDF**.

## Autonomous Pipeline (`src/cli/perqed.ts`)

```
./perqed --prompt="R(4,5) >= 25" --noconfirm
```

| Step | Component | What |
|------|-----------|------|
| 1. Formulate | ARCHITECT (Gemini) | Math-only: theorem_name, signature, objective |
| 2. Detect | `witness_detector.ts` | `isConstructiveExistence()` checks for ∃ |
| 3. Classify | `witness_detector.ts` | `classifyProblem()` extracts type + params |
| 4. Search | `ramsey_orchestrator.ts` | SA with strategy menu, escalation loop |
| 5. Prove | `proof_registry.ts` | Lean + LaTeX + PDF via `tectonic` |

## Core Library (`src/math/graph/`)

| Module | Purpose | Key API |
|--------|---------|---------|
| [AdjacencyMatrix.ts](file:///Users/kevin/projects/perqed/src/math/graph/AdjacencyMatrix.ts) | Flat Int8Array graph representation | `randomRegular(n,k)`, `addEdge`, `removeEdge`, `neighbors`, `clone`, `.raw` |
| [IncrementalSRGEngine.ts](file:///Users/kevin/projects/perqed/src/math/graph/IncrementalSRGEngine.ts) | O(k) path-based CN delta engine | `proposeRandomSwap()`, `commitSwap()`, `discardSwap()`, `getTriangleCount()`, `getProposedTriangleDelta()`, `freezeEdge()` |
| [SRGEnergy.ts](file:///Users/kevin/projects/perqed/src/math/graph/SRGEnergy.ts) | Frobenius norm of A² − λA − μ(J−I) − kI | `srgEnergy()`, `srgEnergyAlgebraic()` |
| [DegreePreservingSwap.ts](file:///Users/kevin/projects/perqed/src/math/graph/DegreePreservingSwap.ts) | 2-edge swap preserving regularity | `degreePreservingSwap()` |
| [GraphSeeds.ts](file:///Users/kevin/projects/perqed/src/math/graph/GraphSeeds.ts) | Paley, circulant, perturbed graphs | `paleyGraph(p)`, `circulantGraph(n, conns)`, `perturbGraph(g, k)` |

### Performance Characteristics (Apple M4)

- Single-core: ~500K proposals/sec (99 vertices, k=14), ~2.8M IPS (Ramsey, 17 vertices)
- Multi-core (10 workers): ~3.2M aggregate IPS
- Triangle tracking: zero overhead (piggybacks on CN cache)

## Search Engine (`src/search/`)

| Module | Purpose |
|--------|---------|
| `ramsey_worker.ts` | SA worker with adaptive reheat |
| `ramsey_orchestrator.ts` | Multi-worker dispatch, island model, seeding |
| `witness_detector.ts` | ∃ detection, problem classification, config extraction |
| `proof_registry.ts` | ProofGenerator registry (Lean + LaTeX) |
| `search_failure_digest.ts` | Failure diagnosis (4 modes) + pivot recommendations |

## Skills (`.agents/skills/`)

| Skill | Use When |
|-------|----------|
| `graph-witness-search` | Formulating a new graph existence problem as SA search |
| `latex-compilation` | Compiling LaTeX papers to PDF using Tectonic (do not use pdflatex) |
| `lean-finite-graph` | Writing Lean 4 proofs for finite graph properties via `native_decide` |
| `srg-parameters` | Looking up open SRG existence questions |

## Workflows (`.agents/workflows/`)

| Workflow | Use When |
|----------|----------|
| `/new-project` | Starting a new proof project |
| `/sa-search` | Running a Simulated Annealing search |
| `/lean-verify` | Compiling and verifying a Lean 4 proof |
| `/archive-project` | Archiving a completed project |

## Test Suite

70 tests across 6 files. Run with `bun test`.

| Test File | Coverage |
|-----------|----------|
| `tests/ramsey_energy.test.ts` | Cliques, independent sets, energy delta fuzz (17 tests) |
| `tests/strategy_menu.test.ts` | Paley, circulant, orchestrator (16 tests) |
| `tests/witness_detector.test.ts` | ∃ detection, classification, NL patterns (14 tests) |
| `tests/search_escalation.test.ts` | Failure digest, diagnosis (12 tests) |
| `tests/proof_registry.test.ts` | Registry, Lean codegen, LaTeX (11 tests) |
| `tests/graph_layer.test.ts` | AdjacencyMatrix, CN, SRG energy |
| `tests/incremental_srg.test.ts` | IncrementalSRGEngine (10K swap fuzz) |

## Verified Results

| Problem | Time | Method |
|---------|------|--------|
| R(3,3) ≥ 6 | 2.9s | Auto-detect → SA → Lean |
| R(4,4) ≥ 18 | 5.9s | Auto-detect → SA → Lean |
| R(4,5) ≥ 25 | 44.2s | Auto-detect → SA → Lean |

## Agent Sandbox Pattern

**DO NOT build directly in `src/` or `projects/`.** Use the sandbox:

```
agent_workspace/runs/<run-id>/
├── objective.md          # What to prove/find
├── scratch/              # Working scripts, experiments, temp files
├── verified_lib/         # Lean proofs + LaTeX + PDF (once verified)
├── lab_log.md            # Running log of attempts and results
└── domain_skills/        # Problem-specific reference material
```

### Rules
1. **All new code goes in `agent_workspace/runs/<run-id>/`** — never pollute `src/` or `projects/`
2. Import from `src/math/graph/` to reuse the core library (use relative paths)
3. Write tests in `scratch/` — they won't interfere with the main `bun test` suite
4. When a run produces a verified result, the **user** promotes it via `/archive-project`
5. Use `lab_log.md` to record every experiment, hypothesis, and result
