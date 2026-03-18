/**
 * DAG RAG integration tests — TDD RED → GREEN
 *
 * Validates that the Mid-Proof RAG pipeline threads context correctly:
 *
 *   1. A `mathlib_query` node retrieves formal premises from LanceDB.
 *   2. A `lean` node that declares `contextFromNode: ["mathlib_q"]` receives
 *      the string result produced by the mathlib_query handler.
 *   3. A `literature` node retrieves arXiv abstracts from LanceDB.
 *   4. Context strings are correctly injected into the downstream node context.
 *   5. Graceful fallback when DB is empty (returns empty context string, not throw).
 */

import { describe, test, expect, afterAll } from "bun:test";
import { rm } from "node:fs/promises";
import { DAGExecutor } from "../src/proof_dag/dag_executor";
import { ProofDAGSchema } from "../src/proof_dag/schemas";
import { VectorDatabase, TABLE_MATHLIB } from "../src/embeddings/vector_store";
import type { ProofDAG } from "../src/proof_dag/schemas";

const TEST_DB = "/tmp/perqed_test_dag_rag.lancedb";

afterAll(async () => {
  await rm(TEST_DB, { recursive: true, force: true });
});

// ── Helpers ──────────────────────────────────────────────────────────────

function pendingNode(
  id: string,
  kind: ProofDAG["nodes"][0]["kind"],
  dependsOn: string[] = [],
  config: Record<string, unknown> = {},
): ProofDAG["nodes"][0] {
  return { id, kind, label: id, dependsOn, config, status: "pending" };
}

function makeDAG(nodes: ProofDAG["nodes"]): ProofDAG {
  return { id: "rag-test", goal: "R(4,6) >= 36", nodes, createdAt: new Date().toISOString() };
}

// ── Pre-populate the DB with test data ───────────────────────────────────

async function seedTestDB() {
  const db = new VectorDatabase(TEST_DB, TABLE_MATHLIB);
  await db.initialize();
  await db.addMathlibPremises([
    {
      id: "mathlib-test-clique",
      theoremSignature: "theorem SimpleGraph.IsClique.mono : G.IsClique s → G ≤ H → H.IsClique s",
      successfulTactic: "Cliques are monotone in subgraph relation",
      type: "MATHLIB",
      vector: [1, 0, 0, 0],
    },
    {
      id: "mathlib-test-pigeonhole",
      theoremSignature: "theorem Finset.exists_ne_map_eq_of_card_lt_of_maps_to : ∃ x y, x ≠ y ∧ f x = f y",
      successfulTactic: "Pigeonhole principle for finite functions",
      type: "MATHLIB",
      vector: [0, 1, 0, 0],
    },
  ]);

  const arxivDb = new VectorDatabase(TEST_DB, "arxiv_papers");
  await arxivDb.initialize();
  await arxivDb.addPremises([
    {
      id: "arxiv-ramsey-0001",
      theoremSignature: "Ramsey lower bounds via circulant graphs",
      successfulTactic: "We use Paley graphs over GF(q) to construct explicit witnesses for R(k,k).",
      type: "ARXIV",
      vector: [0, 0, 1, 0],
    },
  ]);
}

// ── Concrete DAG handler factory (mirrors perqed.ts wiring) ─────────────

