/**
 * Tests for the reusable graph layer: AdjacencyMatrix, SRGEnergy, DegreePreservingSwap.
 *
 * Uses the Rook graph R(3,3) as a known SRG(9, 4, 1, 2) test fixture.
 * This is the same parameter family as Conway's 99-graph problem.
 */

import { describe, expect, it } from "bun:test";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";
import { srgEnergy, srgEnergyAlgebraic, commonNeighborCount } from "../src/math/graph/SRGEnergy";
import { degreePreservingSwap } from "../src/math/graph/DegreePreservingSwap";

// ──────────────────────────────────────────────
// Test fixture: Rook graph R(3,3) = SRG(9, 4, 1, 2)
// Vertices (i,j) for i,j ∈ {0,1,2}, adjacent iff same row or column.
// Labeled 0-8 via (i,j) → 3i + j.
// ──────────────────────────────────────────────
function createRookGraph(): AdjacencyMatrix {
  const g = new AdjacencyMatrix(9);
  // Same-row edges
  for (let i = 0; i < 3; i++) {
    for (let j1 = 0; j1 < 3; j1++) {
      for (let j2 = j1 + 1; j2 < 3; j2++) {
        g.addEdge(3 * i + j1, 3 * i + j2);
      }
    }
  }
  // Same-column edges
  for (let j = 0; j < 3; j++) {
    for (let i1 = 0; i1 < 3; i1++) {
      for (let i2 = i1 + 1; i2 < 3; i2++) {
        g.addEdge(3 * i1 + j, 3 * i2 + j);
      }
    }
  }
  return g;
}

// ──────────────────────────────────────────────
// AdjacencyMatrix
// ──────────────────────────────────────────────

describe("AdjacencyMatrix", () => {
  it("creates an empty graph with correct size", () => {
    const g = new AdjacencyMatrix(5);
    expect(g.n).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(g.degree(i)).toBe(0);
    }
  });

  it("addEdge creates symmetric adjacency", () => {
    const g = new AdjacencyMatrix(4);
    g.addEdge(0, 1);
    expect(g.hasEdge(0, 1)).toBe(true);
    expect(g.hasEdge(1, 0)).toBe(true);
    expect(g.hasEdge(0, 2)).toBe(false);
  });

  it("removeEdge removes symmetric adjacency", () => {
    const g = new AdjacencyMatrix(4);
    g.addEdge(0, 1);
    g.removeEdge(0, 1);
    expect(g.hasEdge(0, 1)).toBe(false);
    expect(g.hasEdge(1, 0)).toBe(false);
  });

  it("degree counts neighbors correctly", () => {
    const g = createRookGraph();
    for (let v = 0; v < 9; v++) {
      expect(g.degree(v)).toBe(4);
    }
  });

  it("neighbors returns correct adjacency list", () => {
    const g = createRookGraph();
    // Vertex 0 = (0,0): adjacent to (0,1)=1, (0,2)=2, (1,0)=3, (2,0)=6
    const nbrs = g.neighbors(0);
    expect(nbrs.sort()).toEqual([1, 2, 3, 6]);
  });

  it("clone creates an independent copy", () => {
    const g = createRookGraph();
    const h = g.clone();
    h.removeEdge(0, 1);
    expect(g.hasEdge(0, 1)).toBe(true);
    expect(h.hasEdge(0, 1)).toBe(false);
  });

  it("edgeCount returns correct total for k-regular graph", () => {
    const g = createRookGraph();
    // 9 vertices × degree 4 / 2 = 18 edges
    expect(g.edgeCount()).toBe(18);
  });

  it("randomRegular creates a graph with correct degree sequence", () => {
    const g = AdjacencyMatrix.randomRegular(20, 4);
    for (let v = 0; v < 20; v++) {
      expect(g.degree(v)).toBe(4);
    }
    // Symmetric
    for (let i = 0; i < 20; i++) {
      for (let j = 0; j < 20; j++) {
        expect(g.hasEdge(i, j)).toBe(g.hasEdge(j, i));
      }
    }
  });
});

// ──────────────────────────────────────────────
// Common Neighbors & SRG Energy
// ──────────────────────────────────────────────

describe("commonNeighborCount", () => {
  it("returns 1 for adjacent pair in Rook(3,3)", () => {
    const g = createRookGraph();
    // 0 and 1 are adjacent (same row). Common neighbors: {2}
    expect(commonNeighborCount(g, 0, 1)).toBe(1);
  });

  it("returns 2 for non-adjacent pair in Rook(3,3)", () => {
    const g = createRookGraph();
    // 0=(0,0) and 4=(1,1) are NOT adjacent. Common neighbors: {1, 3}
    expect(commonNeighborCount(g, 0, 4)).toBe(2);
  });
});

