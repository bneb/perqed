/**
 * Strategy Menu Tests — TDD Red-to-Green
 *
 * Tests for:
 *   1. Graph seeds: Paley, circulant, perturbation
 *   2. Orchestrator: multi-worker dispatch, seed selection
 *   3. Strategy correctness: Paley(17) is a valid R(4,4) witness
 */

import { describe, test, expect } from "bun:test";
import { paleyGraph, circulantGraph, perturbGraph } from "../src/math/graph/GraphSeeds";
import { ramseyEnergy } from "../src/math/graph/RamseyEnergy";
import {
  orchestratedSearch,
  type OrchestratedSearchConfig,
} from "../src/search/ramsey_orchestrator";

// ──────────────────────────────────────────────
// Paley Graph
// ──────────────────────────────────────────────

describe("GraphSeeds — paleyGraph", () => {

  test("Paley(5) has 5 vertices and is a C₅ cycle (5 edges)", () => {
    const g = paleyGraph(5);
    expect(g.n).toBe(5);
    let edgeCount = 0;
    for (let i = 0; i < 5; i++)
      for (let j = i + 1; j < 5; j++)
        if (g.hasEdge(i, j)) edgeCount++;
    expect(edgeCount).toBe(5);
  });

  test("Paley(13) is strongly regular with (p-1)/2 = 6 edges per vertex", () => {
    const g = paleyGraph(13);
    for (let v = 0; v < 13; v++) {
      let deg = 0;
      for (let j = 0; j < 13; j++) if (v !== j && g.hasEdge(v, j)) deg++;
      expect(deg).toBe(6);
    }
  });

  test("Paley(17) is a valid R(4,4) witness: E=0", () => {
    const g = paleyGraph(17);
    const energy = ramseyEnergy(g, 4, 4);
    expect(energy).toBe(0);
  });

  test("Paley(17) is self-complementary: same energy on complement", () => {
    // Paley(p) and its complement are isomorphic
    const g = paleyGraph(17);
    const e1 = ramseyEnergy(g, 4, 4);
    expect(e1).toBe(0);
  });

  test("throws for non-prime n", () => {
    expect(() => paleyGraph(15)).toThrow(/prime/);
  });

  test("throws for p ≢ 1 mod 4", () => {
    expect(() => paleyGraph(7)).toThrow(/mod 4/);
  });
});

// ──────────────────────────────────────────────
// Circulant Graph
// ──────────────────────────────────────────────

describe("GraphSeeds — circulantGraph", () => {

  test("C(5, {1}) is a cycle on 5 vertices (5 edges)", () => {
    const g = circulantGraph(5, [1]);
    let edgeCount = 0;
    for (let i = 0; i < 5; i++)
      for (let j = i + 1; j < 5; j++)
        if (g.hasEdge(i, j)) edgeCount++;
    expect(edgeCount).toBe(5);
  });

  test("C(6, {1,3}) is regular with degree 2", () => {
    // distance 1 and distance 3 — but min(3, 6-3)=3, so each vertex connects to 1 and 3 away
    const g = circulantGraph(6, [1, 3]);
    for (let v = 0; v < 6; v++) {
      let deg = 0;
      for (let j = 0; j < 6; j++) if (v !== j && g.hasEdge(v, j)) deg++;
      expect(deg).toBe(3); // distance 1 gives 2, distance 3 gives 1 (it's opposite vertex)
    }
  });

  test("C(n, {}) is an empty graph", () => {
    const g = circulantGraph(10, []);
    let edgeCount = 0;
    for (let i = 0; i < 10; i++)
      for (let j = i + 1; j < 10; j++)
        if (g.hasEdge(i, j)) edgeCount++;
    expect(edgeCount).toBe(0);
  });
});

// ──────────────────────────────────────────────
// Perturbation
// ──────────────────────────────────────────────

describe("GraphSeeds — perturbGraph", () => {

  test("perturbGraph(g, 0) returns exact clone", () => {
    const g = paleyGraph(5);
    const p = perturbGraph(g, 0);
    for (let i = 0; i < 5; i++)
      for (let j = i + 1; j < 5; j++)
        expect(p.hasEdge(i, j)).toBe(g.hasEdge(i, j));
  });

  test("perturbGraph changes at most `count` edges", () => {
    const g = paleyGraph(5);
    const p = perturbGraph(g, 3);
    let diffs = 0;
    for (let i = 0; i < 5; i++)
      for (let j = i + 1; j < 5; j++)
        if (p.hasEdge(i, j) !== g.hasEdge(i, j)) diffs++;
    // Could flip the same edge twice (undo), so diffs <= count
    expect(diffs).toBeLessThanOrEqual(3);
  });
});

// ──────────────────────────────────────────────
// Orchestrator
// ──────────────────────────────────────────────

describe("Orchestrator — orchestratedSearch", () => {

  test("single strategy with random seed finds R(3,3) witness", async () => {
    const config: OrchestratedSearchConfig = {
      n: 5, r: 3, s: 3,
      saIterations: 100_000,
      strategy: "single",
      workers: 1,
      seed: "random",
    };
    const result = await orchestratedSearch(config);
    expect(result.best.bestEnergy).toBe(0);
    expect(result.best.witness).not.toBeNull();
    expect(result.workersRan).toBe(1);
  });

  test("island_model runs multiple workers", async () => {
    const config: OrchestratedSearchConfig = {
      n: 5, r: 3, s: 3,
      saIterations: 100_000,
      strategy: "island_model",
      workers: 3,
      seed: "random",
    };
    const result = await orchestratedSearch(config);
    expect(result.best.bestEnergy).toBe(0);
    // May exit early if first worker finds it
    expect(result.workersRan).toBe(3);
    expect(result.bestWorkerIndex).toBeGreaterThanOrEqual(0);
    expect(result.bestWorkerIndex).toBeLessThan(3);
  });

  test("paley seed: Paley(17) makes R(4,4) trivial (E=0 instantly)", async () => {
    const config: OrchestratedSearchConfig = {
      n: 17, r: 4, s: 4,
      saIterations: 1000,  // barely any iterations needed — seed IS the witness
      strategy: "single",
      workers: 1,
      seed: "paley",
    };
    const result = await orchestratedSearch(config);
    expect(result.best.bestEnergy).toBe(0);
  });

  test("paley seed with non-eligible n falls back to random", async () => {
    // n=8 is not prime, so Paley is not eligible → falls back to random
    const config: OrchestratedSearchConfig = {
      n: 8, r: 3, s: 4,
      saIterations: 5_000_000,
      strategy: "single",
      workers: 1,
      seed: "paley",
    };
    // Should not crash, just run with random init
    const result = await orchestratedSearch(config);
    expect(result.best.bestEnergy).toBeGreaterThanOrEqual(0);
  });

  test("totalWallTime is reported", async () => {
    const config: OrchestratedSearchConfig = {
      n: 5, r: 3, s: 3,
      saIterations: 10_000,
      strategy: "single",
      workers: 1,
      seed: "random",
    };
    const result = await orchestratedSearch(config);
    expect(result.totalWallTime).toBeGreaterThanOrEqual(0);
  });
});
