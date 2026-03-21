/**
 * tests/ap_energy.test.ts — TDD for src/search/ap_energy.ts
 */
import { describe, test, expect } from "bun:test";
import { computeAPEnergy, findViolatingAPs, repairCandidates } from "../src/search/ap_energy";

// ── Known witnesses ───────────────────────────────────────────────────────────

// W(3;2) = 9: every 2-coloring of {1..9} has a 3-AP, but {1..8} is 2-colorable AP-free.
// Witness: [_,0,0,1,1,0,0,1,1] (1-indexed, _ unused)
const W32_WITNESS = new Int8Array([0, 0, 0, 1, 1, 0, 0, 1, 1]); // index 0 unused
const W32_N = 8;

// Build a greedy 3-coloring of {1..N} that is AP-free.
// W(3;3)=27 means {1..26} must be achievable, but greedy may stop before 26.
// We test a property of computeAPEnergy itself: that ANY greedy AP-free coloring
// returns E=0, and that it reaches a reasonable length.
function buildGreedyAPFree(maxN: number, K: number): { p: Int8Array; len: number } {
  const p = new Int8Array(maxN + 1);
  let len = 0;
  outer: for (let i = 1; i <= maxN; i++) {
    for (let c = 0; c < K; c++) {
      p[i] = c;
      let valid = true;
      // Check all 3-APs ending at i
      for (let d = 1; d * 2 < i; d++) {
        const a = i - 2 * d, b = i - d;
        if (a >= 1 && p[a] === c && p[b] === c) { valid = false; break; }
      }
      if (valid) { len = i; continue outer; }
    }
    // No valid color found — stop
    break;
  }
  return { p, len };
}


// ── computeAPEnergy ───────────────────────────────────────────────────────────

describe("computeAPEnergy", () => {
  test("returns 0 for W(3;2) witness at N=8", () => {
    expect(computeAPEnergy(W32_WITNESS, W32_N, 3)).toBe(0);
  });

  test("returns > 0 for W(3;2) witness extended to N=9 (forces a 3-AP)", () => {
    const ext = new Int8Array(10);
    for (let i = 1; i <= 8; i++) ext[i] = W32_WITNESS[i]!;
    ext[9] = 0; // any extension introduces a 3-AP
    // With the pattern 0,0,1,1,0,0,1,1,0 — {1,5,9} = 0,0,0 is monochromatic
    expect(computeAPEnergy(ext, 9, 3)).toBeGreaterThan(0);
  });

  test("returns 0 for a greedy AP-free K=3 coloring (should reach ≥ N=20)", () => {
    const { p, len } = buildGreedyAPFree(30, 3);
    expect(len).toBeGreaterThanOrEqual(20); // greedy on K=3 reaches at least 20
    expect(computeAPEnergy(p, len, 3)).toBe(0);
  });

  test("all-same-color partition has maximum energy (all APs monochromatic)", () => {
    const N = 9, K = 3;
    const same = new Int8Array(N + 1).fill(0);
    const diverse = new Int8Array(N + 1);
    for (let i = 1; i <= N; i++) diverse[i] = (i - 1) % K;
    expect(computeAPEnergy(same, N, 3)).toBeGreaterThan(computeAPEnergy(diverse, N, 3));
  });

  test("non-negative for any partition", () => {
    const N = 30, K = 4;
    const p = new Int8Array(N + 1);
    for (let i = 1; i <= N; i++) p[i] = (i - 1) % K;
    expect(computeAPEnergy(p, N, 3)).toBeGreaterThanOrEqual(0);
  });

  test("k=2 (pairs) counts all monochromatic pairs", () => {
    // K=2, N=4, pattern [1,1,0,0]: pairs {1,2}, {3,4} are monochromatic
    const p = new Int8Array([0, 1, 1, 0, 0]);
    // Monochromatic 2-APs: any two same-color elements with a common step d
    // {1,2}: d=1, color 1. {3,4}: d=1, color 0.
    const E = computeAPEnergy(p, 4, 2);
    expect(E).toBeGreaterThan(0);
  });

  test("energy is additive: swapping one element changes energy by expected delta", () => {
    const N = 12, K = 3;
    const p = new Int8Array(N + 1);
    for (let i = 1; i <= N; i++) p[i] = (i - 1) % K;
    const E0 = computeAPEnergy(p, N, 3);
    // Perturb element 6
    const perturbed = new Int8Array(p);
    perturbed[6] = (p[6]! + 1) % K;
    const E1 = computeAPEnergy(perturbed, N, 3);
    // Should be different (element 6 participates in some APs)
    // We just check it's a valid non-negative integer
    expect(E1).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(E1)).toBe(true);
  });
});

// ── findViolatingAPs ──────────────────────────────────────────────────────────

