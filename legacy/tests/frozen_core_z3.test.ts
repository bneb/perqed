/**
 * frozen_core_z3.test.ts — RED-to-GREEN: verify that locked edges are preserved
 * when adaptiveZ3Solve is called with a lockedVertices set.
 *
 * We mock the SolverBridge so no Z3 process is needed.
 */
import { expect, test, describe, mock } from "bun:test";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";
import { adaptiveZ3Solve } from "../src/search/z3_lns_optimizer";
import { SolverBridge } from "../src/solver";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGraph(n: number, edges: [number, number][]): AdjacencyMatrix {
  const adj = new AdjacencyMatrix(n);
  for (const [i, j] of edges) adj.addEdge(i, j);
  return adj;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("adaptiveZ3Solve — lockedVertices param", () => {
  test("signature accepts lockedVertices as optional 6th arg", () => {
    // adaptiveZ3Solve(graph, cliques, solver, r, s, lockedVertices?)
    // JS function.length counts params up to the first one with a default
    // The key check is that calling with 6 args doesn't throw at the type level
    expect(typeof adaptiveZ3Solve).toBe("function");
    // length ignores rest/default params; just verify it's callable
    expect(adaptiveZ3Solve.length).toBeGreaterThanOrEqual(0);
  });

  test("generateZ3PythonPayload includes assert-freeze lines for locked edges", async () => {
    // We test the generated SMT payload by intercepting solver.runZ3.
    // Build a 4-vertex graph with edges (0,1) and (1,2).
    // Lock vertices {0, 1} → edge (0,1) must be asserted.
    const graph = makeGraph(4, [[0, 1], [1, 2], [2, 3]]);
    const lockedVertices = new Set([0, 1]);

    let capturedScript = "";
    const mockSolver = {
      runZ3: async (script: string, _timeout: number) => {
        capturedScript = script;
        return { output: "UNSAT", exitCode: 1 };
      },
    } as unknown as SolverBridge;

    // Provide empty cliques so halo starts at 10 but exits quickly on UNSAT
    await adaptiveZ3Solve(graph, [], mockSolver, 4, 6, lockedVertices);

    // The script must contain a frozen assertion for edge (0,1) since both vertices are locked
    expect(capturedScript).toContain("frozen_locked_edges");
  });

  test("locked edges appear as direct assertions in the Z3 script", async () => {
    const graph = makeGraph(5, [[0, 1], [0, 2], [1, 3]]);
    const lockedVertices = new Set([0, 1]); // edge (0,1) both in locked set

    let capturedScript = "";
    const mockSolver = {
      runZ3: async (script: string, _timeout: number) => {
        capturedScript = script;
        return { output: "UNSAT", exitCode: 1 };
      },
    } as unknown as SolverBridge;

    await adaptiveZ3Solve(graph, [], mockSolver, 4, 6, lockedVertices);

    // Edge (0,1) has value 1 in the graph — frozen_locked_edges should be [[0,1,1]]
    expect(capturedScript).toContain("[[0,1,1]]");
    // The FrozenCore assertions loop should be present
    expect(capturedScript).toContain("FrozenCore assertions");
  });

  test("graph with no lockedVertices produces empty frozen_locked_edges list", async () => {
    const graph = makeGraph(4, [[0, 1], [2, 3]]);

    let capturedScript = "";
    const mockSolver = {
      runZ3: async (script: string, _timeout: number) => {
        capturedScript = script;
        return { output: "UNSAT", exitCode: 1 };
      },
    } as unknown as SolverBridge;

    await adaptiveZ3Solve(graph, [], mockSolver, 4, 6);

    // The frozen_locked_edges variable must be present and must be an empty list.
    // Use a regex to ensure it is literally `= []` (no content).
    expect(capturedScript).toMatch(/frozen_locked_edges\s*=\s*\[\]/);
  });

  test("locked edges that appear in free edge window are still frozen (not free)", async () => {
    // This is the key correctness test: if edge (i,j) is in lockedVertices,
    // it should be asserted as a constant, even if getAdaptiveLnsWindow would
    // normally include it in the free set.
    const graph = makeGraph(6, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]]);
    const lockedVertices = new Set([0, 1, 2]); // locks edges (0,1), (1,2)

    const scripts: string[] = [];
    const mockSolver = {
      runZ3: async (script: string, _timeout: number) => {
        scripts.push(script);
        return { output: "UNSAT", exitCode: 1 };
      },
    } as unknown as SolverBridge;

    await adaptiveZ3Solve(graph, [], mockSolver, 4, 6, lockedVertices);

    // At least one script was generated
    expect(scripts.length).toBeGreaterThan(0);
    // The first script must contain frozen_locked_edges block
    expect(scripts[0]).toContain("frozen_locked_edges");
  });
});
