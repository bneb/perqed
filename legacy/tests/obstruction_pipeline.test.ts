/**
 * obstruction_pipeline.test.ts
 *
 * Invariant tests for the Phase 8 integration: when orchestratedSearch returns
 * ≥3 near-miss graphs (E > 0 and E ≤ 2), the engine must:
 *   1. Call extractCommonSubgraph on those adjacency matrices.
 *   2. Call describeObstruction on the result.
 *   3. Fire a non-blocking journal.addEntry with type="observation".
 *
 * TDD: these tests are written BEFORE the perqed.ts integration is wired.
 * They exercise the obstruction_detector module directly and validate the
 * filter logic that will be used in the main loop.
 */
import { describe, expect, it, mock, beforeEach } from "bun:test";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";
import {
  extractCommonSubgraph,
  describeObstruction,
} from "../src/search/obstruction_detector";

// ── Helper: build a 5-vertex graph with specified edge list ──────────────────
function makeGraph(n: number, edges: [number, number][]): AdjacencyMatrix {
  const adj = new AdjacencyMatrix(n);
  for (const [u, v] of edges) adj.addEdge(u, v);
  return adj;
}

// ── 1. Core module correctness ────────────────────────────────────────────────

describe("extractCommonSubgraph", () => {
  it("returns empty obstruction when no edges are shared by ≥80% of graphs", () => {
    // Each graph has a unique edge — no common edges
    const g1 = makeGraph(4, [[0, 1]]);
    const g2 = makeGraph(4, [[1, 2]]);
    const g3 = makeGraph(4, [[2, 3]]);
    const obs = extractCommonSubgraph([g1, g2, g3]);
    let edgeCount = 0;
    for (let i = 0; i < obs.n; i++)
      for (let j = i + 1; j < obs.n; j++)
        if (obs.hasEdge(i, j)) edgeCount++;
    expect(edgeCount).toBe(0);
  });

  it("marks an edge present when ≥80% of graphs contain it (3/3 = 100%)", () => {
    const edge: [number, number] = [0, 2];
    const g1 = makeGraph(5, [edge, [1, 3]]);
    const g2 = makeGraph(5, [edge, [2, 4]]);
    const g3 = makeGraph(5, [edge, [0, 4]]);
    const obs = extractCommonSubgraph([g1, g2, g3]);
    expect(obs.hasEdge(0, 2)).toBe(true);
  });

  it("excludes an edge present in only 2/4 graphs (50% < 80% threshold)", () => {
    const g1 = makeGraph(4, [[0, 1]]);
    const g2 = makeGraph(4, [[0, 1]]);
    const g3 = makeGraph(4, [[1, 2]]);
    const g4 = makeGraph(4, [[2, 3]]);
    const obs = extractCommonSubgraph([g1, g2, g3, g4]);
    // 0-1 appears in 2/4 = 50% — below default 80% threshold
    expect(obs.hasEdge(0, 1)).toBe(false);
  });

  it("throws on empty input", () => {
    expect(() => extractCommonSubgraph([])).toThrow("empty graph list");
  });
});

describe("describeObstruction", () => {
  it("returns a non-empty string for any input graph", () => {
    const g = makeGraph(5, [[0, 1], [1, 2]]);
    const desc = describeObstruction(g);
    expect(typeof desc).toBe("string");
    expect(desc.length).toBeGreaterThan(0);
  });

  it("reports correct vertex count and edge count", () => {
    const g = makeGraph(6, [[0, 1], [2, 3], [4, 5]]);
    const desc = describeObstruction(g);
    expect(desc).toContain("6-vertex");
    expect(desc).toContain("3 invariant edges");
  });

  it("reports 0 edges for an empty obstruction", () => {
    const g = makeGraph(4, []);
    const desc = describeObstruction(g);
    expect(desc).toContain("0 invariant edges");
  });
});

// ── 2. Near-miss filter logic — mirrors what perqed.ts will use ───────────────

