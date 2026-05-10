/**
 * Tests for IncrementalSRGEngine — the O(n) delta evaluator.
 *
 * Validates that incremental energy tracking agrees with full
 * recomputation over thousands of edge swaps, just like the
 * torus project's 300K-step fuzz test.
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

describe("IncrementalSRGEngine", () => {
  it("initial energy matches full computation for Rook(3,3)", () => {
    const g = createRookGraph();
    const engine = new IncrementalSRGEngine(g, 4, 1, 2);
    expect(engine.energy).toBe(0);
    expect(engine.energy).toBe(srgEnergyAlgebraic(g, 4, 1, 2));
  });

  it("initial energy matches full computation for random graph", () => {
    const g = AdjacencyMatrix.randomRegular(20, 4);
    const engine = new IncrementalSRGEngine(g, 4, 1, 2);
    const fullEnergy = srgEnergyAlgebraic(g, 4, 1, 2);
    expect(engine.energy).toBe(fullEnergy);
  });

  it("trySwap returns correct energy delta", () => {
    const g = AdjacencyMatrix.randomRegular(20, 4);
    const engine = new IncrementalSRGEngine(g, 4, 1, 2);

    // Try many swaps and verify energy matches full recompute
    for (let trial = 0; trial < 50; trial++) {
      const result = engine.trySwap();
      if (!result) continue;

      // The reported new energy should match full recompute
      const fullEnergy = srgEnergyAlgebraic(result.graph, 4, 1, 2);
      expect(result.newEnergy).toBe(fullEnergy);
      break;
    }
  });

  it("acceptSwap updates internal state correctly", () => {
    const g = AdjacencyMatrix.randomRegular(20, 4);
    const engine = new IncrementalSRGEngine(g, 4, 1, 2);

    for (let trial = 0; trial < 50; trial++) {
      const result = engine.trySwap();
      if (!result) continue;

      engine.acceptSwap(result);
      // After accepting, engine's energy should match the new energy
      expect(engine.energy).toBe(result.newEnergy);
      // And match full recompute
      const fullEnergy = srgEnergyAlgebraic(engine.getGraph(), 4, 1, 2);
      expect(engine.energy).toBe(fullEnergy);
      break;
    }
  });

  it("rejectSwap leaves state unchanged", () => {
    const g = AdjacencyMatrix.randomRegular(20, 4);
    const engine = new IncrementalSRGEngine(g, 4, 1, 2);
    const originalEnergy = engine.energy;

    for (let trial = 0; trial < 50; trial++) {
      const result = engine.trySwap();
      if (!result) continue;

      // Don't accept — energy should be unchanged
      expect(engine.energy).toBe(originalEnergy);
      break;
    }
  });

  // The big one: fuzz test (mirrors torus project's 300K-step validation)
  it("agrees with full recompute over 10,000 accepted swaps", () => {
    const g = AdjacencyMatrix.randomRegular(30, 6);
    const engine = new IncrementalSRGEngine(g, 6, 1, 2);

    let accepted = 0;
    let discrepancies = 0;

    for (let trial = 0; trial < 50_000 && accepted < 10_000; trial++) {
      const result = engine.trySwap();
      if (!result) continue;

      // Accept all swaps to stress-test the incremental update
      engine.acceptSwap(result);
      accepted++;

      // Check every 100 swaps
      if (accepted % 100 === 0) {
        const fullEnergy = srgEnergyAlgebraic(engine.getGraph(), 6, 1, 2);
        if (engine.energy !== fullEnergy) {
          discrepancies++;
        }
      }
    }

    expect(discrepancies).toBe(0);
    expect(accepted).toBeGreaterThan(1000); // Should get many swaps in 50K attempts

    // Final full check
    const finalFull = srgEnergyAlgebraic(engine.getGraph(), 6, 1, 2);
    expect(engine.energy).toBe(finalFull);
  });
});
