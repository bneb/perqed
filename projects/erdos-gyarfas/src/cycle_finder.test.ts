/**
 * Sprint 21: CycleFinder Tests (TDD RED → GREEN)
 *
 * Tests bounded DFS cycle detection for power-of-2 lengths.
 */

import { describe, test, expect } from "bun:test";
import { CycleFinder } from "./cycle_finder";

describe("CycleFinder", () => {
  test("K_4 has a 4-cycle (power of 2)", () => {
    // K_4: every vertex connects to all others
    const adj = [
      [1, 2, 3], // vertex 0
      [0, 2, 3], // vertex 1
      [0, 1, 3], // vertex 2
      [0, 1, 2], // vertex 3
    ];
    expect(CycleFinder.hasPowerOfTwoCycle(adj)).toBe(true);
  });

  test("triangle (K_3) has no power-of-2 cycle", () => {
    // K_3: cycle of length 3 only — not a power of 2
    const adj = [
      [1, 2],
      [0, 2],
      [0, 1],
    ];
    expect(CycleFinder.hasPowerOfTwoCycle(adj)).toBe(false);
  });

  test("Petersen graph has an 8-cycle (girth 5, but 8-cycles exist)", () => {
    // The Petersen graph: 10 vertices, 3-regular, girth 5.
    // No 4-cycles, but it DOES have 8-cycles and 9-cycles.
    const petersen = [
      [1, 4, 5],    // 0
      [0, 2, 6],    // 1
      [1, 3, 7],    // 2
      [2, 4, 8],    // 3
      [0, 3, 9],    // 4
      [0, 7, 8],    // 5
      [1, 8, 9],    // 6
      [2, 5, 9],    // 7
      [3, 5, 6],    // 8
      [4, 6, 7],    // 9
    ];
    expect(CycleFinder.hasPowerOfTwoCycle(petersen)).toBe(true);
  });

  test("C_7 (7-cycle) has no power-of-2 cycle", () => {
    const adj = Array.from({ length: 7 }, (_, i) => [
      (i + 1) % 7,
      (i + 6) % 7,
    ]);
    expect(CycleFinder.hasPowerOfTwoCycle(adj)).toBe(false);
  });

  test("C_8 (8-cycle) has a power-of-2 cycle", () => {
    // 8-cycle: 0-1-2-3-4-5-6-7-0
    const adj = Array.from({ length: 8 }, (_, i) => [
      (i + 1) % 8,
      (i + 7) % 8,
    ]);
    expect(CycleFinder.hasPowerOfTwoCycle(adj)).toBe(true);
  });

  test("C_5 (5-cycle) has no power-of-2 cycle", () => {
    const adj = Array.from({ length: 5 }, (_, i) => [
      (i + 1) % 5,
      (i + 4) % 5,
    ]);
    expect(CycleFinder.hasPowerOfTwoCycle(adj)).toBe(false);
  });

  test("empty graph returns false", () => {
    expect(CycleFinder.hasPowerOfTwoCycle([])).toBe(false);
  });

  test("graph with 4-cycle embedded in larger structure", () => {
    // 6 vertices, contains 4-cycle 0-1-2-3-0 plus extra edges
    const adj = [
      [1, 3, 4],     // 0
      [0, 2, 5],     // 1
      [1, 3],        // 2
      [0, 2],        // 3
      [0, 5],        // 4
      [1, 4],        // 5
    ];
    expect(CycleFinder.hasPowerOfTwoCycle(adj)).toBe(true);
  });
});
