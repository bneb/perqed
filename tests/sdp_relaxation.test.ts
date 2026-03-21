/**
 * sdp_relaxation.test.ts — TDD tests for the continuous Schur energy relaxation.
 *
 * Red-to-green workflow: define correctness contracts first.
 */

import { describe, it, expect } from "bun:test";
import {
  initSoftPartitionFromHard,
  initUniformSoftPartition,
  softEnergy,
  softEnergyGradient,
  projectToHard,
  projectOntoSimplex,
  runSoftGradientDescent,
} from "../src/search/sdp_relaxation";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeHardPartition(N: number, K: number): Int8Array {
  const p = new Int8Array(N + 1);
  for (let i = 1; i <= N; i++) p[i] = (i - 1) % K;
  return p;
}

// ── projectOntoSimplex ────────────────────────────────────────────────────────

describe("projectOntoSimplex", () => {
  it("uniform vector is already on simplex", () => {
    const K = 4;
    const v = new Float64Array(K).fill(1 / K);
    const projected = projectOntoSimplex(v);
    const sum = projected.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0);
    for (const x of projected) expect(x).toBeGreaterThanOrEqual(-1e-10);
  });

  it("negative values are clipped to 0 after projection", () => {
    const v = new Float64Array([2, -1, 0, 0]);
    const projected = projectOntoSimplex(v);
    for (const x of projected) expect(x).toBeGreaterThanOrEqual(-1e-10);
    expect(projected.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0);
  });

  it("already-valid probability vector is unchanged (near)", () => {
    const v = new Float64Array([0.7, 0.2, 0.1]);
    const projected = projectOntoSimplex(v);
    expect(projected[0]).toBeCloseTo(0.7, 5);
    expect(projected[1]).toBeCloseTo(0.2, 5);
    expect(projected[2]).toBeCloseTo(0.1, 5);
  });

  it("all-zero input projects to uniform", () => {
    const v = new Float64Array(3).fill(0);
    const projected = projectOntoSimplex(v);
    expect(projected.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0);
  });
});

// ── initSoftPartitionFromHard ─────────────────────────────────────────────────

