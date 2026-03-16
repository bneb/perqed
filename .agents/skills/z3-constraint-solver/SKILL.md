---
description: How to use Z3 SMT as an exact constraint solver for combinatorial witness search in Perqed
---

# Z3 Constraint Solver Skill

## When to Use

Use Z3 as the **primary solver** when:
- The search space is constrained (e.g., circulant symmetry) and small (≤ 2^20 states)
- You need an **exact answer** — SA can hit glass floors; Z3 is complete
- You want to distinguish SAT (witness exists) vs. UNSAT (space is provably empty)

## Architecture

### The Two-Phase Pattern

The key design principle: **do all combinatorial computation in TypeScript, pass data to Python.**

```
TypeScript (fast, type-safe)          Python/Z3 (exact solver)
─────────────────────────────         ──────────────────────────
buildDistanceClauses(N, r)    ──JS array literal──>  solver.add(clauses)
buildDistanceClauses(N, s)    ──JS array literal──>  solver.check()
generateRamseyZ3Script(N,r,s)  ──Python string──>    stdout: SAT:{bits}
```

**Never iterate C(N,k) in Python** — for R(4,6), C(35,6) = 1.6M iterations is too slow.
All clause generation happens in TypeScript via `buildDistanceClauses`, deduplicated
using a `Set<string>` on the sorted distance pattern. The Python script receives inline arrays.

### Deduplication Principle

For circulant constraints, many vertex k-subsets share the same set of pairwise distances.
Deduplicating on the distance-set (not vertex-tuple) is mathematically correct:

```typescript
const distSet = new Set<number>(); // pairwise distances for this k-subset
// Two vertex-tuples with identical distSet → identical Z3 clause
```

## Implementing a New Z3 Script Generator

```typescript
export function generateZ3Script(N: number, constraints: number[][]): string {
  const clauses = precomputeClauses(N, constraints); // TypeScript
  return `from z3 import *
solver = Solver()
for clause in ${JSON.stringify(clauses)}:
    solver.add(clause_to_z3(clause))
print("SAT:" + extract_model() if solver.check() == sat else "UNSAT")
`;
}
```

## Discriminated Result Type

Always return a discriminated union — never use `null` for multiple failure modes:

```typescript
type Z3Result =
  | { status: 'sat';     adj: AdjacencyMatrix; distanceBits: string; solveTimeMs: number }
  | { status: 'unsat' }
  | { status: 'timeout' }
  | { status: 'error';   message: string }
```

- `sat` → witness found, verified with ramseyEnergy == 0
- `unsat` → space is provably empty (mathematical fact, not a failure)
- `timeout` → solver ran out of time, NOT the same as unsat — SAT may still exist
- `error` → process/parse failure, treat as unknown

## Finding Valid Test Fixtures (Using LLM Reasoning)

⚠️ **Do not guess test fixtures using domain knowledge.**
The circulant witness space is not the same as the general Ramsey space:
`R(r,s) >= n` (general) does NOT imply a circulant witness exists on N=n-1.

**The correct approach** — ask an LLM agent or enumerate:
1. Look up known **circulant** Ramsey witnesses in the literature (not just general witnesses)
2. Or run Z3 iteratively on small (N, r, s) values and record which are SAT:
   ```bash
   for N in $(seq 5 20); do
     bun -e "import {solveWithZ3} from './src/search/z3_ramsey_solver';
             solveWithZ3($N, 3, 4).then(r => console.log($N, r.status))"
   done
   ```
3. Hardcode only confirmed SAT cases as fixtures

## Test Pattern

The ground truth oracle is always the energy function, never assumed outcome:

```typescript
test("Z3 energy oracle: SAT iff ramseyEnergy == 0", async () => {
  const result = await solveWithZ3(N, r, s);
  if (result.status === "sat") {
    expect(ramseyEnergy(result.adj, r, s)).toBe(0); // THE oracle
  }
  // UNSAT, timeout, error are all valid — just no crash
  expect(["sat", "unsat", "timeout", "error"]).toContain(result.status);
});
```

## Decision Flow in Perqed

```
symmetry === 'circulant'
  ↓
Z3 attempt (with timeout)
  ├── SAT     → witness + Lean proof generated, SA skipped entirely
  ├── UNSAT   → space is empty, strip circulant, retry with unconstrained SA
  ├── timeout → space may still have witnesses, fall back to SA
  └── error   → silent fallback to SA
```

## Files

- `src/search/z3_circulant_generator.ts` — TypeScript clause precomputation + Python/Z3 script generator
- `src/search/z3_ramsey_solver.ts` — process spawning, output parsing, AdjacencyMatrix reconstruction
- `tests/z3_generator.test.ts` — script generation unit tests
- `tests/z3_solver.test.ts` — integration tests with real Z3 (energy oracle pattern)
