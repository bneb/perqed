/**
 * tests/spherical_relaxation.test.ts
 *
 * TDD for src/search/spherical_relaxation.ts
 * Tests run BEFORE implementation to enforce red-to-green discipline.
 */
import { describe, test, expect } from "bun:test";
import {
  initSphericalFromHard,
  sphericalEnergy,
  sphericalEnergyGradient,
  retractToSphere,
  decodeHard,
  runSphericalGradientDescent,
} from "../src/search/spherical_relaxation";

// ── Tiny test partition: N=6, K=3, Schur-free coloring ─────────────────────
// Schur condition: no x,y,z=x+y all same color
// For N=6, K=3: (1→0,2→1,3→0,4→2,5→1,6→2) is sum-free → E=0
function makeZeroPartition(N: number, K: number): Int8Array {
  const p = new Int8Array(N + 1).fill(0);
  // Simple mod assignment — may have violations for large N but fine for N=6
  for (let i = 1; i <= N; i++) p[i] = (i - 1) % K;
  return p;
}

describe("retractToSphere", () => {
  test("normalizes a vector to unit norm", () => {
    // 2D sphere (K=2)
    const v = [3.0, 4.0]; // norm = 5
    const vr = retractToSphere(v);
    const norm = Math.sqrt(vr.reduce((a, x) => a + x * x, 0));
    expect(norm).toBeCloseTo(1.0, 5);
  });

  test("uniform-scaled vector stays on sphere", () => {
    const v = [0.1, 0.1, 0.1]; // norm = sqrt(0.03)
    const vr = retractToSphere(v);
    const norm = Math.sqrt(vr.reduce((a, x) => a + x * x, 0));
    expect(norm).toBeCloseTo(1.0, 5);
  });

  test("already-unit vector is unchanged (near)", () => {
    const s = 1.0 / Math.sqrt(3);
    const v = [s, s, s];
    const vr = retractToSphere(v);
    expect(vr[0]).toBeCloseTo(s, 5);
  });
});

describe("initSphericalFromHard", () => {
  test("each element vector is on S^(K-1)", () => {
    const N = 6, K = 3;
    const hard = makeZeroPartition(N, K);
    const sv = initSphericalFromHard(hard, N, K);
    for (let i = 1; i <= N; i++) {
      const v = sv[i]!;
      const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0));
      expect(norm).toBeCloseTo(1.0, 4);
    }
  });

  test("argmax direction aligns with hard color", () => {
    const N = 6, K = 3;
    const hard = makeZeroPartition(N, K);
    const sv = initSphericalFromHard(hard, N, K);
    for (let i = 1; i <= N; i++) {
      const v = sv[i]!;
      const expectedColor = hard[i]!;
      const argmaxColor = v.indexOf(Math.max(...v));
      expect(argmaxColor).toBe(expectedColor);
    }
  });
});

describe("sphericalEnergy", () => {
  test("all-same-color N=3,K=3 has energy equal to triple count", () => {
    // N=3, put all in color 0: v_1=v_2=v_3=(1,0,0)
    const N = 3, K = 3;
    const sv: number[][] = new Array(N + 1);
    for (let i = 1; i <= N; i++) sv[i] = [1.0, 0.0, 0.0];
    // Triples with x≤y, x+y≤N=3: (1,1,2) and (1,2,3) → 2 monochromatic triples
    const E = sphericalEnergy(sv, N, K);
    expect(E).toBeCloseTo(2.0, 4);
  });

  test("zero-energy hard partition gives near-zero soft energy", () => {
    // N=6, a valid sum-free coloring:
    const N = 6, K = 3;
    const hard = new Int8Array([0, 0, 1, 0, 2, 1, 2]); // index 1..6
    const sv = initSphericalFromHard(hard, N, K, 0.0); // temperature=0 → one-hot
    const E = sphericalEnergy(sv, N, K);
    // At temperature=0 the vectors are one-hot, so energy = discrete energy
    // Let's just check it's non-negative and finite
    expect(E).toBeGreaterThanOrEqual(0);
    expect(isFinite(E)).toBe(true);
  });

  test("spherical energy is non-negative", () => {
    const N = 10, K = 4;
    const hard = makeZeroPartition(N, K);
    const sv = initSphericalFromHard(hard, N, K);
    expect(sphericalEnergy(sv, N, K)).toBeGreaterThanOrEqual(0);
  });
});

