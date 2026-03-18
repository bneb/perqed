/**
 * ZobristHasher tests — TDD RED → GREEN
 *
 * Tests:
 *   1. Deterministic initialization — same seed produces same table
 *   2. computeInitial — known graph produces consistent hash
 *   3. toggleEdge — O(1) XOR update matches full recompute
 *   4. Double-toggle is identity (XOR property)
 *   5. Different graphs produce different hashes
 *   6. Commutative toggle order (a XOR b = b XOR a starting from same base)
 *   7. Empty graph hash is 0n (no edges present XORed in for the default "absent" table)
 *   8. tabu set detection: hash in set → reheat triggered
 */

import { describe, test, expect } from "bun:test";
import { ZobristHasher } from "../src/search/zobrist_hash";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function makeTriangle(): AdjacencyMatrix {
  // 3-vertex graph with edges (0,1), (1,2), (0,2)
  const adj = new AdjacencyMatrix(3);
  adj.addEdge(0, 1);
  adj.addEdge(1, 2);
  adj.addEdge(0, 2);
  return adj;
}

function makePath(): AdjacencyMatrix {
  // 3-vertex path 0-1-2 (edge (0,2) absent)
  const adj = new AdjacencyMatrix(3);
  adj.addEdge(0, 1);
  adj.addEdge(1, 2);
  return adj;
}

// ──────────────────────────────────────────────────────────────────────────

describe("ZobristHasher — construction", () => {
  test("creates without throwing for n=3", () => {
    expect(() => new ZobristHasher(3)).not.toThrow();
  });

  test("creates without throwing for n=35 (production size)", () => {
    expect(() => new ZobristHasher(35)).not.toThrow();
  });

  test("same seed produces same hasher (deterministic)", () => {
    const h1 = new ZobristHasher(4, 42n);
    const h2 = new ZobristHasher(4, 42n);
    const adj = new AdjacencyMatrix(4);
    adj.addEdge(0, 1);
    adj.addEdge(2, 3);
    expect(h1.computeInitial(adj)).toBe(h2.computeInitial(adj));
  });

  test("different seeds produce different table values (with overwhelming probability)", () => {
    const h1 = new ZobristHasher(4, 1n);
    const h2 = new ZobristHasher(4, 2n);
    const adj = new AdjacencyMatrix(4);
    adj.addEdge(0, 1);
    // Collision probability is astronomically low for 64-bit hashes
    expect(h1.computeInitial(adj)).not.toBe(h2.computeInitial(adj));
  });
});

describe("ZobristHasher — computeInitial", () => {
  test("same graph hashes to same value (idempotent)", () => {
    const h = new ZobristHasher(3);
    const adj = makeTriangle();
    expect(h.computeInitial(adj)).toBe(h.computeInitial(adj));
  });

  test("empty graph hashes to a consistent value", () => {
    const h = new ZobristHasher(3);
    const adj = new AdjacencyMatrix(3);
    const hash = h.computeInitial(adj);
    expect(typeof hash).toBe("bigint");
    expect(hash).toBe(h.computeInitial(adj));
  });

  test("triangle and path produce different hashes", () => {
    const h = new ZobristHasher(3);
    expect(h.computeInitial(makeTriangle())).not.toBe(h.computeInitial(makePath()));
  });
});

