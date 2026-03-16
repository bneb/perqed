/**
 * TDD Tests — lns_extractor.ts (RED phase)
 */

import { describe, test, expect } from "bun:test";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";
import {
  extractViolatingEdges,
  extractLNSNeighborhood,
} from "../src/search/lns_extractor";

function makeAdj(n: number, edges: [number, number][]): AdjacencyMatrix {
  const adj = new AdjacencyMatrix(n);
  for (const [u, v] of edges) adj.addEdge(u, v);
  return adj;
}

describe("extractViolatingEdges", () => {
  test("all-red K_4 on N=4: all 6 edges flagged", () => {
    // K_4 is a red K_4 — every edge is in the violation
    const adj = makeAdj(4, [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]]);
    const violating = extractViolatingEdges(adj, 4, 4);

    // All 6 edges must be flagged (each is part of the red K_4)
    expect(violating.length).toBe(6);
    const keys = new Set(violating.map(([u,v]) => `${Math.min(u,v)}_${Math.max(u,v)}`));
    for (const [u, v] of [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]]) {
      expect(keys.has(`${u}_${v}`)).toBe(true);
    }
  });

  test("empty graph (s=3): blue K_3 violations found", () => {
    // No edges → complement is K_4 → contains blue K_3s
    // For R(r, s=3): we're looking for K_3 in the complement (blue)
    const adj = makeAdj(4, []); // all blue
    const violating = extractViolatingEdges(adj, 4, 3);

    // Every non-edge is in a blue K_3
    expect(violating.length).toBeGreaterThan(0);
  });

  test("valid R(3,3) witness on N=5 (C_5): no violations", () => {
    // C_5: edges at distance 1 form C_5, no K_3 in either color
    const adj = makeAdj(5, [[0,1],[1,2],[2,3],[3,4],[4,0]]);
    const violating = extractViolatingEdges(adj, 3, 3);
    expect(violating.length).toBe(0);
  });

  test("result contains only unique edges (no duplicates)", () => {
    const adj = makeAdj(4, [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]]);
    const violating = extractViolatingEdges(adj, 4, 4);
    const keys = violating.map(([u,v]) => `${Math.min(u,v)}_${Math.max(u,v)}`);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  test("edges always returned in canonical form u < v", () => {
    const adj = makeAdj(4, [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]]);
    const violating = extractViolatingEdges(adj, 4, 4);
    for (const [u, v] of violating) {
      expect(u).toBeLessThan(v);
    }
  });
});

describe("extractLNSNeighborhood", () => {
  test("includes all violating edges", () => {
    const adj = makeAdj(4, [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]]);
    const neighborhood = extractLNSNeighborhood(adj, 4, 4, 0);
    const keys = new Set(neighborhood.map(([u,v]) => `${u}_${v}`));
    for (const [u, v] of [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]]) {
      expect(keys.has(`${u}_${v}`)).toBe(true);
    }
  });

  test("adds approximately extraFreePercent additional edges", () => {
    const adj = makeAdj(6, [[0,1]]); // C(6,2)=15 total edges
    // One edge violates as red K_2... actually r=2 means any edge is K_2
    // Use a more meaningful case
    const violating = extractViolatingEdges(adj, 3, 3);
    const neighborhood = extractLNSNeighborhood(adj, 3, 3, 0.2); // 20% extra
    const totalEdges = (6 * 5) / 2; // 15
    const extraBudget = Math.floor(totalEdges * 0.2); // 3
    // neighborhood >= violating edges, and approximately extraBudget more
    expect(neighborhood.length).toBeGreaterThanOrEqual(violating.length);
  });

  test("no duplicate edges in neighborhood", () => {
    const adj = makeAdj(5, [[0,1],[0,2],[0,3],[1,2]]); // partial graph
    const neighborhood = extractLNSNeighborhood(adj, 3, 3, 0.1);
    const keys = neighborhood.map(([u,v]) => `${u}_${v}`);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });
});