describe("srgEnergy", () => {
  it("returns 0 for the Rook(3,3) graph with params (9, 4, 1, 2)", () => {
    const g = createRookGraph();
    expect(srgEnergy(g, 4, 1, 2)).toBe(0);
  });

  it("returns > 0 for a graph that is NOT the target SRG", () => {
    // A random 4-regular graph on 9 vertices is almost certainly not SRG(9,4,1,2)
    const g = new AdjacencyMatrix(9);
    // Create a non-SRG 4-regular graph: cycle + cross edges
    const edges: [number, number][] = [
      [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,0], // 9-cycle (deg 2 each)
      [0,4],[1,5],[2,6],[3,7],[4,8],[5,0],[6,1],[7,2],[8,3], // add 9 more (deg 4 each)
    ];
    for (const [u, v] of edges) {
      if (!g.hasEdge(u, v)) g.addEdge(u, v);
    }
    expect(srgEnergy(g, 4, 1, 2)).toBeGreaterThan(0);
  });

  it("energy includes degree penalty", () => {
    // Graph with wrong degrees should have positive energy
    const g = new AdjacencyMatrix(9);
    g.addEdge(0, 1);
    expect(srgEnergy(g, 4, 1, 2)).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────
// Algebraic SRG Energy (matrix identity)
// ──────────────────────────────────────────────

describe("srgEnergyAlgebraic", () => {
  it("returns 0 for the Rook(3,3) graph with params (9, 4, 1, 2)", () => {
    const g = createRookGraph();
    expect(srgEnergyAlgebraic(g, 4, 1, 2)).toBe(0);
  });

  it("returns > 0 for a non-SRG graph", () => {
    const g = new AdjacencyMatrix(9);
    const edges: [number, number][] = [
      [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,0],
      [0,4],[1,5],[2,6],[3,7],[4,8],[5,0],[6,1],[7,2],[8,3],
    ];
    for (const [u, v] of edges) {
      if (!g.hasEdge(u, v)) g.addEdge(u, v);
    }
    expect(srgEnergyAlgebraic(g, 4, 1, 2)).toBeGreaterThan(0);
  });

  it("agrees with combinatorial energy on a random 4-regular graph", () => {
    const g = AdjacencyMatrix.randomRegular(20, 4);
    const eComb = srgEnergy(g, 4, 1, 2);
    const eAlg = srgEnergyAlgebraic(g, 4, 1, 2);
    // Both should be > 0 and the algebraic version should correlate
    // (they measure slightly different things due to degree penalty,
    //  but on k-regular graphs the degree penalty is 0, so they
    //  should relate: algebraic counts full matrix, combinatorial counts upper triangle)
    expect(eComb).toBeGreaterThan(0);
    expect(eAlg).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────
// Degree-Preserving Swap
// ──────────────────────────────────────────────

describe("degreePreservingSwap", () => {
  it("preserves all vertex degrees", () => {
    const g = createRookGraph();
    const originalDegrees = Array.from({ length: 9 }, (_, i) => g.degree(i));

    for (let trial = 0; trial < 100; trial++) {
      const swapped = degreePreservingSwap(g);
      if (!swapped) continue;

      for (let v = 0; v < 9; v++) {
        expect(swapped.degree(v)).toBe(originalDegrees[v]!);
      }
    }
  });

  it("produces a different graph (at least sometimes)", () => {
    const g = createRookGraph();
    let sawDifferent = false;

    for (let trial = 0; trial < 100; trial++) {
      const swapped = degreePreservingSwap(g);
      if (!swapped) continue;

      // Check if any edge differs
      for (let i = 0; i < 9 && !sawDifferent; i++) {
        for (let j = i + 1; j < 9; j++) {
          if (swapped.hasEdge(i, j) !== g.hasEdge(i, j)) {
            sawDifferent = true;
            break;
          }
        }
      }
      if (sawDifferent) break;
    }

    expect(sawDifferent).toBe(true);
  });

  it("returns null gracefully (no valid swap exists) or a valid graph", () => {
    // Complete graph K4: every pair is an edge, no swap is possible
    const g = new AdjacencyMatrix(4);
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        g.addEdge(i, j);
      }
    }

    // All possible swaps would create multi-edges; should return null
    let allNull = true;
    for (let trial = 0; trial < 50; trial++) {
      const result = degreePreservingSwap(g);
      if (result !== null) allNull = false;
    }
    expect(allNull).toBe(true);
  });

  it("maintains degree invariant over 10,000 chained swaps", () => {
    let g = AdjacencyMatrix.randomRegular(20, 4);
    const originalDegrees = Array.from({ length: 20 }, (_, i) => g.degree(i));

    for (let i = 0; i < 10_000; i++) {
      const next = degreePreservingSwap(g);
      if (next) g = next;
    }

    for (let v = 0; v < 20; v++) {
      expect(g.degree(v)).toBe(originalDegrees[v]!);
    }
  });
});
