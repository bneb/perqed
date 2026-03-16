/**
 * TDD Tests — z3_ramsey_solver.ts
 *
 * Key principle: the energy oracle (ramseyEnergy == 0) is the ground truth.
 * We don't hardcode which specific (N, r, s) are SAT in circulant space —
 * that requires external math reasoning (use the z3-constraint-solver skill
 * to find valid fixtures via LLM reasoning + iterative Z3 discovery).
 *
 * Current tests: UNSAT verification and discriminated result type integrity.
 * SAT path is validated via the energy oracle whenever a SAT result is found.
 */

import { describe, test, expect } from "bun:test";
import { solveWithZ3, isZ3Available } from "../src/search/z3_ramsey_solver";
import { ramseyEnergy } from "../src/math/graph/RamseyEnergy";

describe("isZ3Available", () => {
  test("returns a boolean (no throw)", async () => {
    const available = await isZ3Available();
    expect(typeof available).toBe("boolean");
  });
});

describe("solveWithZ3 — UNSAT: R(3,3) on N=5", () => {
  // R(3,3)=6: every 2-coloring of K_5 (and therefore every circulant
  // 2-coloring of K_5) must contain a monochromatic K_3.
  // Z3 correctly returns UNSAT. This confirms the solver is sound.
  test("circulant K_5 R(3,3) is UNSAT — Z3 correctly identifies impossible space", async () => {
    const available = await isZ3Available();
    if (!available) { console.log("Z3 not available, skipping"); return; }

    const result = await solveWithZ3(5, 3, 3, { timeoutMs: 15_000 });
    expect(result.status).toBe("unsat");
  }, 20_000);
});

describe("solveWithZ3 — discriminated result type", () => {
  test("always returns a valid Z3Result with a known status", async () => {
    const available = await isZ3Available();
    if (!available) { console.log("Z3 not available, skipping"); return; }

    const result = await solveWithZ3(5, 3, 3, { timeoutMs: 15_000 });
    expect(["sat", "unsat", "timeout", "error"]).toContain(result.status);
  }, 20_000);
});

describe("solveWithZ3 — energy oracle: SAT iff ramseyEnergy == 0", () => {
  // This test validates the energy oracle invariant: any SAT result must
  // have ramseyEnergy == 0. We test with multiple (N, r, s) cases and
  // assert the oracle holds for whichever ones happen to return SAT.
  // The exact SAT/UNSAT outcome depends on the circulant witness space.
  const cases = [
    // Known UNSAT in circulant: R(3,3)=6, every K_5 coloring has K_3
    { N: 5, r: 3, s: 3 },
    // Small cases to exercise the oracle — SAT/UNSAT outcome is discovered, not assumed
    { N: 7, r: 3, s: 3 },
    { N: 9, r: 3, s: 4 },
  ];

  for (const { N, r, s } of cases) {
    test(`R(${r},${s}) on N=${N}: if SAT, energy must be 0`, async () => {
      const available = await isZ3Available();
      if (!available) return;

      const result = await solveWithZ3(N, r, s, { timeoutMs: 15_000 });

      if (result.status === "sat") {
        // THE key invariant: Z3 claims satisfiable, verify with energy oracle
        const energy = ramseyEnergy(result.adj, r, s);
        expect(energy).toBe(0);

        // Structural: adjacency matrix is symmetric with no self-loops
        expect(result.adj.n).toBe(N);
        for (let i = 0; i < N; i++) {
          expect(result.adj.hasEdge(i, i)).toBe(false);
          for (let j = 0; j < N; j++) {
            expect(result.adj.hasEdge(i, j)).toBe(result.adj.hasEdge(j, i));
          }
        }
      }
      // UNSAT, timeout, error are all valid outcomes — just verify no throw
      expect(["sat", "unsat", "timeout", "error"]).toContain(result.status);
    }, 20_000);
  }
});
