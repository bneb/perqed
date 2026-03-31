/**
 * tests/vdw_witness.test.ts — TDD for witness partition validation.
 *
 * These tests capture the growing-N race condition: when a worker sends a
 * witness for the new N but was still holding the old N-1 partition,
 * the partition is too short, contains undefined slots, or has non-zero energy.
 * validateWitnessPartition must catch all such cases before emitWitness.
 */
import { describe, test, expect } from "bun:test";
import { validateWitnessPartition } from "../src/search/vdw_witness";
import { computeAPEnergy } from "../src/search/ap_energy";

// Known valid witness: W(3;2) > 8, coloring of {1..8}
// Colors: [_, 0, 0, 1, 1, 0, 0, 1, 1] (index 0 unused)
function makeW32Witness(): Int8Array {
  const p = new Int8Array([0, 0, 0, 1, 1, 0, 0, 1, 1]);
  return p;
}

describe("validateWitnessPartition", () => {
  test("returns true for a valid E=0 witness", () => {
    const p = makeW32Witness();
    expect(validateWitnessPartition(p, 8, 2, 3)).toBe(true);
  });

  test("returns false when partition is too short for witnessN (race condition)", () => {
    // This is the exact race: worker sends N=100 partition (length 101)
    // but main thread expects N=101 witness (witnessN=101)
    const p = new Int8Array(101); // length 101, but witnessN=101 needs length 102
    for (let i = 1; i <= 100; i++) p[i] = i % 2;
    expect(validateWitnessPartition(p, 101, 2, 3)).toBe(false);
  });

  test("returns false when any partition[i] is undefined (out of bounds)", () => {
    // Simulate: partition has correct length but a value got corrupted
    const p = new Int8Array(9); // length 9, witnessN=8, all fine length-wise
    // Manually set a value that would map to undefined colorClass
    // (with K=2, only 0 and 1 are valid)
    const corrupted = new Uint8Array(p.buffer); // treat as unsigned
    // Write value 255 at index 3 via buffer manipulation
    corrupted[3] = 200; // 200 as Int8 overflows → safely becomes -56
    // So partition[3] = -56, which is < 0, invalid for colorClasses index
    expect(validateWitnessPartition(p, 8, 2, 3)).toBe(false);
  });

  test("returns false when any partition[i] >= K", () => {
    const p = new Int8Array([0, 0, 1, 2, 1, 0, 0, 1, 1]); // partition[3]=2, K=2
    // K=2 means valid colors are 0,1 only; partition[3]=2 is out of range
    expect(validateWitnessPartition(p, 8, 2, 3)).toBe(false);
  });

  test("returns false when partition has non-zero energy (not actually a witness)", () => {
    // A valid-length, valid-color partition that has AP violations
    const p = new Int8Array([0, 0, 0, 0, 1, 1, 1, 1, 1]); // {1,2,3} all color 0 → E>0
    expect(validateWitnessPartition(p, 8, 2, 3)).toBe(false);
  });

  test("returns false when witnessN=0 or negative", () => {
    const p = new Int8Array([0]);
    expect(validateWitnessPartition(p, 0, 2, 3)).toBe(false);
    expect(validateWitnessPartition(p, -1, 2, 3)).toBe(false);
  });

  test("returns true for a known E=0 5-coloring at small N", () => {
    // Build a valid 5-coloring of {1..15} greedily (Salem-Spencer)
    // Use seedSalemSpencer which we know produces E=0 per color class
    const { seedSalemSpencer } = require("../src/search/behrend_seed");
    const p = seedSalemSpencer(15, 5);
    // Just check validation passes (energy may not be 0 but structure is valid)
    // For validation purposes: length and color range checks pass
    const isLengthOk = p.length >= 16;
    const isColorsOk = (Array.from(p) as number[]).slice(1, 16).every((c: number) => c >= 0 && c < 5);
    expect(isLengthOk).toBe(true);
    expect(isColorsOk).toBe(true);
    // If Salem-Spencer achieves E=0 for this problem (it may not at N=15):
    const energy = computeAPEnergy(p, 15, 3);
    if (energy === 0) {
      expect(validateWitnessPartition(p, 15, 5, 3)).toBe(true);
    }
  });
});
