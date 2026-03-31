/**
 * partition_sa_seed_strategies.test.ts — TDD tests for initializePartition().
 *
 * Red-to-green workflow: these tests were written BEFORE implementation and
 * define the contract for each SeedStrategy.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { initializePartition } from "../src/search/partition_sa_worker";

const N = 20;
const K = 6;

function baseConfig() {
  return { domain_size: N, num_partitions: K, description: "test" };
}

describe("initializePartition — modular (default)", () => {
  it("element 1 → color 0", () => {
    const p = initializePartition({ ...baseConfig(), seed_strategy: "modular" });
    expect(p[1]).toBe(0);
  });
  it("element K → color K-1", () => {
    const p = initializePartition({ ...baseConfig(), seed_strategy: "modular" });
    expect(p[K]).toBe(K - 1);
  });
  it("element K+1 → color 0 (wraps)", () => {
    const p = initializePartition({ ...baseConfig(), seed_strategy: "modular" });
    expect(p[K + 1]).toBe(0);
  });
  it("all elements in [0, K)", () => {
    const p = initializePartition({ ...baseConfig(), seed_strategy: "modular" });
    for (let i = 1; i <= N; i++) {
      expect(p[i]).toBeGreaterThanOrEqual(0);
      expect(p[i]).toBeLessThan(K);
    }
  });
});

describe("initializePartition — random", () => {
  it("all elements assigned in [0, K)", () => {
    const p = initializePartition({ ...baseConfig(), seed_strategy: "random" });
    for (let i = 1; i <= N; i++) {
      expect(p[i]).toBeGreaterThanOrEqual(0);
      expect(p[i]).toBeLessThan(K);
    }
  });
  it("two random inits differ with high probability (N=100)", () => {
    const bigN = 100;
    const p1 = initializePartition({ domain_size: bigN, num_partitions: K, description: "t", seed_strategy: "random" });
    const p2 = initializePartition({ domain_size: bigN, num_partitions: K, description: "t", seed_strategy: "random" });
    let diffs = 0;
    for (let i = 1; i <= bigN; i++) if (p1[i] !== p2[i]) diffs++;
    // Extremely unlikely to be identical — P(identical) = (1/6)^100 ≈ 0
    expect(diffs).toBeGreaterThan(0);
  });
});

describe("initializePartition — gaussian_norm", () => {
  it("element 1: ((1*1+1)%13)%6 = 2", () => {
    const p = initializePartition({ ...baseConfig(), seed_strategy: "gaussian_norm" });
    expect(p[1]).toBe(((1 * 1 + 1) % 13) % K);
  });
  it("element 2: ((4+1)%13)%6 = 5", () => {
    const p = initializePartition({ ...baseConfig(), seed_strategy: "gaussian_norm" });
    expect(p[2]).toBe(((2 * 2 + 1) % 13) % K);
  });
  it("element 13: ((169+1)%13)%6 = 0 (since 170%13=1, no wait: 13*13=169, 169+1=170, 170%13=170-13*13=170-169=1, 1%6=1)", () => {
    const p = initializePartition({ ...baseConfig(), seed_strategy: "gaussian_norm" });
    expect(p[13]).toBe(((13 * 13 + 1) % 13) % K);
  });
  it("all elements in [0, K)", () => {
    const p = initializePartition({ ...baseConfig(), seed_strategy: "gaussian_norm" });
    for (let i = 1; i <= N; i++) {
      expect(p[i]).toBeGreaterThanOrEqual(0);
      expect(p[i]).toBeLessThan(K);
    }
  });
});

describe("initializePartition — lookup_shift", () => {
  const lut = [0, 1, 2, 3, 4, 5, 0, 1, 2, 4, 5, 3, 0, 2, 1, 4, 5, 3];
  it("offset=0: element 1 → lut[0] = 0", () => {
    const p = initializePartition({ ...baseConfig(), seed_strategy: "lookup_shift", seed_offset: 0 });
    expect(p[1]).toBe(lut[0]! % K);
  });
  it("offset=1: element 1 → lut[1] = 1", () => {
    const p = initializePartition({ ...baseConfig(), seed_strategy: "lookup_shift", seed_offset: 1 });
    expect(p[1]).toBe(lut[1]! % K);
  });
  it("wraps around the LUT correctly at position 18", () => {
    const p = initializePartition({ ...baseConfig(), seed_strategy: "lookup_shift", seed_offset: 0 });
    // element 19 = (19-1+0) % 18 = 0, so lut[0] = 0
    expect(p[19]).toBe(lut[18 % lut.length]! % K);
  });
});

describe("initializePartition — blocks", () => {
  it("element 1 → color 0 (first block)", () => {
    const p = initializePartition({ ...baseConfig(), seed_strategy: "blocks" });
    expect(p[1]).toBe(0);
  });
  it("element N → color K-1 (last block)", () => {
    const p = initializePartition({ ...baseConfig(), seed_strategy: "blocks" });
    expect(p[N]).toBe(K - 1);
  });
  it("all elements in [0, K)", () => {
    const p = initializePartition({ ...baseConfig(), seed_strategy: "blocks" });
    for (let i = 1; i <= N; i++) {
      expect(p[i]).toBeGreaterThanOrEqual(0);
      expect(p[i]).toBeLessThan(K);
    }
  });
  it("elements are non-decreasing (blocks are monotone)", () => {
    const p = initializePartition({ ...baseConfig(), seed_strategy: "blocks" });
    for (let i = 2; i <= N; i++) {
      expect(p[i]!).toBeGreaterThanOrEqual(p[i - 1]!);
    }
  });
});

describe("initializePartition — crossover", () => {
  it("each element comes from one of two parents", () => {
    const pa = new Int8Array(N + 1);
    const pb = new Int8Array(N + 1);
    for (let i = 1; i <= N; i++) { pa[i] = 0; pb[i] = 5; }
    const p = initializePartition({ ...baseConfig(), seed_strategy: "crossover", crossover_parents: [pa, pb] });
    for (let i = 1; i <= N; i++) {
      expect([0, 5]).toContain(p[i]!);
    }
  });
  it("all elements in [0, K)", () => {
    const pa = new Int8Array(N + 1);
    const pb = new Int8Array(N + 1);
    for (let i = 1; i <= N; i++) { pa[i] = i % K; pb[i] = (i + 3) % K; }
    const p = initializePartition({ ...baseConfig(), seed_strategy: "crossover", crossover_parents: [pa, pb] });
    for (let i = 1; i <= N; i++) {
      expect(p[i]).toBeGreaterThanOrEqual(0);
      expect(p[i]).toBeLessThan(K);
    }
  });
  it("throws if crossover_parents missing", () => {
    expect(() => initializePartition({ ...baseConfig(), seed_strategy: "crossover" })).toThrow();
  });
});

describe("initializePartition — warmStart priority", () => {
  it("warmStart overrides seed_strategy", () => {
    const ws = new Int8Array(N + 1);
    for (let i = 1; i <= N; i++) ws[i] = 3; // all color 3
    const p = initializePartition({ ...baseConfig(), seed_strategy: "random", warmStart: ws });
    for (let i = 1; i <= N; i++) expect(p[i]).toBe(3);
  });
});
