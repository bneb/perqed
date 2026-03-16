/**
 * AnnealingSchedule Tests
 *
 * Verifies the extracted schedule logic: cooling, adaptive reheat,
 * exponential backoff, legacy reheat, and acceptance probability.
 */

import { describe, test, expect } from "bun:test";
import { AnnealingSchedule } from "../src/math/optim/AnnealingSchedule";

describe("AnnealingSchedule", () => {
  test("cooling: temperature decreases each step", () => {
    const s = new AnnealingSchedule({ initialTemp: 100, coolingRate: 0.9 });
    expect(s.temp).toBe(100);
    s.step();
    expect(s.temp).toBeCloseTo(90, 5);
    s.step();
    expect(s.temp).toBeCloseTo(81, 5);
  });

  test("acceptProbability returns 1.0 for improvements", () => {
    const s = new AnnealingSchedule({ initialTemp: 50, coolingRate: 0.99 });
    expect(s.acceptProbability(-5)).toBe(1.0);
    expect(s.acceptProbability(-0.001)).toBe(1.0);
  });

  test("acceptProbability returns exp(-dE/T) for worsenings", () => {
    const s = new AnnealingSchedule({ initialTemp: 50, coolingRate: 0.99 });
    const p = s.acceptProbability(10);
    expect(p).toBeCloseTo(Math.exp(-10 / 50), 10);
  });

  test("acceptProbability returns 0 when temp is 0", () => {
    const s = new AnnealingSchedule({ initialTemp: 0, coolingRate: 0.99 });
    expect(s.acceptProbability(10)).toBe(0.0);
  });

  test("adaptive reheat fires after reheatWindow steps", () => {
    const s = new AnnealingSchedule({
      initialTemp: 50,
      coolingRate: 0.99,
      reheatWindow: 5,
      maxIterations: 1000,
    });
    // Record a best energy
    s.recordImprovement(100);

    // Step 5 times without improvement
    for (let i = 0; i < 4; i++) s.step();
    const tempBefore = s.temp;

    // 5th step triggers reheat
    s.step();
    // Reheat to max(1, 100^0.4) = max(1, 6.31) ≈ 6.31
    expect(s.temp).toBeCloseTo(Math.pow(100, 0.4), 1);
  });

  test("adaptive reheat backoff doubles the window", () => {
    const s = new AnnealingSchedule({
      initialTemp: 50,
      coolingRate: 1.0, // no cooling, isolate reheat behavior
      reheatWindow: 5,
      maxIterations: 1000,
    });
    s.recordImprovement(100);

    // First reheat at step 5
    for (let i = 0; i < 5; i++) s.step();
    expect(s.temp).toBeCloseTo(Math.pow(100, 0.4), 1);

    // Next reheat should be at step 10 (window doubled to 10)
    for (let i = 0; i < 9; i++) s.step();
    // Not yet — still at cooled temp
    const tempBefore = s.temp;
    s.step(); // 10th step → second reheat
    expect(s.temp).toBeCloseTo(Math.pow(100, 0.4), 1);
  });

  test("recordImprovement resets stagnation counter and backoff", () => {
    const s = new AnnealingSchedule({
      initialTemp: 50,
      coolingRate: 1.0,
      reheatWindow: 5,
      maxIterations: 1000,
    });
    s.recordImprovement(100);

    // 4 steps, then improvement → resets
    for (let i = 0; i < 4; i++) s.step();
    s.recordImprovement(50);

    // Should need another 5 steps for reheat, not 1
    s.step();
    // Reheat to max(1, 50^0.4) ≈ 3.62
    // But it shouldn't fire yet (only 1 step since improvement)
    expect(s.temp).not.toBeCloseTo(Math.pow(50, 0.4), 0);
  });

  test("legacy reheat fires at fixed interval", () => {
    const s = new AnnealingSchedule({
      initialTemp: 50,
      coolingRate: 0.99,
      legacyReheatTemp: 25,
      legacyReheatInterval: 3,
    });

    s.step(); s.step();
    const tempBefore = s.temp;
    s.step(); // 3rd step → legacy reheat
    expect(s.temp).toBe(25);
  });

  test("adaptive reheat takes precedence over legacy", () => {
    const s = new AnnealingSchedule({
      initialTemp: 50,
      coolingRate: 0.99,
      reheatWindow: 3,
      legacyReheatTemp: 25,
      legacyReheatInterval: 3,
      maxIterations: 1000,
    });
    s.recordImprovement(100);

    for (let i = 0; i < 3; i++) s.step();
    // Should use adaptive (E^0.4), not legacy (fixed 25)
    expect(s.temp).toBeCloseTo(Math.pow(100, 0.4), 1);
    expect(s.temp).not.toBe(25);
  });

  test("E^0.4 formula: low energy → low reheat temp", () => {
    const s = new AnnealingSchedule({
      initialTemp: 50,
      coolingRate: 1.0,
      reheatWindow: 1,
      maxIterations: 1000,
    });

    s.recordImprovement(4);
    s.step();
    // 4^0.4 ≈ 1.74
    expect(s.temp).toBeCloseTo(Math.pow(4, 0.4), 2);

    s.recordImprovement(1000);
    s.step();
    // 1000^0.4 ≈ 15.85
    expect(s.temp).toBeCloseTo(Math.pow(1000, 0.4), 1);
  });

  test("reheat floor is 1.0 when energy is very small", () => {
    const s = new AnnealingSchedule({
      initialTemp: 50,
      coolingRate: 1.0,
      reheatWindow: 1,
      maxIterations: 1000,
    });

    s.recordImprovement(0.01);
    s.step();
    // 0.01^0.4 ≈ 0.04, but floor is 1.0
    expect(s.temp).toBe(1.0);
  });
});
