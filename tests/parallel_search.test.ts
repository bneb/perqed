/**
 * Parallel Search Tests — TDD for Bun Worker parallelism.
 *
 * Tests:
 *   1. Single mode: R(3,3) on 5v finds E=0 witness
 *   2. Parallel mode (island_model): R(3,3) on 5v with 4 workers
 *   3. Result has proper witness AdjacencyMatrix
 */

import { describe, test, expect } from "bun:test";
import { orchestratedSearch } from "../src/search/ramsey_orchestrator";

describe("Parallel Search", () => {
  test("single mode: R(3,3) on 5v finds E=0", async () => {
    const result = await orchestratedSearch({
      n: 5,
      r: 3,
      s: 3,
      saIterations: 1_000_000,
      strategy: "single",
      workers: 1,
      seed: "random",
    });

    expect(result.best.bestEnergy).toBe(0);
    expect(result.best.witness).not.toBeNull();
    expect(result.best.witness!.n).toBe(5);
    expect(result.workersRan).toBe(1);
    expect(result.bestWorkerIndex).toBe(0);
    expect(result.totalWallTime).toBeGreaterThan(0);
  });

  test("parallel mode: R(3,3) on 5v with 4 workers finds E=0", async () => {
    const result = await orchestratedSearch({
      n: 5,
      r: 3,
      s: 3,
      saIterations: 1_000_000,
      strategy: "island_model",
      workers: 4,
      seed: "random",
    });

    expect(result.best.bestEnergy).toBe(0);
    expect(result.best.witness).not.toBeNull();
    expect(result.best.witness!.n).toBe(5);
    expect(result.workersRan).toBe(4);
    expect(result.totalWallTime).toBeGreaterThan(0);
  });

  test("single mode: progress callback fires", async () => {
    const progressCalls: number[] = [];

    await orchestratedSearch({
      n: 5,
      r: 3,
      s: 3,
      saIterations: 1_000_000,
      strategy: "single",
      workers: 1,
      seed: "random",
      onProgress: (worker, iter) => {
        progressCalls.push(iter);
      },
    });

    expect(progressCalls.length).toBeGreaterThan(0);
  });
});
