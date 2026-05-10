/**
 * tests/vdw_orchestrator.test.ts — TDD for orchestrator decision logic.
 *
 * These tests capture every bug seen in the running solver:
 *
 *  Bug 1: Z3 fires when bestE=0 (witness already found → UNSAT → 40% restart storm)
 *  Bug 2: Stagnation restarts fire when globalBest.energy=0 (bounces islands off witness)
 *  Bug 3: Island restarts itself when it IS the global best (destroys best partition)
 *  Bug 4: Z3 fires repeatedly on unchanged partition (wasted 45s per sync)
 */
import { describe, test, expect } from "bun:test";
import {
  shouldRunZ3,
  shouldRestartIsland,
  computePartitionHash,
} from "../src/search/vdw_orchestrator";

// ── shouldRunZ3 ───────────────────────────────────────────────────────────────

describe("shouldRunZ3", () => {
  // Bug 1: was `bestE <= threshold` with no lower-bound check
  test("returns false when bestE=0 (witness already found — do NOT repair)", () => {
    expect(shouldRunZ3(0, 10)).toBe(false);
  });

  test("returns false when bestE > threshold", () => {
    expect(shouldRunZ3(11, 10)).toBe(false);
    expect(shouldRunZ3(100, 10)).toBe(false);
  });

  test("returns true when 0 < bestE <= threshold", () => {
    expect(shouldRunZ3(1, 10)).toBe(true);
    expect(shouldRunZ3(5, 10)).toBe(true);
    expect(shouldRunZ3(10, 10)).toBe(true);
  });

  test("returns false when threshold <= 0 (degenerate config)", () => {
    expect(shouldRunZ3(0, 0)).toBe(false);
    expect(shouldRunZ3(1, 0)).toBe(false);
  });
});

// ── shouldRestartIsland ───────────────────────────────────────────────────────

describe("shouldRestartIsland", () => {
  // Bug 2: restarts fired when globalBest.energy=0 (witness in hand)
  test("returns false when global best has E=0 (witness found, don't disturb)", () => {
    expect(shouldRestartIsland(25, 80, 0, 20)).toBe(false);
    expect(shouldRestartIsland(100, 50, 0, 20)).toBe(false);
  });

  // Bug 3: island accidentally restarts itself (isIslandTheBest=true)
  test("returns false when this island IS the global best", () => {
    expect(shouldRestartIsland(25, 43, 43, 20)).toBe(false); // same energy = might be best
  });

  test("returns false when stagnantSyncs < stagnationLimit", () => {
    expect(shouldRestartIsland(15, 80, 43, 20)).toBe(false);
    expect(shouldRestartIsland(0, 80, 43, 20)).toBe(false);
    expect(shouldRestartIsland(19, 80, 43, 20)).toBe(false);
  });

  test("returns true when stagnantSyncs >= limit AND not global best AND globalBest > 0", () => {
    expect(shouldRestartIsland(20, 80, 43, 20)).toBe(true);
    expect(shouldRestartIsland(25, 80, 43, 20)).toBe(true);
    expect(shouldRestartIsland(100, 62, 41, 20)).toBe(true);
  });

  test("returns false when island energy equals global best (protect co-leaders)", () => {
    // If multiple islands are tied for best, protect them all
    expect(shouldRestartIsland(25, 43, 43, 20)).toBe(false);
  });
});

// ── computePartitionHash ──────────────────────────────────────────────────────

describe("computePartitionHash", () => {
  test("returns same hash for same partition", () => {
    const p = new Int8Array([0, 1, 2, 0, 1, 2, 0, 1]);
    expect(computePartitionHash(p)).toBe(computePartitionHash(new Int8Array([0, 1, 2, 0, 1, 2, 0, 1])));
  });

  test("returns different hash when any element changes", () => {
    const p1 = new Int8Array([0, 1, 2, 0, 1]);
    const p2 = new Int8Array([0, 1, 2, 0, 2]); // last element differs
    expect(computePartitionHash(p1)).not.toBe(computePartitionHash(p2));
  });

  test("returns different hash for position-sensitive changes", () => {
    // [1,0] vs [0,1] — same elements, different positions — should differ
    const p1 = new Int8Array([1, 0]);
    const p2 = new Int8Array([0, 1]);
    expect(computePartitionHash(p1)).not.toBe(computePartitionHash(p2));
  });

  test("returns -1 for empty partition (sentinel for 'not yet computed')", () => {
    expect(computePartitionHash(new Int8Array(0))).toBe(-1);
  });
});
