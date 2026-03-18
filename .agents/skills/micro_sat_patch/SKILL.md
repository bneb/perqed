---
description: When to apply Micro-SAT Patch surgery on SA sterile basins (E ≤ 15)
---

# Micro-SAT Patch Skill

## When to Use

Apply this skill when the Research Journal contains **failure_mode entries with
`bestEnergy ≤ 15`** — evidence that SA workers are hitting a "glass floor" where
local 2-edge swaps cannot untangle the remaining K_r and K̄_s violations.

Key signals in the journal or SA telemetry:
- Repeated scatter events at low energy (E=10–15)
- Z3 LNS returning UNSAT on large neighborhoods
- High tabu hash accumulation at the same energy levels

## What It Does

When a worker's sterile basin scatter fires with `bestEnergy ≤ microSatThreshold`:

1. **HotZoneExtractor** computes a heat-map of each vertex's violation participation
   count and selects the top-H most entangled vertices (default H=10).

2. **MicroSATPatcher** freezes all cold-zone (low-heat) vertex pairs as boolean
   constants, declares hot-zone edges as Z3 Boolean variables, and runs an exact
   SMT solve over the combined graph.

3. **If SAT**: The repaired E=0 adjacency matrix is the R(r,s) witness.
   All workers are terminated.

4. **If UNSAT**: The cold-zone geometry is mathematically toxic. `nukeScaffold`
   scrambles ~20% of frozen cold-zone edges to destroy the doomed topology, then
   SA continues from the disrupted scaffold.

5. **If skipped** (hot zone > H vertices): the sub-problem is too large for instant
   SMT. The worker scatters normally.

## Variable Count

For R(4,6) on N=35 with H=10 hot vertices:
- Hot-to-hot edges: C(10,2) = 45 variables
- Hot-to-cold edges: 10 × 25 = 250 variables
- **Total: 295 Z3 Boolean variables** — well within instant SMT range

## How to Enable

In the DAG search node configuration, set:

```json
{
  "kind": "search",
  "micro_sat": {
    "enabled": true,
    "threshold": 15
  }
}
```

This sets `microSatThreshold: 15` on the `OrchestratedSearchConfig`, which flows
through to every SA worker.

## When NOT to Use

- **E > 15**: The hot zone will trivially contain all N vertices (entire graph is
  violated). MicroSAT returns `skipped`. Use standard LNS instead.
- **Small problems** (N < 10): SA finds E=0 directly. No surgery needed.
- **Circulant-only runs**: The full circulant space can be UNSAT'd by Z3 directly;
  no need for the hot-zone approximation.

## Relationship to LNS

| | LNS | Micro-SAT Patch |
|---|---|---|
| Trigger | After SA budget exhausted | Mid-run, at each scatter event |
| Scope | Edge neighborhood of violations | Vertex-ranked hot zone (top-H) |
| Free vars | ~5% edges + violating edges | All pairs incident to hot vertices |
| UNSAT response | Record hash, advance budget | `nukeScaffold` cold zone, continue |
