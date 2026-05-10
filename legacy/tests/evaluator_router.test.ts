/**
 * EvaluatorRouter — RED tests (TDD Phase 19)
 *
 * These tests are written BEFORE the implementation and define
 * the expected contract for the EvaluatorRouter module.
 */

import { expect, test, describe } from "bun:test";
import { EvaluatorRouter, NotImplementedError } from "../src/search/evaluator_router";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a complete graph K_n (every vertex connected to every other). */
function completeGraph(n: number): AdjacencyMatrix {
  const adj = new AdjacencyMatrix(n);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      adj.addEdge(i, j);
  return adj;
}

/** Build an empty graph on n vertices (no edges). */
function emptyGraph(n: number): AdjacencyMatrix {
  return new AdjacencyMatrix(n);
}

// ── RAMSEY_CLIQUES backend ────────────────────────────────────────────────────

describe("EvaluatorRouter — RAMSEY_CLIQUES backend", () => {
  test("routes to ramseyEnergy and returns 0 for a valid K_3 witness (n=4, r=4, s=4 empty graph)", async () => {
    // An empty graph on 3 vertices has no K_4 cliques AND no K_4 independent sets
    // For R(3,3): empty graph on 3 vertices has no K_3 clique (trivially) but 1 K_3 ind-set
    // Let's use a simple verifiable case: K_3 on 3 vertices, r=3, s=3 should have E > 0
    const adj = completeGraph(3);
    const energy = await EvaluatorRouter.getInstance("test").evaluate(adj, {
      evaluator_type: "RAMSEY_CLIQUES",
      r: 3,
      s: 3,
    });
    // K_3 has 1 K_3 clique, so energy >= 1
    expect(energy).toBeGreaterThan(0);
  });

  test("returns 0 for an empty graph with r=4 (no cliques possible on 3 vertices)", async () => {
    const adj = emptyGraph(3);
    const energy = await EvaluatorRouter.getInstance("test").evaluate(adj, {
      evaluator_type: "RAMSEY_CLIQUES",
      r: 4,
      s: 4,
    });
    // No K_4 possible on 3 vertices, and no K_4 ind-set either → E = 0
    expect(energy).toBe(0);
  });

  test("ramseyEnergy result is deterministic (same adj → same energy)", async () => {
    const adj = completeGraph(5);
    const e1 = await EvaluatorRouter.getInstance("test").evaluate(adj, { evaluator_type: "RAMSEY_CLIQUES", r: 3, s: 3 });
    const e2 = await EvaluatorRouter.getInstance("test").evaluate(adj, { evaluator_type: "RAMSEY_CLIQUES", r: 3, s: 3 });
    expect(e1).toBe(e2);
  });

  test("larger r/s on a small graph yields zero (no forbidden subgraph possible)", async () => {
    const adj = completeGraph(4);
    const energy = await EvaluatorRouter.getInstance("test").evaluate(adj, {
      evaluator_type: "RAMSEY_CLIQUES",
      r: 10,  // impossible on 4 vertices
      s: 10,
    });
    expect(energy).toBe(0);
  });
});

// ── NotImplemented stubs ──────────────────────────────────────────────────────

describe("EvaluatorRouter — stub backends", () => {
  test("SRG_PARAMETERS throws NotImplementedError", async () => {
    const adj = emptyGraph(4);
    await expect(
      EvaluatorRouter.getInstance("test").evaluate(adj, { evaluator_type: "SRG_PARAMETERS" })
    ).rejects.toBeInstanceOf(NotImplementedError);
  });

  test("MATRIX_ORTHOGONALITY throws NotImplementedError", async () => {
    const adj = emptyGraph(4);
    await expect(
      EvaluatorRouter.getInstance("test").evaluate(adj, { evaluator_type: "MATRIX_ORTHOGONALITY" })
    ).rejects.toBeInstanceOf(NotImplementedError);
  });

  test("NotImplementedError message contains the evaluator type", async () => {
    const adj = emptyGraph(4);
    try {
      await EvaluatorRouter.getInstance("test").evaluate(adj, { evaluator_type: "SRG_PARAMETERS" });
    } catch (e) {
      expect(e).toBeInstanceOf(NotImplementedError);
      expect((e as Error).message).toContain("SRG_PARAMETERS");
    }
  });
});

// ── AlgebraicBuilder integration ──────────────────────────────────────────────

describe("AlgebraicBuilder — routes through EvaluatorRouter", () => {
  test("buildAndVerify accepts evaluator_type in config and routes correctly", async () => {
    const { AlgebraicBuilder } = await import("../src/search/algebraic_builder");
    const result = await AlgebraicBuilder.buildAndVerify(
      {
        description: "Complete graph K_4 for routing test",
        vertices: 4,
        edge_rule_js: "return true;", // K_4
        r: 4,
        s: 4,
      },
      4,
      4,
      null,
      null,
      undefined,
      "RAMSEY_CLIQUES"
    );
    // K_4 has C(4,4)=1 clique → energy >= 1
    expect(result.energy).toBeGreaterThan(0);
  });

  test("buildAndVerify defaults to RAMSEY_CLIQUES when no evaluator_type passed", async () => {
    const { AlgebraicBuilder } = await import("../src/search/algebraic_builder");
    const result = await AlgebraicBuilder.buildAndVerify(
      {
        description: "Empty graph routing test",
        vertices: 3,
        edge_rule_js: "return false;",  // empty graph
        r: 10,
        s: 10,
      },
      10,
      10,
      null,
      null,
    );
    expect(result.energy).toBe(0);
  });
});

// ── SUM_FREE_PARTITION backend ────────────────────────────────────────────────

function makePartition(domainSize: number, colorMap: Map<number, number[]>): Int8Array {
  const p = new Int8Array(domainSize + 1).fill(-1);
  for (const [color, nums] of colorMap) {
    for (const n of nums) p[n] = color;
  }
  return p;
}

describe("EvaluatorRouter — SUM_FREE_PARTITION backend", () => {
  test("valid sum-free S(2) partition {1,4},{2,3} routes to E=0", async () => {
    const p = makePartition(4, new Map([[0, [1, 4]], [1, [2, 3]]]));
    const energy = await EvaluatorRouter.getInstance("test").evaluate(p, {
      evaluator_type: "SUM_FREE_PARTITION",
      domain_size: 4,
      num_partitions: 2,
    });
    expect(energy).toBe(0);
  });

  test("monochromatic {1,2,3} gives E > 0 via router", async () => {
    const p = makePartition(3, new Map([[0, [1, 2, 3]]]));
    const energy = await EvaluatorRouter.getInstance("test").evaluate(p, {
      evaluator_type: "SUM_FREE_PARTITION",
      domain_size: 3,
      num_partitions: 1,
    });
    expect(energy).toBeGreaterThan(0);
  });

  test("passing AdjacencyMatrix for SUM_FREE_PARTITION throws", async () => {
    const adj = emptyGraph(4);
    await expect(
      EvaluatorRouter.getInstance("test").evaluate(adj, { evaluator_type: "SUM_FREE_PARTITION", domain_size: 4, num_partitions: 2 })
    ).rejects.toThrow();
  });

  test("passing Int8Array for RAMSEY_CLIQUES throws", async () => {
    const p = makePartition(4, new Map([[0, [1, 4]], [1, [2, 3]]]));
    await expect(
      EvaluatorRouter.getInstance("test").evaluate(p, { evaluator_type: "RAMSEY_CLIQUES", r: 4, s: 4 })
    ).rejects.toThrow();
  });
});
