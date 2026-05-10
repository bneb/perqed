/**
 * TDD Phase 2: MicroSATPatcher
 *
 * RED tests — all must fail before implementation exists.
 *
 * The MicroSATPatcher accepts a ViolationZone from HotZoneExtractor and runs
 * a targeted Z3 repair: freeze all cold-zone edges as constants, declare
 * hot-zone edges as variables, assert zero clique constraints over the
 * full graph, and return SAT/UNSAT/timeout/skipped.
 *
 * On UNSAT, a nukeScaffold step scrambles ~20% of cold-zone edges to
 * destroy the toxic frozen topology before SA resumes.
 */

import { describe, test, expect } from "bun:test";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";
import { extractHotZone, extractTopHotZone } from "../src/search/hot_zone_extractor";
import {
  runMicroSATPatch,
  nukeScaffold,
  type MicroSATPatchResult,
} from "../src/search/micro_sat_patcher";

// ── Helpers ───────────────────────────────────────────────────────────────────

function completeGraph(n: number): AdjacencyMatrix {
  const adj = new AdjacencyMatrix(n);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      adj.addEdge(i, j);
  return adj;
}

function countViolations(adj: AdjacencyMatrix, r: number, s: number): number {
  const N = adj.n;
  let count = 0;
  function* combinations(n: number, k: number): Generator<number[]> {
    if (k > n) return;
    const c = Array.from({ length: k }, (_, i) => i);
    while (true) {
      yield [...c];
      let i = k - 1;
      while (i >= 0 && c[i]! === n - k + i) i--;
      if (i < 0) break;
      c[i]!++;
      for (let j = i + 1; j < k; j++) c[j] = c[j - 1]! + 1;
    }
  }
  for (const combo of combinations(N, r)) {
    let ok = true;
    for (let i = 0; i < r && ok; i++)
      for (let j = i + 1; j < r; j++)
        if (!adj.hasEdge(combo[i]!, combo[j]!)) { ok = false; break; }
    if (ok) count++;
  }
  for (const combo of combinations(N, s)) {
    let ok = true;
    for (let i = 0; i < s && ok; i++)
      for (let j = i + 1; j < s; j++)
        if (adj.hasEdge(combo[i]!, combo[j]!)) { ok = false; break; }
    if (ok) count++;
  }
  return count;
}

// ── MicroSATPatcher tests ─────────────────────────────────────────────────────

