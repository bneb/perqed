/**
 * Ramsey Energy Tests
 *
 * Tests for the Ramsey energy function (red K_r + blue K_s counting)
 * and the incremental delta on edge flip.
 */

import { describe, test, expect } from "bun:test";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";
import {
  countCliques,
  countIndependentSets,
  ramseyEnergy,
  ramseyEnergyDelta,
  flipEdge,
} from "../src/math/graph/RamseyEnergy";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Build a complete graph K_n */
function completeGraph(n: number): AdjacencyMatrix {
  const g = new AdjacencyMatrix(n);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      g.addEdge(i, j);
  return g;
}

/** Build an empty graph on n vertices (no edges) */
function emptyGraph(n: number): AdjacencyMatrix {
  return new AdjacencyMatrix(n);
}

/** C(n,k) binomial coefficient */
function choose(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

// ──────────────────────────────────────────────
// Basic Counting
// ──────────────────────────────────────────────

describe("Ramsey Energy — countCliques", () => {

  test("K_5 has C(5,3)=10 triangles", () => {
    expect(countCliques(completeGraph(5), 3)).toBe(10);
  });

  test("K_5 has C(5,4)=5 K_4 cliques", () => {
    expect(countCliques(completeGraph(5), 4)).toBe(5);
  });

  test("K_6 has C(6,4)=15 K_4 cliques", () => {
    expect(countCliques(completeGraph(6), 4)).toBe(15);
  });

  test("empty graph has 0 cliques of size >= 2", () => {
    expect(countCliques(emptyGraph(10), 3)).toBe(0);
    expect(countCliques(emptyGraph(10), 4)).toBe(0);
  });

  test("K_4 minus one edge has 2 triangles (not 4)", () => {
    const g = completeGraph(4);
    g.removeEdge(0, 1);
    // Remaining triangles: {0,2,3}, {1,2,3} — triangles containing edge (0,1) are gone
    expect(countCliques(g, 3)).toBe(2);
  });

  test("clique of size 1 = n vertices", () => {
    expect(countCliques(completeGraph(8), 1)).toBe(8);
  });
});

describe("Ramsey Energy — countIndependentSets", () => {

  test("empty graph on 6 vertices has C(6,6)=1 independent set of size 6", () => {
    expect(countIndependentSets(emptyGraph(6), 6)).toBe(1);
  });

  test("empty graph on 10 vertices has C(10,6)=210 independent sets of size 6", () => {
    expect(countIndependentSets(emptyGraph(10), 6)).toBe(choose(10, 6));
  });

  test("K_5 has 0 independent sets of size 2 or more", () => {
    expect(countIndependentSets(completeGraph(5), 2)).toBe(0);
  });

  test("path graph P_4 (0-1-2-3) has specific independent sets", () => {
    const g = new AdjacencyMatrix(4);
    g.addEdge(0, 1);
    g.addEdge(1, 2);
    g.addEdge(2, 3);
    // Independent sets of size 2: {0,2}, {0,3}, {1,3} = 3
    expect(countIndependentSets(g, 2)).toBe(3);
  });
});

// ──────────────────────────────────────────────
// Full Ramsey Energy
// ──────────────────────────────────────────────

describe("Ramsey Energy — ramseyEnergy", () => {

  test("complete graph K_6: R(4,6) energy = C(6,4) + 0 = 15", () => {
    // All edges → C(6,4)=15 red K_4 cliques, 0 blue K_6 independent sets
    expect(ramseyEnergy(completeGraph(6), 4, 6)).toBe(15);
  });

  test("empty graph on 6 vertices: R(4,6) energy = 0 + C(6,6) = 1", () => {
    // No edges → 0 red K_4, 1 blue K_6
    expect(ramseyEnergy(emptyGraph(6), 4, 6)).toBe(1);
  });

  test("K_5: R(3,3) energy = C(5,3) + 0 = 10", () => {
    expect(ramseyEnergy(completeGraph(5), 3, 3)).toBe(10);
  });

  test("Petersen graph is triangle-free → 0 K_3 cliques", () => {
    // Petersen graph: 10 vertices, 15 edges, triangle-free, independence number 4
    const g = new AdjacencyMatrix(10);
    // Outer cycle: 0-1-2-3-4
    g.addEdge(0, 1); g.addEdge(1, 2); g.addEdge(2, 3); g.addEdge(3, 4); g.addEdge(4, 0);
    // Inner pentagram: 5-7-9-6-8
    g.addEdge(5, 7); g.addEdge(7, 9); g.addEdge(9, 6); g.addEdge(6, 8); g.addEdge(8, 5);
    // Spokes: 0-5, 1-6, 2-7, 3-8, 4-9
    g.addEdge(0, 5); g.addEdge(1, 6); g.addEdge(2, 7); g.addEdge(3, 8); g.addEdge(4, 9);

    expect(countCliques(g, 3)).toBe(0); // triangle-free
  });
});

// ──────────────────────────────────────────────
// Incremental Delta (Fuzz Test)
// ──────────────────────────────────────────────

describe("Ramsey Energy — ramseyEnergyDelta", () => {

  test("delta matches naive recompute on small random graph (500 flips)", () => {
    const n = 12;
    const r = 3;
    const s = 4;

    // Start with random graph (~50% edge density)
    const g = new AdjacencyMatrix(n);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.random() < 0.5) g.addEdge(i, j);
      }
    }

    let energy = ramseyEnergy(g, r, s);

    for (let iter = 0; iter < 500; iter++) {
      // Random edge to flip
      const u = Math.floor(Math.random() * n);
      let v = Math.floor(Math.random() * (n - 1));
      if (v >= u) v++;

      // Get delta
      const delta = ramseyEnergyDelta(g, u, v, r, s);

      // Actually flip
      flipEdge(g, u, v);

      // Recompute
      const newEnergy = ramseyEnergy(g, r, s);

      expect(delta).toBe(newEnergy - energy);
      energy = newEnergy;
    }
  });

  test("delta matches naive for R(4,6) parameters on n=10 (200 flips)", () => {
    const n = 10;
    const r = 4;
    const s = 6;

    const g = new AdjacencyMatrix(n);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.random() < 0.4) g.addEdge(i, j);
      }
    }

    let energy = ramseyEnergy(g, r, s);

    for (let iter = 0; iter < 200; iter++) {
      const u = Math.floor(Math.random() * n);
      let v = Math.floor(Math.random() * (n - 1));
      if (v >= u) v++;

      const delta = ramseyEnergyDelta(g, u, v, r, s);
      flipEdge(g, u, v);
      const newEnergy = ramseyEnergy(g, r, s);

      expect(delta).toBe(newEnergy - energy);
      energy = newEnergy;
    }
  });

  test("flipping edge in K_4 removes exactly 1 K_4 clique (R(4,6))", () => {
    const g = completeGraph(4);
    // K_4 has exactly 1 K_4 clique, flipping any edge destroys it
    const delta = ramseyEnergyDelta(g, 0, 1, 4, 6);
    // Before: 1 K_4, 0 K_6 indsets. After removing edge: 0 K_4.
    // But now pair {0,1} is non-edge on 4 vertices — no K_6 indset possible (need 6 vertices)
    expect(delta).toBe(-1);
  });
});
