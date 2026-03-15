/**
 * Sprint 23: ErdosState Tests (TDD)
 *
 * Tests the IState adapter for Erdős-Gyárfás graph optimization.
 */

import { describe, test, expect } from "bun:test";
import { ErdosState } from "../src/math/erdos_state";

describe("ErdosState", () => {
  test("createCubic(6) generates a valid 3-regular graph", () => {
    const state = ErdosState.createCubic(6);
    const adj = state.getPayload();

    expect(adj.length).toBe(6);
    for (let i = 0; i < 6; i++) {
      expect(adj[i]!.length).toBe(3);
    }
  });

  test("createCubic(18) has all degrees exactly 3", () => {
    const state = ErdosState.createCubic(18);
    const adj = state.getPayload();

    expect(adj.length).toBe(18);
    for (let i = 0; i < 18; i++) {
      expect(adj[i]!.length).toBe(3);
    }
  });

  test("getEnergy returns a non-negative number", () => {
    const state = ErdosState.createCubic(8);
    expect(state.getEnergy()).toBeGreaterThanOrEqual(0);
  });

  test("getEnergy is cached (returns same value on repeat calls)", () => {
    const state = ErdosState.createCubic(8);
    const e1 = state.getEnergy();
    const e2 = state.getEnergy();
    expect(e1).toBe(e2);
  });

  test("mutate returns a new ErdosState without modifying the original", () => {
    const original = ErdosState.createCubic(8);
    const originalPayload = JSON.stringify(original.getPayload());

    // Run enough mutations to get a non-null result
    let mutated: ReturnType<typeof original.mutate> = null;
    for (let i = 0; i < 100; i++) {
      mutated = original.mutate();
      if (mutated) break;
    }

    // Original must be unchanged (immutability guarantee)
    expect(JSON.stringify(original.getPayload())).toBe(originalPayload);

    // Mutated state should be a different object
    if (mutated) {
      expect(mutated).not.toBe(original);
      expect(mutated.getPayload()).not.toBe(original.getPayload());
    }
  });

  test("mutated state has valid min degree >= 3", () => {
    const state = ErdosState.createCubic(10);

    for (let i = 0; i < 50; i++) {
      const mutated = state.mutate();
      if (mutated) {
        const adj = mutated.getPayload();
        for (let v = 0; v < adj.length; v++) {
          expect(adj[v]!.length).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });
});
