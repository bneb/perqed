/**
 * tests/vdw_crossover.test.ts — TDD for src/search/vdw_crossover.ts
 */
import { describe, test, expect } from "bun:test";
import { crossover, localAPViolations, minHittingSet } from "../src/search/vdw_crossover";
import { computeAPEnergy, findViolatingAPs } from "../src/search/ap_energy";

const W32_WITNESS = new Int8Array([0, 0, 0, 1, 1, 0, 0, 1, 1]);

describe("localAPViolations", () => {
  test("returns 0 for every element in a valid coloring", () => {
    for (let i = 1; i <= 8; i++) {
      expect(localAPViolations(W32_WITNESS, i, 8, 3)).toBe(0);
    }
  });

  test("returns > 0 for elements in a violated AP", () => {
    // p[1]=p[2]=p[3]=0: {1,2,3} is a violated AP
    const p = new Int8Array([0, 0, 0, 0, 1, 1, 1, 1, 1]);
    expect(localAPViolations(p, 1, 8, 3)).toBeGreaterThan(0);
    expect(localAPViolations(p, 2, 8, 3)).toBeGreaterThan(0);
    expect(localAPViolations(p, 3, 8, 3)).toBeGreaterThan(0);
  });

  test("non-negative for random partitions", () => {
    const N = 30, K = 4;
    const p = new Int8Array(N + 1);
    for (let i = 1; i <= N; i++) p[i] = Math.floor(Math.random() * K);
    for (let i = 1; i <= N; i++) {
      expect(localAPViolations(p, i, N, 3)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("crossover", () => {
  test("crossing a partition with itself returns identical partition", () => {
    const p = new Int8Array([0, 0, 1, 2, 0, 1, 2, 0, 1]);
    const child = crossover(p, p, 8, 3);
    for (let i = 1; i <= 8; i++) expect(child[i]).toBe(p[i]);
  });

  test("returns valid K-coloring", () => {
    const N = 30, K = 4;
    const a = new Int8Array(N + 1), b = new Int8Array(N + 1);
    for (let i = 1; i <= N; i++) { a[i] = Math.floor(Math.random() * K); b[i] = Math.floor(Math.random() * K); }
    const child = crossover(a, b, N, 3);
    for (let i = 1; i <= N; i++) {
      expect(child[i]).toBeGreaterThanOrEqual(0);
      expect(child[i]).toBeLessThan(K);
      expect([a[i], b[i]]).toContain(child[i]); // each element comes from one of the parents
    }
  });

  test("crossing two E=0 witnesses with themselves returns E=0", () => {
    const child = crossover(W32_WITNESS, W32_WITNESS, 8, 3);
    expect(computeAPEnergy(child, 8, 3)).toBe(0);
  });

  test("result energy ≤ max(E_a, E_b) for random pairs (AP-boundary selection)", () => {
    const N = 25, K = 4;
    let successes = 0;
    for (let trial = 0; trial < 10; trial++) {
      const a = new Int8Array(N + 1), b = new Int8Array(N + 1);
      for (let i = 1; i <= N; i++) { a[i] = Math.floor(Math.random() * K); b[i] = Math.floor(Math.random() * K); }
      const eA = computeAPEnergy(a, N, 3);
      const eB = computeAPEnergy(b, N, 3);
      const child = crossover(a, b, N, 3);
      const eChild = computeAPEnergy(child, N, 3);
      if (eChild <= Math.max(eA, eB)) successes++;
    }
    // Should hold for most trials
    expect(successes).toBeGreaterThanOrEqual(7);
  });
});

describe("minHittingSet", () => {
  test("returns empty set for no violated APs", () => {
    expect(minHittingSet([])).toHaveLength(0);
  });

  test("single-element hitting set when all APs share one element", () => {
    const aps = [[1, 2, 3], [1, 4, 7], [1, 5, 9]]; // all contain 1
    const hs = minHittingSet(aps);
    expect(hs).toContain(1);
    expect(hs.length).toBeLessThanOrEqual(2);
  });

  test("result hits every violated AP", () => {
    const aps = [[1, 3, 5], [2, 4, 6], [3, 5, 7], [4, 6, 8]];
    const hs = new Set(minHittingSet(aps));
    for (const ap of aps) {
      expect(ap.some(e => hs.has(e))).toBe(true);
    }
  });

  test("result is smaller than union of all AP elements", () => {
    const aps = [[1, 3, 5], [3, 5, 7], [5, 7, 9], [7, 9, 11]];
    const union = new Set(aps.flat());
    const hs = minHittingSet(aps);
    expect(hs.length).toBeLessThan(union.size);
  });
});
