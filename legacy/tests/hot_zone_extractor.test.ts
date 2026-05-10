/**
 * TDD Phase 1: HotZoneExtractor
 *
 * RED tests — all must fail before implementation exists.
 *
 * The HotZoneExtractor identifies vertex IDs that participate in at least one
 * violated clique (K_r red or K̄_s blue). It's the vertex-level analogue of
 * lns_extractor::extractViolatingEdges.
 */

import { describe, test, expect } from "bun:test";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";
import {
  extractHotZone,
  type ViolationZone,
} from "../src/search/hot_zone_extractor";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a complete graph K_n (all edges present = all red). */
function completeGraph(n: number): AdjacencyMatrix {
  const adj = new AdjacencyMatrix(n);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      adj.addEdge(i, j);
  return adj;
}

/** Build an empty graph K̄_n (no edges = entirely blue). */
function emptyGraph(n: number): AdjacencyMatrix {
  return new AdjacencyMatrix(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("extractHotZone", () => {

  // 1. E=0 graph → empty hot zone
  test("returns empty hot zone when graph has E=0", () => {
    // A 5-vertex graph with no K_3 and no K̄_3: use a 5-cycle (pentagon).
    // Pentagon: edges 0-1, 1-2, 2-3, 3-4, 4-0.
    // For R(3,3)=6, a 5-vertex graph CAN be triangle-free and K̄_3-free.
    const adj = new AdjacencyMatrix(5);
    adj.addEdge(0, 1); adj.addEdge(1, 2); adj.addEdge(2, 3);
    adj.addEdge(3, 4); adj.addEdge(4, 0);
    // For r=3,s=3: K_3 requires 3 mutually adjacent; K̄_3 requires 3 mutually non-adjacent.
    // Pentagon has no triangles and no independent set of size 3, so E=0 for R(3,3).
    const zone = extractHotZone(adj, 3, 3, 16);
    expect(zone.isValidForSAT).toBe(true);
    expect(zone.hotVertices.size).toBe(0);
    expect(zone.frozenVertices.size).toBe(5);
  });

  // 2. All-red complete graph K_4 → all 4 vertices hot (K_4 violation with r=4)
  test("returns all vertices for K_4 complete graph with r=4", () => {
    const adj = completeGraph(4);
    // K_4 itself violates r=4 → all 4 vertices in hot zone
    const zone = extractHotZone(adj, 4, 6, 16);
    expect(zone.hotVertices.size).toBe(4);
    for (let i = 0; i < 4; i++) {
      expect(zone.hotVertices.has(i)).toBe(true);
    }
    expect(zone.frozenVertices.size).toBe(0);
    expect(zone.isValidForSAT).toBe(true);
  });

  // 3. All-blue (empty) graph on 6 vertices → K̄_6 violation with s=6
  test("returns all 6 vertices for empty K_6 graph with s=6", () => {
    const adj = emptyGraph(6);
    // All 6 vertices form a K̄_6 independent set → all hot
    const zone = extractHotZone(adj, 4, 6, 16);
    expect(zone.hotVertices.size).toBe(6);
    for (let i = 0; i < 6; i++) {
      expect(zone.hotVertices.has(i)).toBe(true);
    }
    expect(zone.frozenVertices.size).toBe(0);
    expect(zone.isValidForSAT).toBe(true);
  });

  // 4. hotVertices and frozenVertices are complements that cover all n vertices
  test("hotVertices ∪ frozenVertices = all vertex IDs, disjoint", () => {
    const adj = completeGraph(6);
    const zone = extractHotZone(adj, 4, 6, 16);
    const n = adj.n;
    const all = new Set(Array.from({ length: n }, (_, i) => i));

    // Every vertex is in exactly one set
    for (const v of zone.hotVertices) {
      expect(zone.frozenVertices.has(v)).toBe(false);
    }
    for (const v of zone.frozenVertices) {
      expect(zone.hotVertices.has(v)).toBe(false);
    }
    // Union covers all
    const union = new Set([...zone.hotVertices, ...zone.frozenVertices]);
    for (const v of all) {
      expect(union.has(v)).toBe(true);
    }
    expect(union.size).toBe(n);
  });

  // 5. isValidForSAT=false when hot zone exceeds hotZoneLimit
  test("isValidForSAT=false when hotVertices.size > hotZoneLimit", () => {
    // Complete graph on 20 vertices with r=4: all C(20,4) 4-cliques violated,
    // all 20 vertices will be hot. Limit to 10 → should be invalid.
    const adj = completeGraph(20);
    const zone = extractHotZone(adj, 4, 6, 10);
    expect(zone.isValidForSAT).toBe(false);
    // Hot vertices should still be populated (useful for telemetry)
    expect(zone.hotVertices.size).toBeGreaterThan(10);
  });

  // 6. Isolated violation: only the violating clique vertices are hot
  test("only the K_4 clique vertices are hot when rest of graph is clean", () => {
    // Build a 10-vertex graph where only vertices 0,1,2,3 form a K_4.
    // Vertices 4–9 form a large independent set (no violations, no blue K_6 since s=6).
    const adj = new AdjacencyMatrix(10);
    // K_4 on {0,1,2,3}
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++)
        adj.addEdge(i, j);
    // Add some edges among 4–9 to prevent K̄_6
    adj.addEdge(4, 5); adj.addEdge(6, 7); adj.addEdge(8, 9);
    adj.addEdge(4, 6); adj.addEdge(5, 7);

    const zone = extractHotZone(adj, 4, 6, 16);
    // Only 0,1,2,3 should be hot (the K_4 clique)
    expect(zone.hotVertices.has(0)).toBe(true);
    expect(zone.hotVertices.has(1)).toBe(true);
    expect(zone.hotVertices.has(2)).toBe(true);
    expect(zone.hotVertices.has(3)).toBe(true);
    // None of 4–9 should be hot (they're not in any violation)
    for (let v = 4; v <= 9; v++) {
      expect(zone.hotVertices.has(v)).toBe(false);
    }
    expect(zone.isValidForSAT).toBe(true);
  });

  // 7. Default hotZoneLimit is 16
  test("default hotZoneLimit is 16 (no explicit arg)", () => {
    const adj = completeGraph(20);
    // With hotZoneLimit=16 all 20 vertices hot → invalid
    const zone = extractHotZone(adj, 4, 6); // no limit arg
    expect(zone.isValidForSAT).toBe(false);
  });
});
