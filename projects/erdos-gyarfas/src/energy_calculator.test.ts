/**
 * Sprint 22: EnergyCalculator Tests (TDD RED → GREEN)
 *
 * Tests the cost function that counts power-of-2 cycles in a graph.
 */

import { describe, test, expect } from "bun:test";
import { EnergyCalculator } from "./energy_calculator";

describe("EnergyCalculator", () => {
  test("K_4 has positive energy (contains 4-cycles)", () => {
    const k4 = [
      [1, 2, 3],
      [0, 2, 3],
      [0, 1, 3],
      [0, 1, 2],
    ];
    expect(EnergyCalculator.calculateEnergy(k4)).toBeGreaterThan(0);
  });

  test("C_7 has zero energy (no 4, 8, or 16-cycles)", () => {
    const c7 = Array.from({ length: 7 }, (_, i) => [
      (i + 1) % 7,
      (i + 6) % 7,
    ]);
    expect(EnergyCalculator.calculateEnergy(c7)).toBe(0);
  });

  test("C_5 has zero energy (5-cycle is not a power of 2)", () => {
    const c5 = Array.from({ length: 5 }, (_, i) => [
      (i + 1) % 5,
      (i + 4) % 5,
    ]);
    expect(EnergyCalculator.calculateEnergy(c5)).toBe(0);
  });

  test("C_8 has positive energy (8-cycle is a power of 2)", () => {
    const c8 = Array.from({ length: 8 }, (_, i) => [
      (i + 1) % 8,
      (i + 7) % 8,
    ]);
    expect(EnergyCalculator.calculateEnergy(c8)).toBeGreaterThan(0);
  });

  test("empty graph has zero energy", () => {
    expect(EnergyCalculator.calculateEnergy([])).toBe(0);
  });
});
