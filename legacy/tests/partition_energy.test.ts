/**
 * partition_energy.test.ts — RED-to-GREEN tests for the false-E=0 witness bug
 *
 * Bug: partition_rule_js with no `return` statement returns `undefined` for every
 * element, so all 537 integers land in bucket -1 (unassigned). computeSumFreeEnergy
 * returns 0 (no pairs to check), and buildAndVerifyPartition declares a false witness.
 *
 * Fix: buildAndVerifyPartition must include unassigned count in the total energy.
 * A partition with ANY unassigned elements is NOT a valid witness.
 */
import { describe, expect, it } from "bun:test";
import { AlgebraicBuilder } from "../src/search/algebraic_builder";
import type { AlgebraicPartitionConfig } from "../src/proof_dag/algebraic_partition_config";

function makeConfig(partition_rule_js: string, domain_size = 10, num_partitions = 2): AlgebraicPartitionConfig {
  return { domain_size, num_partitions, description: "test", partition_rule_js };
}

// ── 1. buildPartition: missing-return rule assigns 0 elements ──

describe("AlgebraicBuilder.buildPartition — missing-return detection", () => {
  it("assigns 0 elements when rule has no return (returns undefined)", () => {
    // This is the bug: `(i - 1) % 6` without `return` yields undefined
    const config = makeConfig("(i - 1) % 2", 10, 2);
    const partition = AlgebraicBuilder.buildPartition(config);
    const assignedCount = partition.slice(1).filter((b) => b >= 0).length;
    // Without fix: assignedCount = 0 (all undefined → -1)
    // The rule has no return, so all are unassigned
    expect(assignedCount).toBe(0);
  });

  it("assigns all elements when rule has explicit return", () => {
    const config = makeConfig("return (i - 1) % 2;", 10, 2);
    const partition = AlgebraicBuilder.buildPartition(config);
    const assignedCount = partition.slice(1).filter((b) => b >= 0).length;
    expect(assignedCount).toBe(10);
  });
});

// ── 2. buildAndVerifyPartition: unassigned elements must produce E > 0 ──

describe("AlgebraicBuilder.buildAndVerifyPartition — unassigned penalty", () => {
  it("returns E > 0 when all elements are unassigned (no-return rule)", async () => {
    const config = makeConfig("(i - 1) % 2", 10, 2); // no return → all unassigned
    const result = await AlgebraicBuilder.buildAndVerifyPartition(config, null, null);
    // MUST NOT be a witness — unassigned elements are not a valid partition
    expect(result.energy).toBeGreaterThan(0);
    expect(result.status).toBe("violations");
  });

  it("returns E = 0 only when ALL elements are assigned and no violations", async () => {
    // domain=3: class0={1,3}, class1={2}
    // class0: 1+1=2 (in class1, not class0 ✓), 1+3=4>3 ✓, 3+3=6>3 ✓
    // class1: 2+2=4>3 ✓
    // Valid sum-free 2-partition of {1,2,3} with all elements assigned.
    const config = makeConfig("return (i - 1) % 2;", 3, 2);
    const result = await AlgebraicBuilder.buildAndVerifyPartition(config, null, null);
    expect(result.status).toBe("witness");
    expect(result.energy).toBe(0);
  });

  it("returns E > 0 when only some elements are assigned", async () => {
    // Rule that only assigns even numbers: odd numbers are unassigned
    const config = makeConfig("if (i % 2 === 0) return 0; return -1;", 6, 2);
    const result = await AlgebraicBuilder.buildAndVerifyPartition(config, null, null);
    expect(result.energy).toBeGreaterThan(0);
    expect(result.status).toBe("violations");
  });

  it("the exact bug rule from production reports E > 0", async () => {
    // The exact rule that caused the false witness in production
    const bugRule = "(3 * ((i - 1) % 2) + 2 * (Math.floor((i - 1) / 2) % 3)) % 6";
    const config = makeConfig(bugRule, 537, 6);
    const result = await AlgebraicBuilder.buildAndVerifyPartition(config, null, null);
    // Without fix: energy = 0, status = "witness" (FALSE POSITIVE)
    // With fix: energy > 0, status = "violations"
    expect(result.energy).toBeGreaterThan(0);
    expect(result.status).toBe("violations");
  });
});
