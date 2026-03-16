---
description: How to use LNS (Large Neighborhood Search) with Z3 as an exact finisher for graph search problems in Perqed
---

# LNS + Z3 Hybrid Solver Skill

## When to Use

Use LNS when:
- SA has **stalled** at a non-zero energy floor (typically E=12–20) across multiple workers
- The **ResearchJournal** shows a consistent glass floor observation
- The problem has a small enough constraint graph that Z3 can exactly solve the conflict neighborhood (N ≤ 40)

LNS is **intermediate** between SA (macroscopic, heuristic) and full Z3 (exact, but only for constrained spaces). Use it when full Z3 is too slow (2^N states) but SA can't cross the energy barrier.

## How It Works

```
SA finds best graph (E > 0)
        │
        ▼
extractViolatingEdges() ─── finds all edges in monochromatic cliques
        │
        ▼
extractLNSNeighborhood() ── adds ~5% random clean edges for breathing room
        │
        ▼
generateLNSZ3Script() ──── TypeScript precomputes clauses (no Python itertools!)
                           Frozen edges → Python boolean literals
                           Free edges  → Z3 Bool() variables
        │
        ▼
Z3 CDCL engine ─────────── exact solve of the free sub-graph
        │
      SAT: witness found → skip remaining SA attempts
      UNSAT: basin is irrecoverable → record failure_mode, SA reheat
```

## Invoking LNS

LNS is **automatically triggered** in perqed.ts when SA returns `bestEnergy ≤ lns_energy_threshold`. The ARCHITECT can control this threshold via `search_config`:

```json
{
  "problem_class": "ramsey_coloring",
  "domain_size": 35,
  "r": 4, "s": 6,
  "lns_energy_threshold": 15,
  "lns_extra_free_percent": 0.08
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `lns_energy_threshold` | number | 20 | Max E to trigger LNS repair |
| `lns_extra_free_percent` | number | 0.05 | Extra random edges added for breathing room |

## The Constraint Filter — Critical Design Note

The Z3 clause generation in `z3_lns_generator.ts` **short-circuits correctly**:

- **Frozen blue edge in red-clique subset** → constraint already satisfied → skip clause
- **Frozen red edge in blue-clique subset** → constraint already satisfied → skip clause
- **All-frozen violated clique** → emit `print("UNSAT")` before calling Z3 (no subprocess needed)
- **Mixed free+frozen subset with at least one free edge** → emit Z3 clause over free vars only

**Never** use `Or([Not(e) for e in edges if is_expr(e) or e == True])` — the `if` filter silently drops `False` constants, generating empty `Or([])` clauses that spuriously return UNSAT.

## Result Handling

```typescript
const result = await runLNS(adj, N, r, s, opts);

if (result.status === 'sat')     // → witness with ramseyEnergy(result.adj, r, s) == 0
if (result.status === 'unsat')   // → record failure_mode in journal; SA reheat
if (result.status === 'timeout') // → SA continues (no journal entry — timeout ≠ UNSAT)
if (result.status === 'error')   // → log and continue
```

## Files

- `src/search/lns_extractor.ts` — violating edge extraction + neighborhood building
- `src/search/z3_lns_generator.ts` — TypeScript clause precomputation + Python script gen
- `src/search/lns_solver.ts` — process orchestration, output parsing, AdjacencyMatrix reconstruction
- `tests/lns_extractor.test.ts`, `tests/z3_lns_generator.test.ts`, `tests/lns_solver.test.ts` — TDD tests

## Performance Notes

- Z3 script generation (TypeScript precomputation): O(C(N,r) + C(N,s)) TypeScript ops
  - N=35 r=4: C(35,4)=52,360; N=35 s=6: C(35,6)=1,623,160 ≈ 1.7M iterations in TypeScript (~50ms)
- Z3 solve time: variable; Z3 CDCL is very fast for small free neighborhoods (≤100 edges)
- Pre-UNSAT detection in TypeScript: O(C(N, max(r,s))) but returns early when found
