/**
 * SumFreeEnergy — RED tests (TDD Phase 20, Part B)
 *
 * Written BEFORE the implementation to define the contract.
 * Energy = number of (x, y, z) triples within the same partition where x + y = z.
 * Energy = 0 iff every color class is sum-free.
 */

import { expect, test, describe } from "bun:test";
import { computeSumFreeEnergy } from "../src/math/optim/SumFreeEnergy";

/** Build a 1-indexed Int8Array partition from a Map<color, numbers[]> */
function buildPartition(domainSize: number, colorMap: Map<number, number[]>): Int8Array {
  const p = new Int8Array(domainSize + 1).fill(-1);
  for (const [color, nums] of colorMap) {
    for (const n of nums) p[n] = color;
  }
  return p;
}

describe("computeSumFreeEnergy — basic contracts", () => {
  test("empty partition (all -1) has energy 0", () => {
    const p = new Int8Array(10 + 1).fill(-1);
    expect(computeSumFreeEnergy(p, 10, 3)).toBe(0);
  });

  test("single-element classes are always sum-free (E=0)", () => {
    // {1}, {2}, {3} — no class has enough elements for x + y = z
    const p = buildPartition(3, new Map([[0, [1]], [1, [2]], [2, [3]]]));
    expect(computeSumFreeEnergy(p, 3, 3)).toBe(0);
  });

  test("classic sum-free violation: {1,2,3} in one class, 1+2=3 → E >= 1", () => {
    const p = buildPartition(3, new Map([[0, [1, 2, 3]]]));
    expect(computeSumFreeEnergy(p, 3, 1)).toBeGreaterThan(0);
  });

  test("known sum-free set {2,3,7} has no violation", () => {
    // 2+3=5 (not in set), 2+7=9 (not in set), 3+7=10 (not in set)
    const p = buildPartition(10, new Map([[0, [2, 3, 7]]]));
    expect(computeSumFreeEnergy(p, 10, 1)).toBe(0);
  });

  test("{1,5,11} — sum-free set, E=0", () => {
    const p = buildPartition(15, new Map([[0, [1, 5, 11]]]));
    expect(computeSumFreeEnergy(p, 15, 1)).toBe(0);
  });

  test("{1,2,3,5} contains 1+2=3 violation → E >= 1", () => {
    const p = buildPartition(5, new Map([[0, [1, 2, 3, 5]]]));
    const energy = computeSumFreeEnergy(p, 5, 1);
    expect(energy).toBeGreaterThan(0);
  });

  test("two classes — each sum-free independently → E=0", () => {
    // Class 0: {1, 4}  → 1+4=5, not in class → OK
    // Class 1: {2, 3}  → 2+3=5, not in class → OK
    const p = buildPartition(5, new Map([[0, [1, 4]], [1, [2, 3]]]));
    expect(computeSumFreeEnergy(p, 5, 2)).toBe(0);
  });

  test("violations only counted within same class, not across classes", () => {
    // Choose classes with no within-class x+y=z triples:
    // Class 0: {1, 2}  → 1+1=2 IS in {1,2} → violation!
    // Use instead: Class 0: {3}, Class 1: {1, 2}  → 1+1=2 is a violation in class 1.
    // Use: Class 0: {1, 5}, Class 1: {3, 7}
    // Within class 0: 1+1=2 (not in set), 1+5=6 (not in set), 5+5=10 (not in set) → OK
    // Within class 1: 3+3=6 (not in set), 3+7=10 (not in set), 7+7=14 (not in set) → OK
    // Cross-class: 1+3=4 (not in either set), etc. → not counted anyway
    const p = buildPartition(10, new Map([[0, [1, 5]], [1, [3, 7]]]));
    expect(computeSumFreeEnergy(p, 10, 2)).toBe(0);
  });

  test("energy is deterministic across multiple calls", () => {
    const p = buildPartition(6, new Map([[0, [1, 2, 3, 4, 5, 6]]]));
    const e1 = computeSumFreeEnergy(p, 6, 1);
    const e2 = computeSumFreeEnergy(p, 6, 1);
    expect(e1).toBe(e2);
  });

  test("Schur S(1)=1: {1} in one class is trivially sum-free", () => {
    const p = buildPartition(1, new Map([[0, [1]]]));
    expect(computeSumFreeEnergy(p, 1, 1)).toBe(0);
  });

  test("Schur S(2)=4: 2-coloring of {1,2,3,4}. Classic: {1,4},{2,3} E=0", () => {
    // Known valid S(2) partition
    const p = buildPartition(4, new Map([[0, [1, 4]], [1, [2, 3]]]));
    expect(computeSumFreeEnergy(p, 4, 2)).toBe(0);
  });

  test("Schur S(2)=4: {1,2,3,4} in single class has multiple violations", () => {
    const p = buildPartition(4, new Map([[0, [1, 2, 3, 4]]]));
    const energy = computeSumFreeEnergy(p, 4, 1);
    // At least: 1+2=3, 1+3=4 → 2 violations
    expect(energy).toBeGreaterThanOrEqual(2);
  });
});

describe("computeSumFreeEnergy — boundary conditions", () => {
  test("unassigned elements (-1) are skipped and do not cause violations", () => {
    // Only 1 and 3 are in class 0; element 2 is unassigned
    // 1+3=4 (not in set), no violation
    const p = buildPartition(4, new Map([[0, [1, 3]]]));
    expect(computeSumFreeEnergy(p, 4, 1)).toBe(0);
  });

  test("domainSize 0 returns 0 immediately", () => {
    const p = new Int8Array(1).fill(-1);
    expect(computeSumFreeEnergy(p, 0, 1)).toBe(0);
  });
});