function makeMidProofRAGHandlers(db: VectorDatabase, arxivDb: VectorDatabase) {
  return {
    // mathlib_query: vector search the mathlib_premises table
    mathlib_query: async (node: any, results: ReadonlyMap<string, unknown>) => {
      const cfg = node.config as { query?: string; k?: number };
      const k = cfg.k ?? 5;
      const queryVec = [1, 0, 0, 0]; // In prod: embed cfg.query; here use a fixed vec
      const hits = await db.searchMathlib(queryVec, k);
      if (hits.length === 0) return "No mathlib premises found.";
      return "Relevant Lean 4 lemmas:\n" + hits.map((h) => `  - ${h.theoremSignature}`).join("\n");
    },

    // literature: vector search the arxiv_papers table
    literature: async (node: any, results: ReadonlyMap<string, unknown>) => {
      const cfg = node.config as { query?: string; k?: number };
      const k = cfg.k ?? 3;
      const queryVec = [0, 0, 1, 0]; // Fixed for tests; prod embeds cfg.query
      const hits = await arxivDb.search(queryVec, k);
      if (hits.length === 0) return "No literature found.";
      return "Found literature:\n" + hits.map((h) => h.successfulTactic).join("\n");
    },

    // lean: collects contextFromNode strings and records them in result
    lean: async (node: any, results: ReadonlyMap<string, unknown>) => {
      const cfg = node.config as { contextFromNode?: string[]; theoremSignature?: string };
      const contextParts: string[] = [];

      for (const srcId of cfg.contextFromNode ?? []) {
        const ctx = results.get(srcId);
        if (typeof ctx === "string") {
          contextParts.push(ctx);
        }
      }

      const injectedContext = contextParts.join("\n\n");
      return {
        note: `lean node "${node.id}" executed`,
        injectedContext,
        theoremSignature: cfg.theoremSignature ?? "",
      };
    },

    // search: stub
    search: async (node: any) => ({ note: `search node "${node.id}"`, config: node.config }),
  };
}

// ────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────

describe("DAG RAG — mathlib_query node", () => {
  test("mathlib_query node retrieves formal Lean 4 premises from the DB", async () => {
    await seedTestDB();

    const db = new VectorDatabase(TEST_DB, TABLE_MATHLIB);
    await db.initialize();
    const arxivDb = new VectorDatabase(TEST_DB, "arxiv_papers");
    await arxivDb.initialize();

    const dag = ProofDAGSchema.parse(
      makeDAG([pendingNode("mathlib_q", "mathlib_query", [], { query: "clique monotone", k: 5 })]),
    );

    const executor = new DAGExecutor(dag, makeMidProofRAGHandlers(db, arxivDb));
    await executor.execute();

    const result = executor.getResult<string>("mathlib_q");
    expect(typeof result).toBe("string");
    expect(result).toContain("Relevant Lean 4 lemmas:");
    // The specific theorem we seeded must appear
    expect(result).toContain("IsClique");
  });

  test("mathlib_query result is passed into downstream lean node via contextFromNode", async () => {
    const db = new VectorDatabase(TEST_DB, TABLE_MATHLIB);
    await db.initialize();
    const arxivDb = new VectorDatabase(TEST_DB, "arxiv_papers");
    await arxivDb.initialize();

    const dag = ProofDAGSchema.parse(
      makeDAG([
        pendingNode("mathlib_q", "mathlib_query", [], { query: "Ramsey graph clique", k: 5 }),
        pendingNode("lean_step", "lean", ["mathlib_q"], {
          theoremSignature: "theorem R_4_6_ge_36 : ramsey 4 6 ≥ 36",
          contextFromNode: ["mathlib_q"],
        }),
      ]),
    );

    const executor = new DAGExecutor(dag, makeMidProofRAGHandlers(db, arxivDb));
    await executor.execute();

    const leanResult = executor.getResult<{
      note: string;
      injectedContext: string;
    }>("lean_step");

    expect(leanResult.note).toContain("lean node");
    // The injected context must contain the mathlib query result
    expect(leanResult.injectedContext).toContain("Relevant Lean 4 lemmas:");
    expect(leanResult.injectedContext).toContain("IsClique");
  });
});

describe("DAG RAG — literature node", () => {
  test("literature node retrieves arXiv paper abstracts", async () => {
    const db = new VectorDatabase(TEST_DB, TABLE_MATHLIB);
    await db.initialize();
    const arxivDb = new VectorDatabase(TEST_DB, "arxiv_papers");
    await arxivDb.initialize();

    const dag = ProofDAGSchema.parse(
      makeDAG([pendingNode("lit", "literature", [], { query: "Ramsey lower bound", k: 3 })]),
    );

    const executor = new DAGExecutor(dag, makeMidProofRAGHandlers(db, arxivDb));
    await executor.execute();

    const result = executor.getResult<string>("lit");
    expect(typeof result).toBe("string");
    expect(result).toContain("Found literature:");
    expect(result).toContain("Paley");
  });

  test("literature context is injected into downstream lean node", async () => {
    const db = new VectorDatabase(TEST_DB, TABLE_MATHLIB);
    await db.initialize();
    const arxivDb = new VectorDatabase(TEST_DB, "arxiv_papers");
    await arxivDb.initialize();

    const dag = ProofDAGSchema.parse(
      makeDAG([
        pendingNode("lit", "literature", [], { query: "Ramsey lower bound", k: 3 }),
        pendingNode("lean_step", "lean", ["lit"], {
          theoremSignature: "theorem bound : True",
          contextFromNode: ["lit"],
        }),
      ]),
    );

    const executor = new DAGExecutor(dag, makeMidProofRAGHandlers(db, arxivDb));
    await executor.execute();

    const leanResult = executor.getResult<{ injectedContext: string }>("lean_step");
    expect(leanResult.injectedContext).toContain("Found literature:");
    expect(leanResult.injectedContext).toContain("Paley");
  });
});

