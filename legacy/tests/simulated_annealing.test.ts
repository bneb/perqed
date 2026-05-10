/**
 * Sprint 23: SimulatedAnnealing Tests (TDD)
 *
 * Tests the generic SA engine using a MockState that targets the number 42.
 */

import { describe, test, expect } from "bun:test";
import { SimulatedAnnealing } from "../src/math/optim/SimulatedAnnealing";
import type { IState } from "../src/math/optim/IState";

/** Mock IState: optimizes an integer toward the target 42. */
class MockState implements IState<number> {
  constructor(private value: number) {}

  getPayload(): number {
    return this.value;
  }

  getEnergy(): number {
    return Math.abs(this.value - 42);
  }

  mutate(): IState<number> | null {
    const delta = Math.random() > 0.5 ? 1 : -1;
    return new MockState(this.value + delta);
  }
}

describe("SimulatedAnnealing", () => {
  test("descends gradient and finds energy 0 on MockState", () => {
    const initial = new MockState(0);
    const result = SimulatedAnnealing.run(initial, {
      maxIterations: 50_000,
      initialTemp: 50.0,
      coolingRate: 0.9999,
    });

    expect(result.foundZero).toBe(true);
    expect(result.bestEnergy).toBe(0);
    expect(result.bestState.getPayload()).toBe(42);
    expect(result.iterations).toBeLessThan(50_000);
  });

  test("returns best state even if zero not found with tiny budget", () => {
    const initial = new MockState(0);
    const result = SimulatedAnnealing.run(initial, {
      maxIterations: 10,
      initialTemp: 1.0,
      coolingRate: 0.5,
    });

    expect(result.iterations).toBe(10);
    // Energy should have improved from initial 42
    expect(result.bestEnergy).toBeLessThan(42);
  });

  test("calls onImprovement callback when energy improves", () => {
    const improvements: number[] = [];
    const initial = new MockState(0);

    SimulatedAnnealing.run(initial, {
      maxIterations: 1000,
      initialTemp: 50.0,
      coolingRate: 0.999,
      onImprovement: (_iter, energy) => improvements.push(energy),
    });

    // Should have recorded at least one improvement
    expect(improvements.length).toBeGreaterThan(0);
    // Improvements should be monotonically decreasing
    for (let i = 1; i < improvements.length; i++) {
      expect(improvements[i]).toBeLessThan(improvements[i - 1]!);
    }
  });
});
