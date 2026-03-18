/**
 * Proof DAG tests — TDD RED → GREEN
 *
 * Tests for:
 *   1. ProofDAGSchema — valid/invalid inputs
 *   2. DAGExecutor — execution order, parallelism, failure blocking
 */

import { describe, test, expect } from "bun:test";
import { ProofDAGSchema } from "../src/proof_dag/schemas";
import { DAGExecutor } from "../src/proof_dag/dag_executor";
import type { ProofDAG } from "../src/proof_dag/schemas";

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function makeDAG(nodes: ProofDAG["nodes"]): ProofDAG {
  return {
    id: "test-dag",
    goal: "test",
    nodes,
    createdAt: new Date().toISOString(),
  };
}

function pendingNode(
  id: string,
  kind: ProofDAG["nodes"][0]["kind"],
  dependsOn: string[] = [],
): ProofDAG["nodes"][0] {
  return { id, kind, label: id, dependsOn, config: {}, status: "pending" };
}

// ──────────────────────────────────────────────────────────────────────────
// ProofDAGSchema
// ──────────────────────────────────────────────────────────────────────────

describe("ProofDAGSchema", () => {
  test("accepts a valid minimal DAG", () => {
    const dag = makeDAG([pendingNode("a", "z3")]);
    expect(() => ProofDAGSchema.parse(dag)).not.toThrow();
  });

  test("accepts a valid multi-node DAG with dependency chain", () => {
    const dag = makeDAG([
      pendingNode("lit", "literature"),
      pendingNode("sa", "search", ["lit"]),
      pendingNode("lns", "z3", ["sa"]),
    ]);
    expect(() => ProofDAGSchema.parse(dag)).not.toThrow();
  });

  test("rejects a DAG with an empty nodes array", () => {
    expect(() => ProofDAGSchema.parse({ ...makeDAG([]) })).toThrow();
  });

  test("rejects a DAG with a dangling dependsOn reference", () => {
    const dag = makeDAG([pendingNode("a", "z3", ["nonexistent"])]);
    expect(() => ProofDAGSchema.parse(dag)).toThrow(/dangling/);
  });

  test("rejects a DAG with a cycle", () => {
    const dag = makeDAG([
      { ...pendingNode("a", "z3", ["b"]) },
      { ...pendingNode("b", "z3", ["a"]) },
    ]);
    expect(() => ProofDAGSchema.parse(dag)).toThrow(/cycle/);
  });

  test("rejects a self-loop", () => {
    const dag = makeDAG([pendingNode("a", "z3", ["a"])]);
    expect(() => ProofDAGSchema.parse(dag)).toThrow();
  });

  test("rejects a DAG missing required fields", () => {
    expect(() => ProofDAGSchema.parse({ goal: "test", nodes: [] })).toThrow();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// DAGExecutor — execution order
// ──────────────────────────────────────────────────────────────────────────

describe("DAGExecutor — execution order", () => {
  test("executes a two-node chain in dependency order", async () => {
    const order: string[] = [];
    const dag = ProofDAGSchema.parse(
      makeDAG([pendingNode("b", "z3", ["a"]), pendingNode("a", "z3")]),
    );

    const executor = new DAGExecutor(dag, {
      z3: async (node) => {
        order.push(node.id);
        return "ok";
      },
    });

    await executor.execute();
    // a must come before b
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
  });

  test("executes a three-level chain in correct order", async () => {
    const order: string[] = [];
    const dag = ProofDAGSchema.parse(
      makeDAG([
        pendingNode("lean", "lean", ["z3"]),
        pendingNode("z3", "z3", ["sa"]),
        pendingNode("sa", "search"),
      ]),
    );

    const executor = new DAGExecutor(dag, {
      search: async (node) => { order.push(node.id); return "done"; },
      z3: async (node) => { order.push(node.id); return "sat"; },
      lean: async (node) => { order.push(node.id); return "qed"; },
    });

    await executor.execute();
    expect(order).toEqual(["sa", "z3", "lean"]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// DAGExecutor — parallelism
// ──────────────────────────────────────────────────────────────────────────

describe("DAGExecutor — parallelism", () => {
  test("runs independent nodes concurrently", async () => {
    const startTimes: Record<string, number> = {};
    const endTimes: Record<string, number> = {};

    const dag = ProofDAGSchema.parse(
      makeDAG([pendingNode("w1", "search"), pendingNode("w2", "search")]),
    );

    const executor = new DAGExecutor(dag, {
      search: async (node) => {
        startTimes[node.id] = Date.now();
        await new Promise((r) => setTimeout(r, 60));
        endTimes[node.id] = Date.now();
        return "done";
      },
    });

    await executor.execute();
    // w2 must have started before w1 finished
    expect(startTimes["w2"]!).toBeLessThan(endTimes["w1"]!);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// DAGExecutor — failure handling
// ──────────────────────────────────────────────────────────────────────────

describe("DAGExecutor — failure handling", () => {
  test("blocks dependent nodes when upstream fails", async () => {
    const executed: string[] = [];
    const dag = ProofDAGSchema.parse(
      makeDAG([pendingNode("root", "z3"), pendingNode("child", "lean", ["root"])]),
    );

    const executor = new DAGExecutor(dag, {
      z3: async () => { throw new Error("UNSAT"); },
      lean: async (node) => { executed.push(node.id); return "ok"; },
    });

    const result = await executor.execute();
    expect(executed).not.toContain("child");
    expect(result.failed).toContain("root");
    expect(result.blocked).toContain("child");
  });

  test("marks failed node in result map with error object", async () => {
    const dag = ProofDAGSchema.parse(makeDAG([pendingNode("a", "z3")]));
    const executor = new DAGExecutor(dag, {
      z3: async () => { throw new Error("kaboom"); },
    });

    const result = await executor.execute();
    const r = result.results.get("a") as { error: string };
    expect(r.error).toContain("kaboom");
  });

  test("succeeds partial DAG when only leaf node fails", async () => {
    const dag = ProofDAGSchema.parse(
      makeDAG([
        pendingNode("lit", "literature"),
        pendingNode("sa", "search", ["lit"]),
        pendingNode("lean", "lean", ["sa"]),
      ]),
    );

    const executor = new DAGExecutor(dag, {
      literature: async () => "papers",
      search: async () => "graph",
      lean: async () => { throw new Error("type error"); },
    });

    const result = await executor.execute();
    expect(result.succeeded).toContain("lit");
    expect(result.succeeded).toContain("sa");
    expect(result.failed).toContain("lean");
  });

  test("throws if no handler registered for a node kind", async () => {
    const dag = ProofDAGSchema.parse(makeDAG([pendingNode("a", "z3")]));
    // No z3 handler registered
    const executor = new DAGExecutor(dag, {});

    const result = await executor.execute();
    expect(result.failed).toContain("a");
    const r = result.results.get("a") as { error: string };
    expect(r.error).toContain("No handler registered");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// DAGExecutor — getResult helper
// ──────────────────────────────────────────────────────────────────────────

describe("DAGExecutor.getResult()", () => {
  test("retrieves typed result after execution", async () => {
    const dag = ProofDAGSchema.parse(makeDAG([pendingNode("a", "z3")]));
    const executor = new DAGExecutor(dag, {
      z3: async () => ({ sat: true, witness: [1, 2, 3] }),
    });
    await executor.execute();
    const r = executor.getResult<{ sat: boolean }>("a");
    expect(r.sat).toBe(true);
  });

  test("throws if queried node has not run", async () => {
    const dag = ProofDAGSchema.parse(makeDAG([pendingNode("a", "z3")]));
    const executor = new DAGExecutor(dag, {});
    expect(() => executor.getResult("a")).toThrow(/No result for node/);
  });
});