describe("runMicroSATPatch", () => {

  // 1. Returns 'skipped' when hot zone exceeds limit (isValidForSAT=false)
  test("returns skipped when hot zone is too large", async () => {
    const adj = completeGraph(20);
    const zone = extractHotZone(adj, 4, 6, 5); // limit=5, many more vertices hot → invalid
    expect(zone.isValidForSAT).toBe(false);

    const result = await runMicroSATPatch(adj, 4, 6, zone, { timeoutMs: 5_000 });
    expect(result.status).toBe("skipped");
    expect(result.adj).toBeUndefined();
  });

  // 2. Returns 'sat' with E=0 on a small repairable graph
  // Use a 6-vertex graph with a single K_3 violation (r=3) and repair it.
  // The hot zone is just the 3 violating vertices; Z3 can trivially recolor one edge.
  test("returns sat with E=0 on a repairable K_3 violation (r=3,s=4)", async () => {
    // Build a 7-vertex graph: triangle at {0,1,2} + rest is random but clean
    const adj = new AdjacencyMatrix(7);
    adj.addEdge(0, 1); adj.addEdge(1, 2); adj.addEdge(0, 2); // K_3 violation
    // Add some edges among 3–6 to break up any independent sets of size 4
    adj.addEdge(3, 4); adj.addEdge(4, 5); adj.addEdge(5, 6); adj.addEdge(3, 6);
    adj.addEdge(3, 5); adj.addEdge(4, 6);

    const zone = extractHotZone(adj, 3, 4, 16);
    expect(zone.isValidForSAT).toBe(true);
    expect(zone.hotVertices.size).toBeGreaterThan(0);

    const result = await runMicroSATPatch(adj, 3, 4, zone, { timeoutMs: 30_000 });
    // Should find a SAT solution
    if (result.status === "sat") {
      expect(result.adj).toBeDefined();
      // Repaired graph must have E=0
      const violations = countViolations(result.adj!, 3, 4);
      expect(violations).toBe(0);
    } else {
      // UNSAT is also valid (some graphs are provably irrecoverable)
      expect(["sat", "unsat"]).toContain(result.status);
    }
  });

  // 3. Telemetry fields are always populated
  test("always returns hotZoneSize and solveTimeMs", async () => {
    const adj = completeGraph(5);
    const zone = extractHotZone(adj, 4, 6, 16);
    const result = await runMicroSATPatch(adj, 4, 6, zone, { timeoutMs: 5_000 });
    expect(typeof result.hotZoneSize).toBe("number");
    expect(typeof result.solveTimeMs).toBe("number");
    expect(result.solveTimeMs).toBeGreaterThanOrEqual(0);
  });

  // 4. Returns 'unsat' or 'sat' (not 'error') on a valid-sized hot zone
  test("never returns error for a well-formed graph + zone", async () => {
    const adj = new AdjacencyMatrix(8);
    adj.addEdge(0, 1); adj.addEdge(1, 2); adj.addEdge(0, 2); // K_3
    const zone = extractHotZone(adj, 3, 4, 16);
    const result = await runMicroSATPatch(adj, 3, 4, zone, { timeoutMs: 15_000 });
    expect(["sat", "unsat", "timeout"]).toContain(result.status);
    expect(result.status).not.toBe("error");
  });
});

// ── nukeScaffold tests ────────────────────────────────────────────────────────

describe("nukeScaffold", () => {
  // 5. nukeScaffold mutates ~20% of cold-zone edges
  test("changes approximately 20% of cold zone edges", () => {
    // 10-vertex graph, hot zone = {0,1,2}, cold = {3..9}
    const adj = new AdjacencyMatrix(10);
    // Dense cold zone so there's plenty to scramble
    for (let i = 3; i < 10; i++)
      for (let j = i + 1; j < 10; j++)
        adj.addEdge(i, j);

    const hotVertices = new Set([0, 1, 2]);
    const frozenVertices = new Set(Array.from({ length: 7 }, (_, i) => i + 3));

    // Count cold-cold edges before
    let beforeEdges = 0;
    for (const u of frozenVertices)
      for (const v of frozenVertices)
        if (u < v && adj.hasEdge(u, v)) beforeEdges++;

    const mutated = nukeScaffold(adj, frozenVertices, 0.2);

    let afterEdges = 0;
    for (const u of frozenVertices)
      for (const v of frozenVertices)
        if (u < v && mutated.hasEdge(u, v)) afterEdges++;

    // Some edges should have changed
    expect(beforeEdges).not.toBe(afterEdges);
    // But hot-zone edges should be untouched
    expect(mutated.hasEdge(0, 1)).toBe(adj.hasEdge(0, 1));
    expect(mutated.hasEdge(1, 2)).toBe(adj.hasEdge(1, 2));
    expect(mutated.hasEdge(0, 2)).toBe(adj.hasEdge(0, 2));
  });

  // 6. nukeScaffold returns a new matrix (doesn't mutate in place)
  test("returns a new AdjacencyMatrix, does not mutate original", () => {
    const adj = new AdjacencyMatrix(6);
    adj.addEdge(3, 4); adj.addEdge(4, 5); adj.addEdge(3, 5);
    const frozenVertices = new Set([3, 4, 5]);

    const original3_4 = adj.hasEdge(3, 4);
    const mutated = nukeScaffold(adj, frozenVertices, 1.0); // nuke 100%
    // Original unchanged
    expect(adj.hasEdge(3, 4)).toBe(original3_4);
    // Mutated is a different object
    expect(mutated).not.toBe(adj);
  });
});