describe("DAG RAG — context threading", () => {
  test("multiple contextFromNode sources are all injected into lean node", async () => {
    const db = new VectorDatabase(TEST_DB, TABLE_MATHLIB);
    await db.initialize();
    const arxivDb = new VectorDatabase(TEST_DB, "arxiv_papers");
    await arxivDb.initialize();

    const dag = ProofDAGSchema.parse(
      makeDAG([
        pendingNode("mathlib_q", "mathlib_query", [], { query: "clique", k: 5 }),
        pendingNode("lit", "literature", [], { query: "Ramsey", k: 3 }),
        pendingNode("lean_step", "lean", ["mathlib_q", "lit"], {
          theoremSignature: "theorem combined : True",
          contextFromNode: ["mathlib_q", "lit"],
        }),
      ]),
    );

    const executor = new DAGExecutor(dag, makeMidProofRAGHandlers(db, arxivDb));
    await executor.execute();

    const leanResult = executor.getResult<{ injectedContext: string }>("lean_step");
    // Must contain both sources
    expect(leanResult.injectedContext).toContain("Relevant Lean 4 lemmas:");
    expect(leanResult.injectedContext).toContain("Found literature:");
  });

  test("lean node works correctly when contextFromNode is absent", async () => {
    const db = new VectorDatabase(TEST_DB, TABLE_MATHLIB);
    await db.initialize();
    const arxivDb = new VectorDatabase(TEST_DB, "arxiv_papers");
    await arxivDb.initialize();

    // No contextFromNode key in config
    const dag = ProofDAGSchema.parse(
      makeDAG([pendingNode("lean_standalone", "lean", [], { theoremSignature: "theorem standalone : True" })]),
    );

    const executor = new DAGExecutor(dag, makeMidProofRAGHandlers(db, arxivDb));
    await executor.execute();

    const result = executor.getResult<{ injectedContext: string }>("lean_standalone");
    expect(result.injectedContext).toBe("");
  });

  test("empty DB returns fallback strings, not throws", async () => {
    const emptyDb = new VectorDatabase(TEST_DB + "_empty", TABLE_MATHLIB);
    await emptyDb.initialize();
    const emptyArxivDb = new VectorDatabase(TEST_DB + "_empty", "arxiv_papers");
    await emptyArxivDb.initialize();

    const dag = ProofDAGSchema.parse(
      makeDAG([
        pendingNode("mathlib_q", "mathlib_query", [], { query: "anything", k: 5 }),
        pendingNode("lit", "literature", [], { query: "anything", k: 3 }),
      ]),
    );

    const executor = new DAGExecutor(dag, makeMidProofRAGHandlers(emptyDb, emptyArxivDb));
    const dagResult = await executor.execute();

    expect(dagResult.failed).toHaveLength(0);
    const mq = executor.getResult<string>("mathlib_q");
    const li = executor.getResult<string>("lit");
    expect(typeof mq).toBe("string");
    expect(typeof li).toBe("string");

    await rm(TEST_DB + "_empty", { recursive: true, force: true });
  });
});

describe("DAG RAG — mathlib_query in ProofDAGSchema", () => {
  test("ProofDAGSchema accepts mathlib_query as a valid node kind", () => {
    const dag = makeDAG([pendingNode("mq", "mathlib_query", [], { query: "clique", k: 3 })]);
    expect(() => ProofDAGSchema.parse(dag)).not.toThrow();
  });
});