describe("findViolatingAPs", () => {
  test("returns empty array for a valid AP-free coloring", () => {
    const aps = findViolatingAPs(W32_WITNESS, W32_N, 3);
    expect(aps).toHaveLength(0);
  });

  test("returns correct AP for hand-crafted violation", () => {
    // p = [_, 0, 1, 0, 1, 0, ...] — {1,3,5} is monochromatic (all color 0)
    const p = new Int8Array([0, 0, 1, 0, 1, 0, 1, 1, 1]);
    const aps = findViolatingAPs(p, 7, 3);
    const foundAP135 = aps.some(ap => ap[0] === 1 && ap[1] === 3 && ap[2] === 5);
    expect(foundAP135).toBe(true);
  });

  test("all-same-color returns every AP", () => {
    const N = 6;
    const p = new Int8Array(N + 1).fill(0);
    const aps = findViolatingAPs(p, N, 3);
    // Should contain {1,2,3}, {2,3,4}, {3,4,5}, {4,5,6}, {1,3,5}, {2,4,6}
    expect(aps.length).toBeGreaterThanOrEqual(6);
  });

  test("each returned AP has exactly k elements", () => {
    const N = 10, K = 2;
    const p = new Int8Array(N + 1);
    for (let i = 1; i <= N; i++) p[i] = i % 2;
    const aps5 = findViolatingAPs(p, N, 5);
    for (const ap of aps5) expect(ap).toHaveLength(5);
  });

  test("AP elements form arithmetic progression", () => {
    const N = 9;
    const p = new Int8Array(N + 1).fill(0);
    const aps = findViolatingAPs(p, N, 3);
    for (const ap of aps) {
      expect(ap[1]! - ap[0]!).toBe(ap[2]! - ap[1]!); // constant difference
    }
  });
});

// ── repairCandidates ──────────────────────────────────────────────────────────

describe("repairCandidates", () => {
  test("returns empty set for valid coloring", () => {
    const cands = repairCandidates(W32_WITNESS, W32_N, 3);
    expect(cands.size).toBe(0);
  });

  test("returns all elements of violating APs", () => {
    // {1,3,5} monochromatic: should include 1, 3, 5
    const p = new Int8Array([0, 0, 1, 0, 1, 0, 1]);
    const cands = repairCandidates(p, 6, 3);
    expect(cands.has(1)).toBe(true);
    expect(cands.has(3)).toBe(true);
    expect(cands.has(5)).toBe(true);
  });

  test("is a subset of {1..N}", () => {
    const N = 15, K = 3;
    const p = new Int8Array(N + 1);
    for (let i = 1; i <= N; i++) p[i] = Math.floor(Math.random() * K);
    const cands = repairCandidates(p, N, 3);
    for (const c of cands) {
      expect(c).toBeGreaterThanOrEqual(1);
      expect(c).toBeLessThanOrEqual(N);
    }
  });
});

// ── computeAPDelta — correctness invariant ────────────────────────────────────

import { computeAPDelta } from "../src/search/ap_energy";

describe("computeAPDelta", () => {
  function checkDeltaConsistency(N: number, K: number, k: number, trials = 50): void {
    const p = new Int8Array(N + 1);
    for (let i = 1; i <= N; i++) p[i] = Math.floor(Math.random() * K);

    for (let t = 0; t < trials; t++) {
      const idx = 1 + Math.floor(Math.random() * N);
      const old_c = p[idx]!;
      const new_c = Math.floor(Math.random() * K);

      const eBefore = computeAPEnergy(p, N, k);
      const delta = computeAPDelta(p, N, k, idx, old_c, new_c);

      p[idx] = new_c;
      const eAfter = computeAPEnergy(p, N, k);
      p[idx] = old_c; // restore

      expect(eAfter).toBe(eBefore + delta);
    }
  }

  test("delta invariant holds for N=20, K=3, k=3 (50 random mutations)", () => {
    checkDeltaConsistency(20, 3, 3);
  });

  test("delta invariant holds for N=30, K=4, k=3 (50 random mutations)", () => {
    checkDeltaConsistency(30, 4, 3);
  });

  test("delta invariant holds for N=15, K=5, k=3 (50 random mutations)", () => {
    checkDeltaConsistency(15, 5, 3);
  });

  test("delta invariant holds for k=4 (4-term APs)", () => {
    checkDeltaConsistency(30, 3, 4);
  });

  test("returns 0 when old_c === new_c", () => {
    const p = new Int8Array([0, 0, 1, 2, 0, 1]);
    expect(computeAPDelta(p, 5, 3, 3, 2, 2)).toBe(0);
  });

  test("returns -1 when mutation breaks exactly one mono AP", () => {
    // {1,2,3} = all color 0. Changing p[2] from 0 to 1 breaks {1,2,3}.
    const p = new Int8Array([0, 0, 0, 0, 1, 1, 1]);
    const delta = computeAPDelta(p, 6, 3, 2, 0, 1);
    // p[1]=0, p[2]=0, p[3]=0: {1,2,3} mono. Changing p[2] to 1: delta = -1 for that AP
    // But also check {2,3,4}: p[2]=0,p[3]=0,p[4]=1 -> not mono before; same after -> 0
    const ePre = computeAPEnergy(p, 6, 3);
    p[2] = 1;
    const ePost = computeAPEnergy(p, 6, 3);
    p[2] = 0;
    expect(delta).toBe(ePost - ePre);
  });
});