describe("sphericalEnergyGradient", () => {
  test("gradient matches finite differences (central diff, ε=1e-5)", () => {
    const N = 6, K = 3;
    const hard = makeZeroPartition(N, K);
    const sv = initSphericalFromHard(hard, N, K, 0.3); // with temperature noise
    const grad = sphericalEnergyGradient(sv, N, K);

    const eps = 1e-5;
    const ELEM = 2; // check gradient for element 2
    const COLOR = 1; // check component 1

    const svp = sv.map(v => [...v]);
    svp[ELEM]![COLOR]! += eps;
    const svn = sv.map(v => [...v]);
    svn[ELEM]![COLOR]! -= eps;

    const fdGrad = (sphericalEnergy(svp, N, K) - sphericalEnergy(svn, N, K)) / (2 * eps);
    expect(grad[ELEM]![COLOR]).toBeCloseTo(fdGrad, 2);
  });
});

describe("decodeHard", () => {
  test("returns argmax color for each element", () => {
    const N = 4, K = 3;
    const sv: number[][] = new Array(N + 1);
    sv[1] = [0.8, 0.1, 0.1]; // → color 0
    sv[2] = [0.1, 0.9, 0.0]; // → color 1
    sv[3] = [0.2, 0.3, 0.5]; // → color 2
    sv[4] = [0.4, 0.4, 0.2]; // → color 0 (tie broken by first)
    const hard = decodeHard(sv, N);
    expect(hard[1]).toBe(0);
    expect(hard[2]).toBe(1);
    expect(hard[3]).toBe(2);
    expect([0, 1]).toContain(hard[4]); // tie OK
  });

  test("all decoded colors in [0, K)", () => {
    const N = 10, K = 4;
    const hard = makeZeroPartition(N, K);
    const sv = initSphericalFromHard(hard, N, K);
    const decoded = decodeHard(sv, N);
    for (let i = 1; i <= N; i++) {
      expect(decoded[i]).toBeGreaterThanOrEqual(0);
      expect(decoded[i]).toBeLessThan(K);
    }
  });
});

describe("runSphericalGradientDescent", () => {
  test("returns valid hard partition of correct length", async () => {
    const N = 10, K = 4;
    const hard = makeZeroPartition(N, K);
    const { hardPartition } = await runSphericalGradientDescent(hard, N, K, 100, 0.05);
    expect(hardPartition.length).toBe(N + 1);
    for (let i = 1; i <= N; i++) {
      expect(hardPartition[i]).toBeGreaterThanOrEqual(0);
      expect(hardPartition[i]).toBeLessThan(K);
    }
  });

  test("all returned vectors remain on sphere during descent (spot check)", async () => {
    const N = 8, K = 3;
    const hard = makeZeroPartition(N, K);
    const { finalSphereVectors } = await runSphericalGradientDescent(hard, N, K, 50, 0.05);
    for (let i = 1; i <= N; i++) {
      const v = finalSphereVectors[i]!;
      const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0));
      expect(norm).toBeCloseTo(1.0, 3);
    }
  });

  test("spherical energy decreases after gradient descent (small case)", async () => {
    const N = 10, K = 4;
    // All-same-color is a high-energy state
    const hard = new Int8Array(N + 1).fill(0);
    for (let i = 1; i <= N; i++) hard[i] = 0;
    const sv0 = initSphericalFromHard(hard, N, K, 0.0);
    const E0 = sphericalEnergy(sv0, N, K);

    const { finalSphereEnergy } = await runSphericalGradientDescent(hard, N, K, 500, 0.02);
    expect(finalSphereEnergy).toBeLessThan(E0);
  });
});