describe("near-miss filter (perqed.ts integration logic)", () => {
  /**
   * Simulates the OrchestratedSearchResult shape that orchResult.allResults
   * provides after the SA Island Model settles.
   */
  type MockWorkerResult = {
    bestEnergy: number;
    bestAdj: AdjacencyMatrix | null;
  };

  function runFilter(results: MockWorkerResult[]): AdjacencyMatrix[] {
    return results
      .filter(r => r.bestEnergy > 0 && r.bestEnergy <= 2 && r.bestAdj)
      .map(r => r.bestAdj!);
  }

  it("excludes E=0 witnesses from near-miss set", () => {
    const witness = makeGraph(4, [[0, 1]]);
    const results: MockWorkerResult[] = [
      { bestEnergy: 0, bestAdj: witness },
      { bestEnergy: 1, bestAdj: makeGraph(4, [[0, 2]]) },
      { bestEnergy: 2, bestAdj: makeGraph(4, [[1, 3]]) },
    ];
    const nearMisses = runFilter(results);
    expect(nearMisses).toHaveLength(2);
    expect(nearMisses.every(adj => adj !== witness)).toBe(true);
  });

  it("excludes E=3+ results (above near-miss threshold)", () => {
    const results: MockWorkerResult[] = [
      { bestEnergy: 3, bestAdj: makeGraph(4, [[0, 1]]) },
      { bestEnergy: 5, bestAdj: makeGraph(4, [[0, 2]]) },
    ];
    expect(runFilter(results)).toHaveLength(0);
  });

  it("excludes results with null bestAdj", () => {
    const results: MockWorkerResult[] = [
      { bestEnergy: 1, bestAdj: null },
      { bestEnergy: 2, bestAdj: null },
      { bestEnergy: 1, bestAdj: null },
    ];
    expect(runFilter(results)).toHaveLength(0);
  });

  it("includes exactly E=1 and E=2 graphs with non-null adjacency", () => {
    const results: MockWorkerResult[] = [
      { bestEnergy: 1, bestAdj: makeGraph(5, [[0, 1]]) },
      { bestEnergy: 2, bestAdj: makeGraph(5, [[1, 2]]) },
      { bestEnergy: 2, bestAdj: makeGraph(5, [[2, 3]]) },
    ];
    expect(runFilter(results)).toHaveLength(3);
  });
});

// ── 3. End-to-end pipeline: 3 identical near-miss graphs → obstruction log ───

describe("obstruction pipeline: 3 near-misses → journal entry", () => {
  it("extracts shared edges and produces a meaningful description when ≥3 near-misses converge", () => {
    // Three workers independently find graphs sharing edges (0,1) and (2,3)
    const sharedEdges: [number, number][] = [[0, 1], [2, 3]];
    const g1 = makeGraph(6, [...sharedEdges, [0, 4]]);
    const g2 = makeGraph(6, [...sharedEdges, [1, 5]]);
    const g3 = makeGraph(6, [...sharedEdges, [3, 5]]);

    const nearMisses = [g1, g2, g3];
    const obs = extractCommonSubgraph(nearMisses);
    const desc = describeObstruction(obs);

    // Shared edges must be identified
    expect(obs.hasEdge(0, 1)).toBe(true);
    expect(obs.hasEdge(2, 3)).toBe(true);
    // Non-shared edges must be excluded
    expect(obs.hasEdge(0, 4)).toBe(false);
    expect(obs.hasEdge(1, 5)).toBe(false);

    // Description is non-trivial (has > 0 invariant edges)
    expect(desc).toContain("2 invariant edges");
    expect(desc.length).toBeGreaterThan(0);
  });

  it("fires a journal.addEntry call with type=observation when meaningful obstruction found", async () => {
    const journalEntries: any[] = [];
    const mockJournal = {
      addEntry: mock(async (entry: any) => {
        journalEntries.push(entry);
      }),
    };

    const sharedEdge: [number, number] = [1, 3];
    const nearMisses = [
      makeGraph(5, [sharedEdge, [0, 2]]),
      makeGraph(5, [sharedEdge, [2, 4]]),
      makeGraph(5, [sharedEdge, [0, 4]]),
    ];

    // Replicate the exact perqed.ts integration logic
    const obs = extractCommonSubgraph(nearMisses);
    const desc = describeObstruction(obs);
    let obstructionEdgeCount = 0;
    for (let i = 0; i < obs.n; i++)
      for (let j = i + 1; j < obs.n; j++)
        if (obs.hasEdge(i, j)) obstructionEdgeCount++;

    if (obstructionEdgeCount > 0) {
      await mockJournal.addEntry({
        type: "observation",
        claim: `Structural obstruction detected: ${desc}`,
        evidence: `Identified across ${nearMisses.length} parallel SA workers stalling at E ≤ 2.`,
        target_goal: "R(4,6)",
      });
    }

    expect(mockJournal.addEntry).toHaveBeenCalledTimes(1);
    const entry = journalEntries[0];
    expect(entry.type).toBe("observation");
    expect(entry.claim).toContain("Structural obstruction detected");
    expect(entry.evidence).toContain("3 parallel SA workers");
    expect(entry.target_goal).toBe("R(4,6)");
  });

  it("does NOT fire journal.addEntry when only 2 workers converge (below threshold)", async () => {
    const mockJournal = { addEntry: mock(async (_e: any) => {}) };

    const nearMisses = [
      makeGraph(4, [[0, 1]]),
      makeGraph(4, [[0, 1]]),
    ];

    // Simulate the ≥3 guard
    if (nearMisses.length >= 3) {
      const obs = extractCommonSubgraph(nearMisses);
      const desc = describeObstruction(obs);
      if (desc) await mockJournal.addEntry({ type: "observation", claim: desc });
    }

    expect(mockJournal.addEntry).not.toHaveBeenCalled();
  });
});
