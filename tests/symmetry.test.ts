/**
 * TDD Tests — symmetry.ts math utilities
 * These tests are written FIRST (red phase).
 */

import { describe, test, expect } from "bun:test";
import {
  getCircularDistance,
  getEdgesForDistance,
  buildCirculantGraph,
  isCirculant,
} from "../src/search/symmetry";

describe("getCircularDistance", () => {
  test("adjacent vertices have distance 1", () => {
    expect(getCircularDistance(0, 1, 5)).toBe(1);
    expect(getCircularDistance(1, 2, 5)).toBe(1);
  });

  test("wraps around correctly", () => {
    // On N=5: 0 and 4 are distance 1 (4 → 0 wraps)
    expect(getCircularDistance(0, 4, 5)).toBe(1);
  });

  test("symmetric: d(i,j) == d(j,i)", () => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        expect(getCircularDistance(i, j, 7)).toBe(getCircularDistance(j, i, 7));
      }
    }
  });

  test("max distance for even N is N/2", () => {
    // N=6: distances are 0,1,2,3. Max is 3 = 6/2
    expect(getCircularDistance(0, 3, 6)).toBe(3);
    expect(getCircularDistance(0, 4, 6)).toBe(2); // min(4, 2) = 2
  });

  test("max distance for odd N is floor(N/2)", () => {
    // N=35: max distance is 17
    expect(getCircularDistance(0, 17, 35)).toBe(17);
    expect(getCircularDistance(0, 18, 35)).toBe(17); // min(18, 17) = 17
  });

  test("distance to self is 0", () => {
    expect(getCircularDistance(3, 3, 10)).toBe(0);
  });
});

describe("getEdgesForDistance", () => {
  test("returns exactly N edges for distance d on N vertices", () => {
    const N = 5;
    for (let d = 1; d <= Math.floor(N / 2); d++) {
      expect(getEdgesForDistance(d, N)).toHaveLength(N);
    }
  });

  test("distance 1 on N=5 covers all 5 vertices", () => {
    const edges = getEdgesForDistance(1, 5);
    const vertices = new Set(edges.flatMap(([u, v]) => [u, v]));
    expect(vertices.size).toBe(5);
  });

  test("distance 1 on N=5 yields correct edges", () => {
    const edges = getEdgesForDistance(1, 5);
    // Should be: (0,1),(1,2),(2,3),(3,4),(0,4) in some order, all [min,max]
    const edgeSet = new Set(edges.map(([u, v]) => `${u}-${v}`));
    expect(edgeSet.has("0-1")).toBe(true);
    expect(edgeSet.has("1-2")).toBe(true);
    expect(edgeSet.has("2-3")).toBe(true);
    expect(edgeSet.has("3-4")).toBe(true);
    expect(edgeSet.has("0-4")).toBe(true);
  });

  test("edges are in [min,max] canonical form (no duplicates)", () => {
    const edges = getEdgesForDistance(2, 7);
    for (const [u, v] of edges) {
      expect(u).toBeLessThan(v);
    }
    // Check no duplicates
    const edgeSet = new Set(edges.map(([u, v]) => `${u}-${v}`));
    expect(edgeSet.size).toBe(edges.length);
  });

  test("covers the correct total edges for N=35: 17 distances × 35 = 595", () => {
    const N = 35;
    const maxDist = Math.floor(N / 2);
    let total = 0;
    for (let d = 1; d <= maxDist; d++) {
      total += getEdgesForDistance(d, N).length;
    }
    expect(total).toBe(595); // C(35, 2) = 595
  });

  test("all distances cover all edges exactly once (partition check)", () => {
    const N = 7;
    const maxDist = Math.floor(N / 2);
    const seen = new Set<string>();
    for (let d = 1; d <= maxDist; d++) {
      for (const [u, v] of getEdgesForDistance(d, N)) {
        const key = `${u}-${v}`;
        expect(seen.has(key)).toBe(false); // No duplicates across distances
        seen.add(key);
      }
    }
    // Should have covered all C(7,2) = 21 edges
    expect(seen.size).toBe(21);
  });
});

describe("buildCirculantGraph", () => {
  test("distance-1 edges present when distanceColors[1]=1", () => {
    const N = 5;
    const maxDist = Math.floor(N / 2);
    const colors = new Map<number, number>();
    for (let d = 1; d <= maxDist; d++) colors.set(d, 0); // all absent
    colors.set(1, 1); // only distance 1 present

    const adj = buildCirculantGraph(colors, N);
    // Distance-1 edges should be present
    expect(adj.hasEdge(0, 1)).toBe(true);
    expect(adj.hasEdge(0, 4)).toBe(true);
    // Distance-2 edges should be absent
    expect(adj.hasEdge(0, 2)).toBe(false);
    expect(adj.hasEdge(0, 3)).toBe(false);
  });

  test("all edges absent when all distanceColors=0", () => {
    const N = 5;
    const colors = new Map<number, number>([[1, 0], [2, 0]]);
    const adj = buildCirculantGraph(colors, N);
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        expect(adj.hasEdge(i, j)).toBe(false);
      }
    }
  });

  test("all edges present when all distanceColors=1", () => {
    const N = 5;
    const colors = new Map<number, number>([[1, 1], [2, 1]]);
    const adj = buildCirculantGraph(colors, N);
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        expect(adj.hasEdge(i, j)).toBe(true);
      }
    }
  });

  test("built graph satisfies circulant invariant", () => {
    const N = 7;
    const colors = new Map<number, number>([[1, 1], [2, 0], [3, 1]]);
    const adj = buildCirculantGraph(colors, N);
    expect(isCirculant(adj, N)).toBe(true);
  });
});

describe("isCirculant", () => {
  test("detects non-circulant graph", () => {
    const { AdjacencyMatrix } = require("../src/math/graph/AdjacencyMatrix");
    const N = 5;
    const adj = new AdjacencyMatrix(N);
    adj.addEdge(0, 1); // Only one edge — this breaks circulant (d=1 must be all-or-nothing)
    expect(isCirculant(adj, N)).toBe(false);
  });

  test("empty graph is circulant", () => {
    const { AdjacencyMatrix } = require("../src/math/graph/AdjacencyMatrix");
    const N = 5;
    const adj = new AdjacencyMatrix(N);
    expect(isCirculant(adj, N)).toBe(true);
  });

  test("complete graph is circulant", () => {
    const { AdjacencyMatrix } = require("../src/math/graph/AdjacencyMatrix");
    const N = 6;
    const adj = new AdjacencyMatrix(N);
    for (let i = 0; i < N; i++)
      for (let j = i + 1; j < N; j++)
        adj.addEdge(i, j);
    expect(isCirculant(adj, N)).toBe(true);
  });
});