describe("ZobristHasher — toggleEdge (O(1) incremental update)", () => {
  test("toggleEdge matches full recompute after one edge flip", () => {
    const h = new ZobristHasher(3);
    const adj = makeTriangle();
    const initial = h.computeInitial(adj);

    // Toggle edge (0,2) — remove it from the triangle → path
    const incremental = h.toggleEdge(initial, 0, 2);

    // Recompute from scratch on the mutated graph
    adj.removeEdge(0, 2);
    const recomputed = h.computeInitial(adj);

    expect(incremental).toBe(recomputed);
  });

  test("toggleEdge of absent edge matches full recompute after edge addition", () => {
    const h = new ZobristHasher(3);
    const adj = makePath(); // edges (0,1) and (1,2), but not (0,2)
    const initial = h.computeInitial(adj);

    // Toggle (0,2) — add it → triangle
    const incremental = h.toggleEdge(initial, 0, 2);

    adj.addEdge(0, 2);
    const recomputed = h.computeInitial(adj);

    expect(incremental).toBe(recomputed);
  });

  test("double toggle is identity (XOR involution)", () => {
    const h = new ZobristHasher(4);
    const adj = new AdjacencyMatrix(4);
    adj.addEdge(0, 1);
    adj.addEdge(2, 3);

    const initial = h.computeInitial(adj);
    const toggled = h.toggleEdge(initial, 0, 1);
    const restored = h.toggleEdge(toggled, 0, 1);

    expect(restored).toBe(initial);
  });

  test("toggle order is commutative (XOR property)", () => {
    const h = new ZobristHasher(4);
    const adj = new AdjacencyMatrix(4);
    const base = h.computeInitial(adj);

    const ab = h.toggleEdge(h.toggleEdge(base, 0, 1), 2, 3);
    const ba = h.toggleEdge(h.toggleEdge(base, 2, 3), 0, 1);

    expect(ab).toBe(ba);
  });

  test("toggleEdge(u, v) equals toggleEdge(v, u) — symmetric", () => {
    const h = new ZobristHasher(4);
    const adj = new AdjacencyMatrix(4);
    const base = h.computeInitial(adj);
    // For undirected graph, flipping (u,v) and (v,u) must produce same hash
    expect(h.toggleEdge(base, 0, 3)).toBe(h.toggleEdge(base, 3, 0));
  });

  test("sequential toggles on different edges match full recompute", () => {
    const h = new ZobristHasher(5);
    const adj = new AdjacencyMatrix(5);
    adj.addEdge(0, 1);
    adj.addEdge(2, 4);
    const initial = h.computeInitial(adj);

    // Flip (0,1), (1,3), (0,4) incrementally
    const incremental = h.toggleEdge(
      h.toggleEdge(h.toggleEdge(initial, 0, 1), 1, 3),
      0, 4,
    );

    // Apply the same flips to the actual graph and recompute
    adj.removeEdge(0, 1);
    adj.addEdge(1, 3);
    adj.addEdge(0, 4);
    const recomputed = h.computeInitial(adj);

    expect(incremental).toBe(recomputed);
  });
});

describe("ZobristHasher — tabu set integration", () => {
  test("graph hash can be stored in a Set<bigint> and detected", () => {
    const h = new ZobristHasher(3);
    const tabuSet = new Set<bigint>();

    const glass = makeTriangle();
    const glassHash = h.computeInitial(glass);
    tabuSet.add(glassHash);

    // Same graph must be detected
    const sameGraph = makeTriangle();
    expect(tabuSet.has(h.computeInitial(sameGraph))).toBe(true);
  });

  test("non-tabu graph is not in the tabu set", () => {
    const h = new ZobristHasher(3);
    const tabuSet = new Set<bigint>();

    tabuSet.add(h.computeInitial(makeTriangle()));

    expect(tabuSet.has(h.computeInitial(makePath()))).toBe(false);
  });

  test("incremental hash correctly triggers tabu detection", () => {
    // Simulate: SA is exploring from a path → proposed triangle is tabu
    const h = new ZobristHasher(3);
    const tabuSet = new Set<bigint>();

    // Mark the triangle as a glass floor (tabu)
    const triangleHash = h.computeInitial(makeTriangle());
    tabuSet.add(triangleHash);

    // Worker is currently on a path graph
    const currentAdj = makePath(); // (0,1), (1,2) — NOT tabu
    const currentHash = h.computeInitial(currentAdj);

    // Worker proposes toggling edge (0,2) → would produce triangle
    const proposedHash = h.toggleEdge(currentHash, 0, 2);

    // Tabu detection: should trigger reheat
    expect(tabuSet.has(proposedHash)).toBe(true);
    // Current state is not tabu
    expect(tabuSet.has(currentHash)).toBe(false);
  });
});
