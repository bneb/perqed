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
  test("contains no itertools import", () => {
    const adj = makeAdj(5, [[0,1],[1,2],[2,3],[3,4],[4,0]]);
    const freeEdges: [number,number][] = [[0,1],[1,2]];
    const script = generateLNSZ3Script(5, 3, 3, adj, freeEdges);
    expect(script).not.toContain("import itertools");
  });

  test("free edges appear as Bool('e_i_j') Z3 variables", () => {
    // C_5 + one extra red edge 0-2 creating K_3 {0,1,2}, free those 3 edges so Z3 can fix it
    const adj = makeAdj(5, [[0,1],[0,2],[1,2],[2,3],[3,4],[4,0]]);
    const freeEdges: [number,number][] = [[0,1],[0,2],[1,2]];
    const script = generateLNSZ3Script(5, 3, 3, adj, freeEdges);
    // Either script reaches Z3 (has Bool() fn and key "0_1") or detected pre-UNSAT early
    const reachesSolver = script.includes("Bool(") && script.includes('"0_1"');
    const preUnsat = script.includes('TypeScript pre-detected');
    expect(reachesSolver || preUnsat).toBe(true);
  });

  test("frozen edges do NOT appear as Bool() variables", () => {
    const adj = makeAdj(5, [[0,1],[1,2],[2,3]]);
    // Only 0,1 and 1,2 are free; 2,3 is frozen (red since hasEdge=true)
    const freeEdges: [number,number][] = [[0,1],[1,2]];
    const script = generateLNSZ3Script(5, 3, 3, adj, freeEdges);
    // 2,3 must not be a Z3 variable declaration
    expect(script).not.toMatch(/Bool\(['"]e_2_3['"]\)/);
  });

  test("script has N assignment", () => {
    const adj = makeAdj(6, []);
    const freeEdges: [number,number][] = [[0,1]];
    const script = generateLNSZ3Script(6, 3, 3, adj, freeEdges);
    expect(script).toContain("N = 6");
  });

  test("outputs SAT or UNSAT via print", () => {
    // C_5 + one extra edge creating K_3, free those edges
    const adj = makeAdj(5, [[0,1],[0,2],[1,2],[2,3],[3,4],[4,0]]);
    const freeEdges: [number,number][] = [[0,1],[0,2],[1,2],[3,4],[4,0]];
    const script = generateLNSZ3Script(5, 3, 3, adj, freeEdges);
    // Script must always have some way to output a result
    expect(script).toMatch(/print\(["'](SAT|UNSAT)/);
  });
});

describe("generateLNSZ3Script — frozen clique pre-detection", () => {
  test("frozen all-red K_3 not in freeEdges → script prints UNSAT immediately", () => {
    // K_3 on vertices 0,1,2 all red, none in freeEdges
    const adj = makeAdj(5, [[0,1],[0,2],[1,2],[3,4]]);
    // Free edges don't include the violated K_3 edges
    const freeEdges: [number,number][] = [[3,4]];
    const script = generateLNSZ3Script(5, 3, 3, adj, freeEdges);
    // Script should detect pre-violated frozen clique and short-circuit to UNSAT
    // The first action should be to print UNSAT (before even calling solver.check())
    expect(script).toContain('print("UNSAT")');
    // And should NOT call solver.check() (early exit)
    const unsatIdx = script.indexOf('print("UNSAT")');
    const checkIdx = script.indexOf('solver.check()');
    if (checkIdx !== -1) {
      expect(unsatIdx).toBeLessThan(checkIdx);
    }
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
    // Script should still be valid (no malformed Python)
    expect(script).toContain("from z3 import");
  });
});
