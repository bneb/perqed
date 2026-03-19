import { expect, test, describe } from "bun:test";
import { generateNeighbors, flattenMatrix } from "../src/search/neighborhood_funnel";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";

const N = 35;
const FLAT_LEN = N * (N - 1) / 2; // 595

function makeSeedMatrix(): AdjacencyMatrix {
  const adj = new AdjacencyMatrix(N);
  // Add a few edges from the known R(4,6) seed difference set
  const seed = [5, 7, 10, 14, 15, 20, 21, 25, 28, 30];
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const diff = ((i - j) + N) % N;
      if (seed.includes(diff)) adj.addEdge(i, j);
    }
  }
  return adj;
}

describe("generateNeighbors", () => {
  test("returns the requested count of neighbors", () => {
    const base = makeSeedMatrix();
    const neighbors = generateNeighbors(base, 100);
    expect(neighbors.length).toBe(100);
  });

  test("each neighbor is a distinct AdjacencyMatrix instance", () => {
    const base = makeSeedMatrix();
    const neighbors = generateNeighbors(base, 10);
    for (const nb of neighbors) {
      expect(nb).not.toBe(base);
      expect(nb).toBeInstanceOf(AdjacencyMatrix);
    }
  });

  test("neighbors maintain symmetry (matrix[i][j] === matrix[j][i])", () => {
    const base = makeSeedMatrix();
    const neighbors = generateNeighbors(base, 20, 3);
    for (const nb of neighbors) {
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          expect(nb.hasEdge(i, j)).toBe(nb.hasEdge(j, i));
        }
      }
    }
  });

  test("each neighbor differs from base by at least 1 edge", () => {
    const base = makeSeedMatrix();
    // With maxFlips ≥ 1 every neighbor must differ from base
    const neighbors = generateNeighbors(base, 50, 3);
    for (const nb of neighbors) {
      let diffCount = 0;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          if (nb.hasEdge(i, j) !== base.hasEdge(i, j)) diffCount++;
        }
      }
      expect(diffCount).toBeGreaterThanOrEqual(1);
    }
  });

  test("does not mutate the base matrix", () => {
    const base = makeSeedMatrix();
    const originalEdges: boolean[] = [];
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        originalEdges.push(base.hasEdge(i, j));
      }
    }
    generateNeighbors(base, 50);
    let k = 0;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        expect(base.hasEdge(i, j)).toBe(originalEdges[k++]!);
      }
    }
  });
});

describe("flattenMatrix", () => {
  test("returns a string of length N*(N-1)/2", () => {
    const base = makeSeedMatrix();
    const flat = flattenMatrix(base);
    expect(flat.length).toBe(FLAT_LEN);
  });

  test("contains only '0' and '1' characters", () => {
    const flat = flattenMatrix(makeSeedMatrix());
    expect(flat).toMatch(/^[01]+$/);
  });

  test("empty graph yields all zeros", () => {
    const empty = new AdjacencyMatrix(N);
    const flat = flattenMatrix(empty);
    expect(flat).toBe("0".repeat(FLAT_LEN));
  });

  test("full graph yields all ones", () => {
    const full = new AdjacencyMatrix(N);
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) full.addEdge(i, j);
    }
    const flat = flattenMatrix(full);
    expect(flat).toBe("1".repeat(FLAT_LEN));
  });
});
