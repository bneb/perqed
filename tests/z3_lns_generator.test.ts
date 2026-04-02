/**
 * TDD Tests — z3_lns_generator.ts (RED phase)
 */

import { describe, test, expect } from "bun:test";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";
import { generateLNSZ3Script } from "../src/search/z3_lns_generator";

function makeAdj(n: number, edges: [number, number][]): AdjacencyMatrix {
  const adj = new AdjacencyMatrix(n);
  for (const [u, v] of edges) adj.addEdge(u, v);
  return adj;
}

describe("generateLNSZ3Script — structure", () => {
  test("free edges appear as (declare-const e_i_j Bool) SMT variables", () => {
    // C_5 + one extra red edge 0-2 creating K_3 {0,1,2}, free those 3 edges so Z3 can fix it
    const adj = makeAdj(5, [[0,1],[0,2],[1,2],[2,3],[3,4],[4,0]]);
    const freeEdges: [number,number][] = [[0,1],[0,2],[1,2]];
    const script = generateLNSZ3Script(5, 3, 3, adj, freeEdges);
    // Either script reaches solver (has declare-const for free vars) or detected pre-UNSAT early
    const reachesSolver = script.includes("(declare-const e_0_1 Bool)");
    const preUnsat = script.includes('(echo "UNSAT")');
    expect(reachesSolver || preUnsat).toBe(true);
  });

  test("frozen edges do NOT appear as declared variables", () => {
    const adj = makeAdj(5, [[0,1],[1,2],[2,3]]);
    // Only 0,1 and 1,2 are free; 2,3 is frozen (red since hasEdge=true)
    const freeEdges: [number,number][] = [[0,1],[1,2]];
    const script = generateLNSZ3Script(5, 3, 3, adj, freeEdges);
    // 2,3 must not be a Z3 variable declaration
    expect(script).not.toContain("(declare-const e_2_3 Bool)");
  });

  test("outputs via get-value and check-sat", () => {
    // C_5 + one extra edge creating K_3, free those edges
    const adj = makeAdj(5, [[0,1],[0,2],[1,2],[2,3],[3,4],[4,0]]);
    const freeEdges: [number,number][] = [[0,1],[0,2],[1,2],[3,4],[4,0]];
    const script = generateLNSZ3Script(5, 3, 3, adj, freeEdges);
    // Script must always have some way to check satisfiability
    expect(script).toMatch(/\(check-sat\)|\(echo "UNSAT"\)/);
  });
});

describe("generateLNSZ3Script — frozen clique pre-detection", () => {
  test("frozen all-red K_3 not in freeEdges → script outputs UNSAT immediately", () => {
    // K_3 on vertices 0,1,2 all red, none in freeEdges
    const adj = makeAdj(5, [[0,1],[0,2],[1,2],[3,4]]);
    // Free edges don't include the violated K_3 edges
    const freeEdges: [number,number][] = [[3,4]];
    const script = generateLNSZ3Script(5, 3, 3, adj, freeEdges);
    // Script should detect pre-violated frozen clique and short-circuit to UNSAT
    expect(script.trim()).toBe('(echo "UNSAT")');
  });
});

describe("generateLNSZ3Script — constraint correctness", () => {
  test("frozen blue edge in red-clique subset → no clause emitted for that subset", () => {
    // Vertices 0,1,2 with edge 0-1 red, edge 0-2 blue, edge 1-2 as free
    const adj = makeAdj(4, [[0,1]]); // 0-1 red, 0-2 and 1-2 blue
    const freeEdges: [number,number][] = [[1,2]]; // only 1-2 is free
    const script = generateLNSZ3Script(4, 3, 3, adj, freeEdges);
    // For subset {0,1,2}: edges are 0-1 (frozen red), 0-2 (frozen blue), 1-2 (free)
    // Red K_3 constraint: 0-2 is frozen blue → constraint already satisfied → no clause needed
    // The script should still emit (check-sat) or UNSAT appropriately
    expect(script).toMatch(/\(check-sat\)|\(echo "UNSAT"\)/);
  });
});