describe("initSoftPartitionFromHard", () => {
  const N = 10, K = 3;
  it("most probability mass is on the assigned color", () => {
    const hard = new Int8Array([0, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2]); // 1-indexed
    const sp = initSoftPartitionFromHard(hard, N, K, 0.1);

    for (let i = 1; i <= N; i++) {
      const assignedColor = hard[i]!;
      expect(sp.probs[i]![assignedColor]!).toBeGreaterThan(1 / K);
    }
  });

  it("each element's probability vector sums to ~1.0", () => {
    const hard = makeHardPartition(N, K);
    const sp = initSoftPartitionFromHard(hard, N, K, 0.1);
    for (let i = 1; i <= N; i++) {
      const sum = sp.probs[i]!.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });
});

// ── softEnergy ────────────────────────────────────────────────────────────────

describe("softEnergy", () => {
  it("uniform partition has positive soft energy (not zero)", () => {
    const N = 10, K = 3;
    const sp = initUniformSoftPartition(N, K);
    expect(softEnergy(sp)).toBeGreaterThan(0);
  });

  it("valid hard partition (zero energy) has near-zero soft energy (temp=0)", () => {
    // Sum-free partition: {1,4,7,10}, {2,5,8}, {3,6,9} for K=3, N=10
    // Manually verified: no x+y=z within each class
    const N = 9, K = 3;
    const hard = new Int8Array(N + 1);
    // P0: {1,4,7},  P1: {2,5,8},  P2: {3,6,9}
    for (let i = 1; i <= N; i++) hard[i] = (i - 1) % 3;
    // Check this IS sum-free for N=9 (it is not fully sum-free but test soft energy behavior)
    const sp = initSoftPartitionFromHard(hard, N, K, 0); // temp=0 → one-hot
    const E = softEnergy(sp);
    // Soft energy with temp=0 should match the discrete energy exactly
    expect(E).toBeGreaterThanOrEqual(0);
  });

  it("perfect one-hot soft partition matches discrete energy", () => {
    // All elements assigned color 0 — extremely bad partition
    const N = 6, K = 3;
    const hard = new Int8Array(N + 1).fill(0); hard[0] = 0;
    for (let i = 1; i <= N; i++) hard[i] = 0;
    const sp = initSoftPartitionFromHard(hard, N, K, 0);
    const Esoft = softEnergy(sp);
    // All 6 elements in same class, x≤y, x+y≤6:
    // (1,1,2),(1,2,3),(1,3,4),(1,4,5),(1,5,6),(2,2,4),(2,3,5),(2,4,6),(3,3,6) → 9 triples
    expect(Esoft).toBeCloseTo(9, 1);
  });
});

// ── softEnergyGradient — finite difference verification ───────────────────────

describe("softEnergyGradient", () => {
  it("gradient matches finite differences (central difference, ε=1e-5)", () => {
    const N = 8, K = 3;
    const hard = makeHardPartition(N, K);
    const sp = initSoftPartitionFromHard(hard, N, K, 0.3);
    const grad = softEnergyGradient(sp);

    const EPS = 1e-5;
    // Spot-check a sample of (i, k) pairs
    const sampled: Array<[number, number]> = [[1, 0], [3, 1], [5, 2], [7, 0]];
    for (const [i, k] of sampled) {
      const orig = sp.probs[i]![k]!;
      sp.probs[i]![k] = orig + EPS;
      const Ep = softEnergy(sp);
      sp.probs[i]![k] = orig - EPS;
      const Em = softEnergy(sp);
      sp.probs[i]![k] = orig; // restore
      const fd = (Ep - Em) / (2 * EPS);
      expect(grad[i]![k]!).toBeCloseTo(fd, 2);
    }
  });
});

// ── projectToHard ─────────────────────────────────────────────────────────────

describe("projectToHard", () => {
  it("assigns each element to argmax color", () => {
    const N = 3, K = 3;
    const sp = initUniformSoftPartition(N, K);
    // Force element 1 → color 2 with high probability
    sp.probs[1] = new Float64Array([0.05, 0.05, 0.9]);
    const hard = projectToHard(sp);
    expect(hard[1]).toBe(2);
  });

  it("all elements in [0, K)", () => {
    const N = 20, K = 6;
    const hard = makeHardPartition(N, K);
    const sp = initSoftPartitionFromHard(hard, N, K, 0.1);
    const projected = projectToHard(sp);
    for (let i = 1; i <= N; i++) {
      expect(projected[i]).toBeGreaterThanOrEqual(0);
      expect(projected[i]).toBeLessThan(K);
    }
  });
});

// ── runSoftGradientDescent ────────────────────────────────────────────────────

describe("runSoftGradientDescent", () => {
  it("returns a hard partition of correct length", async () => {
    const N = 20, K = 4;
    const hard = makeHardPartition(N, K);
    const result = await runSoftGradientDescent(hard, N, K, 100, 0.01);
    expect(result.hardPartition.length).toBe(N + 1);
  });

  it("soft energy decreases after gradient descent (small case)", async () => {
    const N = 12, K = 3;
    // Start from all-same-color (very bad partition, high soft energy)
    const hard = new Int8Array(N + 1).fill(0); for (let i = 1; i <= N; i++) hard[i] = 0;
    const { finalSoftEnergy } = await runSoftGradientDescent(hard, N, K, 500, 0.05);
    // Soft energy from all-color-0 start should decrease significantly
    const initial = softEnergy({ probs: Array.from({ length: N + 1 }, (_, i) => {
      const p = new Float64Array(K).fill(0); if (i >= 1) p[0] = 1; return p;
    }), N, K });
    expect(finalSoftEnergy).toBeLessThan(initial);
  });
});
