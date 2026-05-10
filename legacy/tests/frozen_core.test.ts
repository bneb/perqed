import { expect, test, describe } from "bun:test";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";
import {
  findFrozenCore,
  localVertexEnergy,
  subgraphEnergy,
  type FrozenCoreResult,
} from "../src/search/frozen_core";

const N = 10; // structural tests
const R = 4;  // actual Ramsey parameter
const S = 6;
// N_SMALL < R and N_SMALL < S: guarantees E=0 on any graph of this size
const N_SMALL = 3;

/** Build a complete graph K_n (worst case — highest energy) */
function makeComplete(n: number): AdjacencyMatrix {
  const adj = new AdjacencyMatrix(n);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) adj.addEdge(i, j);
  return adj;
}

/** Build an empty graph (no edges — no cliques or independent sets of size >1) */
function makeEmpty(n: number): AdjacencyMatrix {
  return new AdjacencyMatrix(n);
}

/** Build a bipartite graph (known to have no odd cliques) */
function makeBipartite(n: number): AdjacencyMatrix {
  const adj = new AdjacencyMatrix(n);
  const half = Math.floor(n / 2);
  for (let i = 0; i < half; i++)
    for (let j = half; j < n; j++) adj.addEdge(i, j);
  return adj;
}

describe("subgraphEnergy", () => {
  test("empty vertex set has zero energy", () => {
    const adj = makeComplete(N);
    expect(subgraphEnergy(adj, [], R, S)).toBe(0);
  });

  test("empty graph has zero energy for any vertex subset", () => {
    // N_SMALL=3 < R=4 and < S=6: no K_4 or K_6 can exist in 3 vertices
    const adj = makeEmpty(N_SMALL);
    const vertices = Array.from({ length: N_SMALL }, (_, i) => i);
    expect(subgraphEnergy(adj, vertices, R, S)).toBe(0);
  });

  test("subgraph energy is ≤ full graph energy", () => {
    const adj = makeComplete(N);
    const allVerts = Array.from({ length: N }, (_, i) => i);
    const partial = allVerts.slice(0, 5);
    const fullEnergy = subgraphEnergy(adj, allVerts, R, S);
    const partialEnergy = subgraphEnergy(adj, partial, R, S);
    expect(partialEnergy).toBeLessThanOrEqual(fullEnergy);
  });

  test("single vertex has zero energy", () => {
    const adj = makeComplete(N);
    expect(subgraphEnergy(adj, [0], R, S)).toBe(0);
  });
});

describe("localVertexEnergy", () => {
  test("all vertices have zero local energy in an empty graph", () => {
    // N_SMALL=3 < R=4 and < S=6: E=0 in any subgraph
    const adj = makeEmpty(N_SMALL);
    const allVerts = Array.from({ length: N_SMALL }, (_, i) => i);
    for (const v of allVerts) {
      expect(localVertexEnergy(adj, v, allVerts, R, S)).toBe(0);
    }
  });

  test("returns a non-negative number", () => {
    const adj = makeComplete(N);
    const allVerts = Array.from({ length: N }, (_, i) => i);
    for (const v of allVerts) {
      expect(localVertexEnergy(adj, v, allVerts, R, S)).toBeGreaterThanOrEqual(0);
    }
  });

  test("vertex with no edges has zero local energy", () => {
    // N_SMALL=3: no K_4 possible, vertex 2 has no edges
    const adj = new AdjacencyMatrix(N_SMALL);
    adj.addEdge(0, 1); // only one edge; vertex 2 is isolated
    const allVerts = Array.from({ length: N_SMALL }, (_, i) => i);
    // R=4, S=6: impossible in 3 vertices — E=0
    expect(localVertexEnergy(adj, 2, allVerts, R, S)).toBe(0);
  });
});

describe("findFrozenCore", () => {
  test("returns a FrozenCoreResult object", () => {
    const adj = makeComplete(N);
    const result = findFrozenCore(adj, R, S);
    expect(result).toHaveProperty("lockedVertices");
    expect(result).toHaveProperty("freeVertices");
    expect(result).toHaveProperty("coreEnergy");
  });

  test("frozen core has zero internal energy", () => {
    const adj = makeComplete(N);
    const result = findFrozenCore(adj, R, S);
    expect(result.coreEnergy).toBe(0);
  });

  test("lockedVertices and freeVertices partition the full vertex set", () => {
    const adj = makeComplete(N);
    const result = findFrozenCore(adj, R, S);
    const all = [...result.lockedVertices, ...result.freeVertices].sort((a, b) => a - b);
    expect(all).toEqual(Array.from({ length: N }, (_, i) => i));
  });

  test("lockedVertices has no duplicates", () => {
    const adj = makeComplete(N);
    const { lockedVertices } = findFrozenCore(adj, R, S);
    const unique = new Set(lockedVertices);
    expect(unique.size).toBe(lockedVertices.length);
  });

  test("empty graph: all vertices are frozen (core = full graph)", () => {
    // N_SMALL=3 < R=4 and < S=6: the subgraph is already E=0 without peeling
    const adj = makeEmpty(N_SMALL);
    const result = findFrozenCore(adj, R, S);
    expect(result.lockedVertices.length).toBe(N_SMALL);
    expect(result.freeVertices.length).toBe(0);
    expect(result.coreEnergy).toBe(0);
  });

  test("verified subgraphEnergy of core is 0 via direct check", () => {
    const adj = makeComplete(N);
    const { lockedVertices } = findFrozenCore(adj, R, S);
    const energy = subgraphEnergy(adj, lockedVertices, R, S);
    expect(energy).toBe(0);
  });
});

describe("generateNeighbors with lockedVertices", () => {
  test("locked edges are never flipped", () => {
    const { generateNeighbors } = require("../src/search/neighborhood_funnel") as {
      generateNeighbors: typeof import("../src/search/neighborhood_funnel").generateNeighbors;
    };
    const adj = makeEmpty(N);
    adj.addEdge(0, 1);
    adj.addEdge(2, 3);

    // Lock vertices 0 and 1 — edge (0,1) must not flip
    const locked = new Set([0, 1]);
    const neighbors = generateNeighbors(adj, 200, 5, locked);

    for (const nb of neighbors) {
      // Edge (0,1): both in locked — must remain unchanged
      expect(nb.hasEdge(0, 1)).toBe(adj.hasEdge(0, 1));
      // Edge (2,3): neither locked — may flip (this is the free zone)
    }
  });

  test("free vertex edges can still be flipped", () => {
    const { generateNeighbors } = require("../src/search/neighborhood_funnel") as {
      generateNeighbors: typeof import("../src/search/neighborhood_funnel").generateNeighbors;
    };
    const adj = makeEmpty(N);
    // Lock vertices 0,1,2 only — vertices 3..9 are free
    const locked = new Set([0, 1, 2]);
    const neighbors = generateNeighbors(adj, 200, 3, locked);
    // At least some neighbors should have a free-zone edge flipped
    const anyDiff = neighbors.some((nb) => {
      for (let i = 3; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          if (nb.hasEdge(i, j) !== adj.hasEdge(i, j)) return true;
        }
      }
      return false;
    });
    expect(anyDiff).toBe(true);
  });
});
