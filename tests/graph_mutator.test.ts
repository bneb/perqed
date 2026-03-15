/**
 * Sprint 22: GraphMutator Tests (TDD RED → GREEN)
 *
 * Tests multi-modal graph mutation with min degree 3 enforcement.
 */

import { describe, test, expect } from "bun:test";
import { GraphMutator } from "../src/math/graph_mutator";

describe("GraphMutator", () => {
  test("mutate returns a valid adjacency list or null", () => {
    // 6-vertex graph with degrees 4-5 (room for add/remove/swap)
    const graph = [
      [1, 2, 3, 4],       // 0: degree 4
      [0, 2, 3, 5],       // 1: degree 4
      [0, 1, 3, 4, 5],    // 2: degree 5
      [0, 1, 2, 4, 5],    // 3: degree 5
      [0, 2, 3, 5],       // 4: degree 4
      [1, 2, 3, 4],       // 5: degree 4
    ];

    let gotMutation = false;
    for (let i = 0; i < 100; i++) {
      const result = GraphMutator.mutate(graph);
      if (result !== null) {
        gotMutation = true;
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(6);
        break;
      }
    }
    expect(gotMutation).toBe(true);
  });

  test("mutated graph always maintains min degree >= 3", () => {
    // K_3,3: bipartite, every vertex degree 3
    const k33 = [
      [3, 4, 5],
      [3, 4, 5],
      [3, 4, 5],
      [0, 1, 2],
      [0, 1, 2],
      [0, 1, 2],
    ];

    for (let i = 0; i < 200; i++) {
      const result = GraphMutator.mutate(k33);
      if (result !== null) {
        for (let v = 0; v < result.length; v++) {
          expect(result[v]!.length).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  test("mutated graph preserves symmetry (undirected)", () => {
    const k4 = [
      [1, 2, 3],
      [0, 2, 3],
      [0, 1, 3],
      [0, 1, 2],
    ];

    for (let i = 0; i < 50; i++) {
      const result = GraphMutator.mutate(k4);
      if (result !== null) {
        for (let u = 0; u < result.length; u++) {
          for (const v of result[u]!) {
            expect(result[v]).toContain(u);
          }
        }
      }
    }
  });

  test("mutated graph has no self-loops", () => {
    const k4 = [
      [1, 2, 3],
      [0, 2, 3],
      [0, 1, 3],
      [0, 1, 2],
    ];

    for (let i = 0; i < 50; i++) {
      const result = GraphMutator.mutate(k4);
      if (result !== null) {
        for (let u = 0; u < result.length; u++) {
          expect(result[u]).not.toContain(u);
        }
      }
    }
  });
});
