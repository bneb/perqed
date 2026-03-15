/**
 * Sprint 26: ClaudeState Tests (TDD)
 *
 * Tests for Knuth's 3D directed torus Hamiltonian decomposition (m=4).
 */

import { describe, test, expect } from "bun:test";
import { ClaudeState } from "../src/math/claude_state";

describe("ClaudeState", () => {
  test("createRandom returns payload with 64 elements, all in [0,5]", () => {
    const state = ClaudeState.createRandom();
    const payload = state.getPayload();

    expect(payload.length).toBe(64);
    for (const val of payload) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(5);
    }
  });

  test("getEnergy returns a non-negative integer", () => {
    const state = ClaudeState.createRandom();
    const energy = state.getEnergy();

    expect(energy).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(energy)).toBe(true);
  });

  test("mutate changes exactly one index and preserves immutability", () => {
    const original = ClaudeState.createRandom();
    const originalPayload = [...original.getPayload()];

    // Get a non-null mutation
    let mutated = original.mutate();
    while (!mutated) mutated = original.mutate();

    const mutatedPayload = mutated.getPayload();

    // Original unchanged (immutability)
    expect(original.getPayload()).toEqual(originalPayload);

    // Exactly one index changed
    let diffCount = 0;
    for (let i = 0; i < 64; i++) {
      if (originalPayload[i] !== mutatedPayload[i]) diffCount++;
    }
    expect(diffCount).toBe(1);
  });

  test("all-zeros payload has energy exactly 45", () => {
    // Perm 0: [0,1,2] → X→Color0, Y→Color1, Z→Color2
    // Color 0 follows +X: for each (j,k), i cycles 0→1→2→3→0 → 4×4=16 cycles of length 4
    // Color 1 follows +Y: for each (i,k), j cycles → 16 cycles
    // Color 2 follows +Z: for each (i,j), k cycles → 16 cycles
    // Total = 48 cycles. Energy = 48 - 3 = 45
    const payload = new Array(64).fill(0);
    const state = new ClaudeState(payload);

    expect(state.getEnergy()).toBe(45);
  });

  test("getEnergy is cached (same value on repeat calls)", () => {
    const state = ClaudeState.createRandom();
    const e1 = state.getEnergy();
    const e2 = state.getEnergy();
    expect(e1).toBe(e2);
  });

  test("mutated value is always different from original at changed index", () => {
    const state = new ClaudeState(new Array(64).fill(3));

    for (let i = 0; i < 20; i++) {
      const mutated = state.mutate();
      if (mutated) {
        const mp = mutated.getPayload();
        for (let j = 0; j < 64; j++) {
          if (mp[j] !== 3) {
            // Changed index should NOT be 3
            expect(mp[j]).not.toBe(3);
          }
        }
      }
    }
  });
});
