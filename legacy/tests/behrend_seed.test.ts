/**
 * tests/behrend_seed.test.ts — TDD for src/search/behrend_seed.ts
 */
import { describe, test, expect } from "bun:test";
import {
  seedBehrend,
  seedVanDerCorput,
  seedSalemSpencer,
  seedQuadraticResidue,
  allSeeds,
} from "../src/search/behrend_seed";
import { computeAPEnergy } from "../src/search/ap_energy";

const N = 50, K = 5;

// ── Output validity ───────────────────────────────────────────────────────────

describe("seedBehrend", () => {
  test("returns 1-indexed array of length N+1", () => {
    const p = seedBehrend(N, K);
    expect(p.length).toBe(N + 1);
  });

  test("all values in [0, K)", () => {
    const p = seedBehrend(N, K);
    for (let i = 1; i <= N; i++) {
      expect(p[i]).toBeGreaterThanOrEqual(0);
      expect(p[i]).toBeLessThan(K);
    }
  });

  test("deterministic — same output for same N, K", () => {
    const a = seedBehrend(N, K);
    const b = seedBehrend(N, K);
    for (let i = 1; i <= N; i++) expect(a[i]).toBe(b[i]);
  });

  test("produces lower energy than modular seed at N=50, K=5", () => {
    const modular = new Int8Array(N + 1);
    for (let i = 1; i <= N; i++) modular[i] = (i - 1) % K;
    const eModular = computeAPEnergy(modular, N, 3);
    const eBehrend = computeAPEnergy(seedBehrend(N, K), N, 3);
    // Behrend should be structurally better than raw modular
    expect(eBehrend).toBeLessThan(eModular);
  });

  test("works for K=2 and K=3", () => {
    for (const k of [2, 3]) {
      const p = seedBehrend(20, k);
      for (let i = 1; i <= 20; i++) {
        expect(p[i]).toBeGreaterThanOrEqual(0);
        expect(p[i]).toBeLessThan(k);
      }
    }
  });
});

describe("seedVanDerCorput", () => {
  test("returns valid K-coloring", () => {
    const p = seedVanDerCorput(N, K);
    expect(p.length).toBe(N + 1);
    for (let i = 1; i <= N; i++) {
      expect(p[i]).toBeGreaterThanOrEqual(0);
      expect(p[i]).toBeLessThan(K);
    }
  });

  test("deterministic", () => {
    const a = seedVanDerCorput(N, K);
    const b = seedVanDerCorput(N, K);
    for (let i = 1; i <= N; i++) expect(a[i]).toBe(b[i]);
  });

  test("not same as modular seed (provides diversity)", () => {
    const modular = new Int8Array(N + 1);
    for (let i = 1; i <= N; i++) modular[i] = (i - 1) % K;
    const vdc = seedVanDerCorput(N, K);
    let diffs = 0;
    for (let i = 1; i <= N; i++) if (vdc[i] !== modular[i]) diffs++;
    expect(diffs).toBeGreaterThan(N / 4);
  });
});

describe("seedSalemSpencer", () => {
  test("returns valid K-coloring", () => {
    const p = seedSalemSpencer(N, K);
    expect(p.length).toBe(N + 1);
    for (let i = 1; i <= N; i++) {
      expect(p[i]).toBeGreaterThanOrEqual(0);
      expect(p[i]).toBeLessThan(K);
    }
  });

  test("produces lower energy than modular at N=26, K=3 (AP-free by construction)", () => {
    const modular = new Int8Array(27);
    for (let i = 1; i <= 26; i++) modular[i] = (i - 1) % 3;
    const eModular = computeAPEnergy(modular, 26, 3);
    const eSalem = computeAPEnergy(seedSalemSpencer(26, 3), 26, 3);
    // Salem-Spencer assigns each element to an AP-free class, so E ≤ eModular
    expect(eSalem).toBeLessThanOrEqual(eModular);
  });
});

describe("seedQuadraticResidue", () => {
  test("returns valid K-coloring", () => {
    const p = seedQuadraticResidue(N, K);
    expect(p.length).toBe(N + 1);
    for (let i = 1; i <= N; i++) {
      expect(p[i]).toBeGreaterThanOrEqual(0);
      expect(p[i]).toBeLessThan(K);
    }
  });

  test("deterministic with fixed prime", () => {
    const a = seedQuadraticResidue(N, K, 53);
    const b = seedQuadraticResidue(N, K, 53);
    for (let i = 1; i <= N; i++) expect(a[i]).toBe(b[i]);
  });
});

describe("allSeeds", () => {
  test("returns K distinct seeds (one per strategy)", () => {
    const seeds = allSeeds(N, K);
    expect(seeds.length).toBe(4);
  });

  test("all seeds produce diverse colorings (pairwise diffs > 10%)", () => {
    const seeds = allSeeds(N, K);
    for (let i = 0; i < seeds.length; i++) {
      for (let j = i + 1; j < seeds.length; j++) {
        let diffs = 0;
        for (let x = 1; x <= N; x++) if (seeds[i]![x] !== seeds[j]![x]) diffs++;
        expect(diffs).toBeGreaterThan(N * 0.1);
      }
    }
  });
});
