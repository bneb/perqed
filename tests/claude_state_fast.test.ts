/**
 * Fuzz test for ClaudeStateFast — incremental energy evaluator.
 *
 * The contract: after every single mutation, the incrementally-maintained
 * energy must EXACTLY equal a full recalculation from scratch.
 */

import { describe, test, expect } from "bun:test";
import { ClaudeStateFast } from "../src/math/claude_state_fast";
import { ClaudeState } from "../src/math/claude_state";

describe("ClaudeStateFast", () => {
  test("constructor produces same energy as ClaudeState for random payloads", () => {
    for (let trial = 0; trial < 100; trial++) {
      const m = 4;
      const vCount = m * m * m;
      const payload: number[] = new Array(vCount);
      payload[0] = 0;
      for (let i = 1; i < vCount; i++) {
        payload[i] = Math.floor(Math.random() * 6);
      }

      const slow = new ClaudeState(payload, m);
      const fast = ClaudeStateFast.create(payload, m);

      expect(fast.getEnergy()).toBe(slow.getEnergy());
    }
  });

  test("constructor produces same energy as ClaudeState for m=6", () => {
    for (let trial = 0; trial < 20; trial++) {
      const m = 6;
      const vCount = m * m * m;
      const payload: number[] = new Array(vCount);
      payload[0] = 0;
      for (let i = 1; i < vCount; i++) {
        payload[i] = Math.floor(Math.random() * 6);
      }

      const slow = new ClaudeState(payload, m);
      const fast = ClaudeStateFast.create(payload, m);

      expect(fast.getEnergy()).toBe(slow.getEnergy());
    }
  });

  test("fuzz: 100K mutations on m=4, incremental === full at every step", () => {
    let state = ClaudeStateFast.createRandom(4);

    for (let i = 0; i < 100_000; i++) {
      const mutated = state.mutate() as ClaudeStateFast | null;
      if (!mutated) continue;

      const incremental = mutated.getEnergy();
      const full = mutated.fullEnergy();

      if (incremental !== full) {
        throw new Error(
          `Fuzz failure at mutation ${i}: incremental=${incremental}, full=${full}`
        );
      }

      state = mutated;
    }
  });

  test("fuzz: 100K mutations on m=6, incremental === full at every step", () => {
    let state = ClaudeStateFast.createRandom(6);

    for (let i = 0; i < 100_000; i++) {
      const mutated = state.mutate() as ClaudeStateFast | null;
      if (!mutated) continue;

      const incremental = mutated.getEnergy();
      const full = mutated.fullEnergy();

      if (incremental !== full) {
        throw new Error(
          `Fuzz failure at mutation ${i}: incremental=${incremental}, full=${full}`
        );
      }

      state = mutated;
    }
  });

  test("fuzz: 100K in-place tryMutation on m=6, energy always matches full", () => {
    const state = ClaudeStateFast.createRandom(6);

    for (let i = 0; i < 100_000; i++) {
      const vertex = Math.floor(Math.random() * (state.vCount - 1)) + 1;
      let newPerm = Math.floor(Math.random() * 5);
      if (newPerm >= state.payload[vertex]!) newPerm++;

      state.tryMutation(vertex, newPerm);

      const incremental = state.getEnergy();
      const full = state.fullEnergy();

      if (incremental !== full) {
        state.acceptMutation(); // accept so we can inspect
        throw new Error(
          `In-place fuzz failure at mutation ${i}: incremental=${incremental}, full=${full}`
        );
      }

      // Randomly accept or reject (50/50)
      if (Math.random() < 0.5) {
        state.acceptMutation();
      } else {
        state.rejectMutation();

        // After rejection, energy should still match full recalc
        const afterReject = state.getEnergy();
        const fullAfterReject = state.fullEnergy();
        if (afterReject !== fullAfterReject) {
          throw new Error(
            `Reject fuzz failure at mutation ${i}: after reject incremental=${afterReject}, full=${fullAfterReject}`
          );
        }
      }
    }
  });

  test("cross-validation: mutate() chain matches ClaudeState energy", () => {
    const m = 4;
    const vCount = m * m * m;
    const payload: number[] = new Array(vCount);
    payload[0] = 0;
    for (let i = 1; i < vCount; i++) {
      payload[i] = Math.floor(Math.random() * 6);
    }

    let fast = ClaudeStateFast.create(payload, m);

    for (let i = 0; i < 1000; i++) {
      const mutated = fast.mutate() as ClaudeStateFast | null;
      if (!mutated) continue;
      fast = mutated;

      if (i % 100 === 0) {
        const slow = new ClaudeState(fast.getPayload(), m);
        expect(fast.getEnergy()).toBe(slow.getEnergy());
      }
    }
  });

  test("known m=4 solution has energy 0", () => {
    const solutionPayload = [
      3,1,5,4,3,0,0,5,0,5,0,4,2,0,4,5,
      4,5,1,0,0,4,5,0,4,0,5,0,2,3,5,2,
      5,4,2,5,4,1,2,0,4,4,0,1,0,5,3,0,
      5,5,4,5,2,2,0,3,1,0,4,1,5,0,1,4,
    ];
    const state = ClaudeStateFast.create(solutionPayload, 4);
    expect(state.getEnergy()).toBe(0);
    expect(state.fullEnergy()).toBe(0);
  });

  test("benchmark: in-place tryMutation vs ClaudeState mutation throughput", () => {
    const m = 6;
    const iterations = 50_000;

    // Benchmark fast (in-place)
    const fastState = ClaudeStateFast.createRandom(m);
    const fastStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const vertex = Math.floor(Math.random() * (fastState.vCount - 1)) + 1;
      let newPerm = Math.floor(Math.random() * 5);
      if (newPerm >= fastState.payload[vertex]!) newPerm++;

      fastState.tryMutation(vertex, newPerm);
      if (Math.random() < 0.5) {
        fastState.acceptMutation();
      } else {
        fastState.rejectMutation();
      }
    }
    const fastMs = performance.now() - fastStart;

    // Benchmark slow (immutable clone)
    let slowState: ClaudeState = new ClaudeState(
      ClaudeStateFast.createRandom(m).getPayload(), m
    );
    const slowStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const next = slowState.mutate() as ClaudeState | null;
      if (next && next.getEnergy() <= slowState.getEnergy()) {
        slowState = next;
      }
    }
    const slowMs = performance.now() - slowStart;

    const speedup = slowMs / fastMs;
    console.log(`  Fast (in-place): ${fastMs.toFixed(1)}ms | Slow (clone): ${slowMs.toFixed(1)}ms | Speedup: ${speedup.toFixed(1)}x`);

    // We expect meaningful speedup with in-place mutation
    expect(speedup).toBeGreaterThan(1.0);
  });
});
