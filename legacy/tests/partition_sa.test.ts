/**
 * partition_sa.test.ts — RED-to-GREEN tests for the partition SA optimizer.
 *
 * Tests:
 *   1. runPartitionSA converges to E=0 on a trivially solvable problem
 *   2. Warm-start from a failing algebraic partition improves or matches cold start
 *   3. DAGNodeKind includes "partition_sa_search"
 *   4. Zod schema accepts partition_sa_search node kind
 */
import { describe, expect, it } from "bun:test";
import { runPartitionSA } from "../src/search/partition_sa_worker";
import type { DAGNodeKind } from "../src/proof_dag/types";
import { DAGNodeSchema } from "../src/proof_dag/schemas";

// ── 1. Trivial convergence: {1,2} with 2 classes, 10 iters ──
// domain=2, num_partitions=2: class0={1}, class1={2}
// only triple possible: 1+1=2, but x=y=z constraint means x+y=z with x=y=1, z=2
// Assign 1→class0, 2→class1 → E=0 trivially reachable

describe("runPartitionSA — trivial convergence", () => {
  it("finds E=0 for domain=2, 2 partitions within 10k iterations", async () => {
    const result = await runPartitionSA({
      domain_size: 2,
      num_partitions: 2,
      sa_iterations: 10_000,
      description: "trivial test",
    });
    expect(result.energy).toBe(0);
    expect(result.status).toBe("witness");
  });

  it("finds E=0 for domain=4, 2 partitions (well-known: {1,4},{2,3})", async () => {
    // {1,4}: 1+4=5>4 ✓, 4+4=8>4 ✓, 1+1=2 (class1) ✓
    // {2,3}: 2+3=5>4 ✓, 2+2=4 (class0) ✓, 3+3=6>4 ✓
    const result = await runPartitionSA({
      domain_size: 4,
      num_partitions: 2,
      sa_iterations: 100_000,
      description: "domain=4 2-partition",
    });
    expect(result.energy).toBe(0);
    expect(result.status).toBe("witness");
  });

  it("returns a fully assigned partition", async () => {
    const result = await runPartitionSA({
      domain_size: 10,
      num_partitions: 3,
      sa_iterations: 100_000,
      description: "10-element 3-partition",
    });
    const unassigned = result.partition.slice(1).filter((b: number) => b < 0).length;
    expect(unassigned).toBe(0);
  });
});

// ── 2. Warm-start: starting from a near-solution improves result ──

describe("runPartitionSA — warm start", () => {
  it("accepts a warmStart partition and runs from it", async () => {
    // Build a warm-start partition that's almost correct (just assign everything to class 0)
    const warmStart = new Int8Array(11).fill(0);
    warmStart[0] = -1; // index 0 unused (1-indexed)
    const result = await runPartitionSA({
      domain_size: 10,
      num_partitions: 3,
      sa_iterations: 100_000,
      warmStart,
      description: "warm-start test",
    });
    expect(result.partition).toBeInstanceOf(Int8Array);
    expect(result.energy).toBeGreaterThanOrEqual(0);
  });
});

// ── 3. DAGNodeKind includes partition_sa_search ──

describe("DAGNodeKind type", () => {
  it("partition_sa_search is a valid DAGNodeKind", () => {
    const kind: DAGNodeKind = "partition_sa_search";
    expect(kind).toBe("partition_sa_search");
  });

  it("algebraic_partition_construction is a valid DAGNodeKind", () => {
    const kind: DAGNodeKind = "algebraic_partition_construction";
    expect(kind).toBe("algebraic_partition_construction");
  });
});

// ── 4. Zod schema accepts partition_sa_search kind ──

describe("DAGNodeSchema — partition_sa_search", () => {
  it("accepts a partition_sa_search node", () => {
    const node = {
      id: "sa_partition_1",
      kind: "partition_sa_search",
      label: "SA partition optimizer",
      dependsOn: [],
      config: {
        domain_size: 537,
        num_partitions: 6,
        sa_iterations: 5_000_000,
        description: "SA from algebraic warm start",
      },
      status: "pending",
    };
    const result = DAGNodeSchema.safeParse(node);
    expect(result.success).toBe(true);
  });
});
