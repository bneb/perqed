/**
 * Tests for O(1) CN delta correctness.
 *
 * These tests verify that the incremental CN cache stays perfectly
 * synchronized with full O(n³) recomputation after every commit.
 * This is stricter than the energy fuzz test — it checks every single
 * CN entry in the n×n matrix, not just the aggregate energy.
 */

import { describe, expect, it } from "bun:test";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";
import { IncrementalSRGEngine } from "../src/math/graph/IncrementalSRGEngine";

/**
 * Compute full n×n common-neighbor matrix from scratch.
 * This is ground truth — O(n³), no caching.
 */
function fullCommonNeighbors(g: AdjacencyMatrix): Int32Array {
  const n = g.n;
  const cn = new Int32Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let count = 0;
      for (let w = 0; w < n; w++) {
        if (g.hasEdge(i, w) && g.hasEdge(j, w)) count++;
      }
      cn[i * n + j] = count;
    }
  }
  return cn;
}

describe("CN delta correctness", () => {
  it("CN cache matches full recompute after a single commit", () => {
    const g = AdjacencyMatrix.randomRegular(20, 4);
    const engine = new IncrementalSRGEngine(g, 4, 1, 2);
    const n = 20;

    for (let trial = 0; trial < 100; trial++) {
      const delta = engine.proposeRandomSwap();
      if (delta === null) continue;

      engine.commitSwap();

      // Get engine's graph and compute ground truth CN
      const graph = engine.getGraph();
      const truthCN = fullCommonNeighbors(graph);
      const engineCN = engine.getCNCache();

      // Every single entry must match
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          expect(engineCN[i * n + j]).toBe(truthCN[i * n + j]);
        }
      }
      return; // one verified commit is enough for this test
    }
    throw new Error("No valid swap found");
  });

  it("CN cache matches full recompute after 100 consecutive commits", () => {
    const g = AdjacencyMatrix.randomRegular(30, 6);
    const engine = new IncrementalSRGEngine(g, 6, 1, 2);
    const n = 30;

    let commits = 0;
    for (let trial = 0; trial < 1000 && commits < 100; trial++) {
      const delta = engine.proposeRandomSwap();
      if (delta === null) continue;

      engine.commitSwap();
      commits++;
    }

    // Check full CN matrix after all commits
    const graph = engine.getGraph();
    const truthCN = fullCommonNeighbors(graph);
    const engineCN = engine.getCNCache();

    let discrepancies = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (engineCN[i * n + j] !== truthCN[i * n + j]) {
          discrepancies++;
        }
      }
    }
    expect(discrepancies).toBe(0);
    expect(commits).toBe(100);
  });

  it("CN cache matches after interleaved commits and discards", () => {
    const g = AdjacencyMatrix.randomRegular(30, 6);
    const engine = new IncrementalSRGEngine(g, 6, 1, 2);
    const n = 30;

    let commits = 0;
    let discards = 0;

    for (let trial = 0; trial < 2000 && commits < 200; trial++) {
      const delta = engine.proposeRandomSwap();
      if (delta === null) continue;

      if (Math.random() < 0.5) {
        engine.commitSwap();
        commits++;
      } else {
        engine.discardSwap();
        discards++;
      }
    }

    const graph = engine.getGraph();
    const truthCN = fullCommonNeighbors(graph);
    const engineCN = engine.getCNCache();

    let discrepancies = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (engineCN[i * n + j] !== truthCN[i * n + j]) {
          discrepancies++;
        }
      }
    }
    expect(discrepancies).toBe(0);
    expect(commits).toBeGreaterThan(50);
  });

  // The big fuzz: 5K commits, check CN matrix every 100 commits
  it("fuzz: CN cache stays correct over 5K commits (checked every 100)", () => {
    const g = AdjacencyMatrix.randomRegular(30, 6);
    const engine = new IncrementalSRGEngine(g, 6, 1, 2);
    const n = 30;

    let commits = 0;
    let checks = 0;
    let discrepancies = 0;

    for (let trial = 0; trial < 50_000 && commits < 5_000; trial++) {
      const delta = engine.proposeRandomSwap();
      if (delta === null) continue;

      engine.commitSwap();
      commits++;

      if (commits % 100 === 0) {
        const graph = engine.getGraph();
        const truthCN = fullCommonNeighbors(graph);
        const engineCN = engine.getCNCache();

        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            if (engineCN[i * n + j] !== truthCN[i * n + j]) {
              discrepancies++;
              if (discrepancies === 1) {
                console.error(
                  `CN mismatch at commit ${commits}: CN[${i}][${j}] engine=${engineCN[i * n + j]} truth=${truthCN[i * n + j]}`
                );
              }
            }
          }
        }
        checks++;
      }
    }

    expect(discrepancies).toBe(0);
    expect(commits).toBeGreaterThan(2000);
    expect(checks).toBeGreaterThan(20);
  });
});
