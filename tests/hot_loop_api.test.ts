/**
 * Tests for IncrementalSRGEngine's zero-allocation hot loop API:
 * proposeSwap → commitSwap / discardSwap
 *
 * This API is designed for bare-metal Metropolis-Hastings without
 * any object allocation in the inner loop.
 */

import { describe, expect, it } from "bun:test";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";
import { IncrementalSRGEngine } from "../src/math/graph/IncrementalSRGEngine";
import { srgEnergyAlgebraic } from "../src/math/graph/SRGEnergy";

// Rook(3,3) = SRG(9, 4, 1, 2)
function createRookGraph(): AdjacencyMatrix {
  const g = new AdjacencyMatrix(9);
  for (let i = 0; i < 3; i++) {
    for (let j1 = 0; j1 < 3; j1++) {
      for (let j2 = j1 + 1; j2 < 3; j2++) {
        g.addEdge(3 * i + j1, 3 * i + j2);
      }
    }
  }
  for (let j = 0; j < 3; j++) {
    for (let i1 = 0; i1 < 3; i1++) {
      for (let i2 = i1 + 1; i2 < 3; i2++) {
        g.addEdge(3 * i1 + j, 3 * i2 + j);
      }
    }
  }
  return g;
}

describe("Zero-allocation swap API", () => {
  it("proposeRandomSwap returns delta energy without mutating state", () => {
    const g = AdjacencyMatrix.randomRegular(20, 4);
    const engine = new IncrementalSRGEngine(g, 4, 1, 2);
    const originalEnergy = engine.energy;

    // Try to get a valid proposal
    for (let i = 0; i < 100; i++) {
      const delta = engine.proposeRandomSwap();
      if (delta !== null) {
        // State should NOT have changed
        expect(engine.energy).toBe(originalEnergy);
        // Delta should predict the new energy
        const expectedNewEnergy = originalEnergy + delta;
        engine.commitSwap();
        expect(engine.energy).toBe(expectedNewEnergy);
        return;
      }
    }
    throw new Error("No valid swap found in 100 attempts");
  });

  it("discardSwap leaves energy unchanged", () => {
    const g = AdjacencyMatrix.randomRegular(20, 4);
    const engine = new IncrementalSRGEngine(g, 4, 1, 2);
    const originalEnergy = engine.energy;

    for (let i = 0; i < 100; i++) {
      const delta = engine.proposeRandomSwap();
      if (delta !== null) {
        engine.discardSwap();
        expect(engine.energy).toBe(originalEnergy);
        return;
      }
    }
    throw new Error("No valid swap found");
  });

  it("commitSwap agrees with full recompute", () => {
    const g = AdjacencyMatrix.randomRegular(20, 4);
    const engine = new IncrementalSRGEngine(g, 4, 1, 2);

    for (let i = 0; i < 100; i++) {
      const delta = engine.proposeRandomSwap();
      if (delta !== null) {
        engine.commitSwap();
        const full = srgEnergyAlgebraic(engine.getGraph(), 4, 1, 2);
        expect(engine.energy).toBe(full);
        return;
      }
    }
    throw new Error("No valid swap found");
  });

  it("multiple commit/discard cycles agree with full recompute", () => {
    const g = AdjacencyMatrix.randomRegular(30, 6);
    const engine = new IncrementalSRGEngine(g, 6, 1, 2);

    let commits = 0;
    let discards = 0;

    for (let trial = 0; trial < 5000 && commits < 500; trial++) {
      const delta = engine.proposeRandomSwap();
      if (delta === null) continue;

      // Accept ~50% of proposals
      if (Math.random() < 0.5) {
        engine.commitSwap();
        commits++;
      } else {
        engine.discardSwap();
        discards++;
      }
    }

    // Final full check
    const full = srgEnergyAlgebraic(engine.getGraph(), 6, 1, 2);
    expect(engine.energy).toBe(full);
    expect(commits).toBeGreaterThan(100);
    expect(discards).toBeGreaterThan(50);
  });

  // The big fuzz: 10K commits with periodic full recompute checks
  it("fuzz: 10K commits with periodic full verification", () => {
    const g = AdjacencyMatrix.randomRegular(30, 6);
    const engine = new IncrementalSRGEngine(g, 6, 1, 2);

    let commits = 0;
    let discrepancies = 0;

    for (let trial = 0; trial < 50_000 && commits < 10_000; trial++) {
      const delta = engine.proposeRandomSwap();
      if (delta === null) continue;

      engine.commitSwap();
      commits++;

      // Verify every 200 commits
      if (commits % 200 === 0) {
        const full = srgEnergyAlgebraic(engine.getGraph(), 6, 1, 2);
        if (engine.energy !== full) {
          discrepancies++;
          console.error(`Discrepancy at commit ${commits}: engine=${engine.energy}, full=${full}`);
        }
      }
    }

    expect(discrepancies).toBe(0);
    expect(commits).toBeGreaterThan(5000);

    // Final check
    const finalFull = srgEnergyAlgebraic(engine.getGraph(), 6, 1, 2);
    expect(engine.energy).toBe(finalFull);
  });
});
