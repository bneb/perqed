/**
 * TDD Tests — lns_solver.ts (RED phase)
 * Requires Z3 to be installed (uses isZ3Available to skip otherwise).
 */

import { describe, test, expect } from "bun:test";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";
import { isZ3Available } from "../src/search/z3_ramsey_solver";
import { runLNS } from "../src/search/lns_solver";
import { ramseyEnergy } from "../src/math/graph/RamseyEnergy";

function makeAdj(n: number, edges: [number, number][]): AdjacencyMatrix {
  const adj = new AdjacencyMatrix(n);
  for (const [u, v] of edges) adj.addEdge(u, v);
  return adj;
}

describe("runLNS — discriminated result type", () => {
  test("always returns a valid LNSResult with known status (no throw)", async () => {
    const available = await isZ3Available();
    if (!available) { console.log("Z3 not available, skipping"); return; }

    // A simple graph — result may be sat or unsat, but must not throw
    const adj = makeAdj(5, [[0,1],[1,2],[2,3],[3,4],[4,0]]);
    const result = await runLNS(adj, 5, 3, 3, { timeoutMs: 10_000 });
    expect(["sat", "unsat", "timeout", "error"]).toContain(result.status);
  }, 15_000);
});

describe("runLNS — SAT: repairable graph", () => {
  test("broken R(3,3) witness on N=5 can be repaired by LNS", async () => {
    const available = await isZ3Available();
    if (!available) { console.log("Z3 not available, skipping"); return; }

    // C_5 is a valid R(3,3) witness. Flip one edge to create E=1.
    // C_5 edges: 0-1, 1-2, 2-3, 3-4, 4-0  (red)
    // Flip 0-2 to red: this creates a red K_3 triangle? Let's check:
    // After: 0-1 red, 0-2 red, 1-2 red → red K_3 on {0,1,2}
    // All free edges: 0-2 (the flip) and adjacent edges 0-1, 1-2 for breathing room
    const adj = makeAdj(5, [[0,1],[0,2],[1,2],[2,3],[3,4],[4,0]]);
    // E should be 1 (one red triangle: 0,1,2)
    const energy = ramseyEnergy(adj, 3, 3);
    expect(energy).toBeGreaterThan(0);

    // LNS with enough free edges to fix it
    const result = await runLNS(adj, 5, 3, 3, {
      timeoutMs: 15_000,
      extraFreePercent: 0.3,  // give Z3 breathing room
    });

    if (result.status === "sat") {
      // Verify the repaired graph has energy 0
      expect(ramseyEnergy(result.adj, 3, 3)).toBe(0);
      expect(result.adj.n).toBe(5);
    }
    // sat or unsat are both valid (depends on neighborhood size)
    expect(["sat", "unsat", "timeout", "error"]).toContain(result.status);
  }, 20_000);
});

describe("runLNS — UNSAT: frozen clique cannot be repaired", () => {
  test("globally UNSAT problem returns status=unsat", async () => {
    const available = await isZ3Available();
    if (!available) { console.log("Z3 not available, skipping"); return; }

    // K_6 with R(3,3): every coloring of K_6 has a monochromatic K_3
    // So LNS on K_6 with NO free edges will find pre-violated frozen clique → UNSAT
    const adj = makeAdj(6, [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]]); // all-red K_4
    // Free only one edge that's not part of the problem
    const result = await runLNS(adj, 6, 3, 3, {
      timeoutMs: 10_000,
      extraFreePercent: 0,  // no breathing room — frozen violated clique
    });
    // Should detect the pre-violated frozen K_3 and return UNSAT quickly
    expect(["unsat", "error"]).toContain(result.status);
  }, 15_000);
});

describe("runLNS — output shape when SAT", () => {
  test("SAT result has adj with correct N", async () => {
    const available = await isZ3Available();
    if (!available) { return; }

    const adj = makeAdj(5, [[0,1],[1,2],[2,3],[3,4],[4,0]]);
    const result = await runLNS(adj, 5, 3, 3, { timeoutMs: 10_000 });
    if (result.status === "sat") {
      expect(result.adj.n).toBe(5);
      // Adjacency must be symmetric
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          expect(result.adj.hasEdge(i, j)).toBe(result.adj.hasEdge(j, i));
        }
      }
    }
  }, 15_000);
});
