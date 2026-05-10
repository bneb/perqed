/**
 * AlgebraicPartition — RED tests (TDD Phase 20, Parts A+C)
 *
 * Written BEFORE the implementation. Tests the schema, builder,
 * and the full buildAndVerifyPartition pipeline.
 */

import { expect, test, describe } from "bun:test";
import { AlgebraicPartitionConfigSchema } from "../src/proof_dag/algebraic_partition_config";
import { AlgebraicBuilder } from "../src/search/algebraic_builder";
import { DAGNodeKindSchema } from "../src/proof_dag/schemas";

// ── Schema tests ──────────────────────────────────────────────────────────────

describe("AlgebraicPartitionConfig schema", () => {
  test("accepts a valid config", () => {
    const result = AlgebraicPartitionConfigSchema.safeParse({
      domain_size: 10,
      num_partitions: 3,
      description: "Test partition rule",
      partition_rule_js: "return i % 3;",
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing partition_rule_js", () => {
    const result = AlgebraicPartitionConfigSchema.safeParse({
      domain_size: 10,
      num_partitions: 3,
      description: "Missing rule",
    });
    expect(result.success).toBe(false);
  });

  test("rejects domain_size < 1", () => {
    const result = AlgebraicPartitionConfigSchema.safeParse({
      domain_size: 0,
      num_partitions: 2,
      description: "Bad domain",
      partition_rule_js: "return 0;",
    });
    expect(result.success).toBe(false);
  });

  test("rejects num_partitions < 1", () => {
    const result = AlgebraicPartitionConfigSchema.safeParse({
      domain_size: 10,
      num_partitions: 0,
      description: "Bad partitions",
      partition_rule_js: "return 0;",
    });
    expect(result.success).toBe(false);
  });
});

// ── DAG schema extension ──────────────────────────────────────────────────────

describe("DAGNodeKindSchema includes algebraic_partition_construction", () => {
  test("algebraic_partition_construction is a valid node kind", () => {
    const result = DAGNodeKindSchema.safeParse("algebraic_partition_construction");
    expect(result.success).toBe(true);
  });
});

// ── AlgebraicBuilder.buildPartition ──────────────────────────────────────────

describe("AlgebraicBuilder.buildPartition", () => {
  test("round-robin rule assigns correct buckets", () => {
    const partition = AlgebraicBuilder.buildPartition({
      domain_size: 6,
      num_partitions: 3,
      description: "Round-robin mod 3",
      partition_rule_js: "return (i - 1) % 3;",
    });
    // i=1 → bucket 0, i=2 → bucket 1, i=3 → bucket 2, i=4 → bucket 0, ...
    expect(partition[1]).toBe(0);
    expect(partition[2]).toBe(1);
    expect(partition[3]).toBe(2);
    expect(partition[4]).toBe(0);
    expect(partition[5]).toBe(1);
    expect(partition[6]).toBe(2);
  });

  test("returns 1-indexed Int8Array of length domain_size + 1", () => {
    const domainSize = 10;
    const partition = AlgebraicBuilder.buildPartition({
      domain_size: domainSize,
      num_partitions: 2,
      description: "Even/odd split",
      partition_rule_js: "return i % 2;",
    });
    expect(partition.length).toBe(domainSize + 1);
    expect(partition[0]).toBe(-1); // index 0 unused
  });

  test("undefined return from rule is stored as -1 (unassigned)", () => {
    const partition = AlgebraicBuilder.buildPartition({
      domain_size: 5,
      num_partitions: 2,
      description: "Partial assignment",
      partition_rule_js: "if (i <= 3) return 0; return -1;",
    });
    expect(partition[4]).toBe(-1);
    expect(partition[5]).toBe(-1);
    expect(partition[1]).toBe(0);
  });

  test("throws SandboxError on invalid JS syntax", () => {
    expect(() =>
      AlgebraicBuilder.buildPartition({
        domain_size: 5,
        num_partitions: 2,
        description: "Bad JS",
        partition_rule_js: "return i +++ ;;;",
      })
    ).toThrow();
  });

  test("throws on out-of-range bucket return (not -1 and not in [0, num_partitions))", () => {
    expect(() =>
      AlgebraicBuilder.buildPartition({
        domain_size: 3,
        num_partitions: 2,
        description: "Returns invalid bucket 5",
        partition_rule_js: "return 5;",
      })
    ).toThrow();
  });
});

// ── AlgebraicBuilder.buildAndVerifyPartition ──────────────────────────────────

describe("AlgebraicBuilder.buildAndVerifyPartition", () => {
  test("known sum-free 2-coloring of {1..4} gives E=0", async () => {
    // Classic S(2) witness: {1,4} and {2,3}
    const result = await AlgebraicBuilder.buildAndVerifyPartition(
      {
        domain_size: 4,
        num_partitions: 2,
        description: "Classic S(2) partition",
        partition_rule_js: "if (i === 1 || i === 4) return 0; return 1;",
      },
      null,
      null
    );
    expect(result.energy).toBe(0);
    expect(result.status).toBe("witness");
  });

  test("monochromatic {1,2,3} in one bucket gives E > 0", async () => {
    const result = await AlgebraicBuilder.buildAndVerifyPartition(
      {
        domain_size: 3,
        num_partitions: 1,
        description: "All in one bad class",
        partition_rule_js: "return 0;",
      },
      null,
      null
    );
    expect(result.energy).toBeGreaterThan(0);
    expect(result.status).toBe("violations");
  });

  test("result contains description, compiledInMs, and partition fields", async () => {
    const result = await AlgebraicBuilder.buildAndVerifyPartition(
      {
        domain_size: 4,
        num_partitions: 2,
        description: "Test shape",
        partition_rule_js: "return i % 2;",
      },
      null,
      null
    );
    expect(result.description).toBe("Test shape");
    expect(result.compiledInMs).toBeGreaterThanOrEqual(0);
    expect(result.partition).toBeInstanceOf(Int8Array);
  });
});
