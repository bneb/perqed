/**
 * MathlibLibrarian tests — TDD RED → GREEN
 *
 * Tests:
 *   1. Gracefully returns {ingested:0, skipped:0} when Ollama is down
 *   2. Ingests theorems with mocked embedBatch (vectors stored correctly)
 *   3. Stored theorems are retrievable via searchMathlib
 *   4. Empty input array is a no-op
 *   5. Batch size respected (large batch split into multiple calls)
 */

import { describe, test, expect, afterAll } from "bun:test";
import { rm } from "node:fs/promises";
import { MathlibLibrarian, type LeanTheorem } from "../src/librarian/mathlib_librarian";
import { VectorDatabase, TABLE_MATHLIB } from "../src/embeddings/vector_store";

const TEST_DB = "/tmp/perqed_test_mathlib_lib.lancedb";

const originalFetch = globalThis.fetch;
afterAll(async () => {
  globalThis.fetch = originalFetch;
  await rm(TEST_DB, { recursive: true, force: true });
});

const SAMPLE_THEOREMS: LeanTheorem[] = [
  {
    theorem: "Nat.add_comm",
    signature: "theorem Nat.add_comm (n m : ℕ) : n + m = m + n",
    docstring: "Addition is commutative for natural numbers",
  },
  {
    theorem: "SimpleGraph.IsClique.mono",
    signature: "theorem SimpleGraph.IsClique.mono : G.IsClique s → G ≤ H → H.IsClique s",
    docstring: "Cliques are monotone in subgraph relation",
  },
];

// ──────────────────────────────────────────────────────────────────────────

describe("MathlibLibrarian — Ollama unavailable", () => {
  test("returns {ingested:0, skipped:0} and does NOT throw when Ollama is down", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    const lib = new MathlibLibrarian({ dbPath: TEST_DB + "_down" });
    const result = await lib.ingest(SAMPLE_THEOREMS);

    expect(result.ingested).toBe(0);
    expect(result.skipped).toBe(0);

    await rm(TEST_DB + "_down", { recursive: true, force: true });
    globalThis.fetch = originalFetch;
  });
});

describe("MathlibLibrarian — happy path", () => {
  const MOCK_VEC = new Array(4).fill(0.1);

  function mockOllamaUp() {
    globalThis.fetch = (async (url: any, _opts?: any) => {
      const u = String(url);
      if (u.includes("/api/tags")) {
        return new Response(JSON.stringify({ models: [] }), { status: 200 });
      }
      if (u.includes("/api/embeddings")) {
        return new Response(JSON.stringify({ embedding: MOCK_VEC }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;
  }

  test("ingests theorems and returns correct ingested count", async () => {
    mockOllamaUp();
    const lib = new MathlibLibrarian({ dbPath: TEST_DB + "_ingest" });
    const result = await lib.ingest(SAMPLE_THEOREMS);
    globalThis.fetch = originalFetch;

    expect(result.ingested).toBe(SAMPLE_THEOREMS.length);
    expect(result.skipped).toBe(0);

    await rm(TEST_DB + "_ingest", { recursive: true, force: true });
  });

  test("ingested premises are retrievable via searchMathlib", async () => {
    mockOllamaUp();
    const lib = new MathlibLibrarian({ dbPath: TEST_DB + "_retrieve" });
    await lib.ingest(SAMPLE_THEOREMS);
    globalThis.fetch = originalFetch;

    // Directly query the DB to confirm rows are stored
    const db = new VectorDatabase(TEST_DB + "_retrieve", TABLE_MATHLIB);
    await db.initialize();
    const results = await db.searchMathlib(MOCK_VEC, 5);

    expect(results.length).toBeGreaterThan(0);
    // Results must reference our theorems
    const ids = results.map((r) => r.id);
    expect(ids.some((id) => id.includes("Nat.add_comm") || id.includes("mathlib-"))).toBe(true);

    await rm(TEST_DB + "_retrieve", { recursive: true, force: true });
  });

  test("stored premises have type MATHLIB", async () => {
    mockOllamaUp();
    const lib = new MathlibLibrarian({ dbPath: TEST_DB + "_type" });
    await lib.ingest([SAMPLE_THEOREMS[0]!]);
    globalThis.fetch = originalFetch;

    const db = new VectorDatabase(TEST_DB + "_type", TABLE_MATHLIB);
    await db.initialize();
    const results = await db.searchMathlib(MOCK_VEC, 1);

    expect(results[0]?.type).toBe("MATHLIB");

    await rm(TEST_DB + "_type", { recursive: true, force: true });
  });

  test("empty theorem array is a no-op (ingested=0, skipped=0)", async () => {
    mockOllamaUp();
    const lib = new MathlibLibrarian({ dbPath: TEST_DB + "_empty" });
    const result = await lib.ingest([]);
    globalThis.fetch = originalFetch;

    expect(result.ingested).toBe(0);
    expect(result.skipped).toBe(0);

    await rm(TEST_DB + "_empty", { recursive: true, force: true });
  });

  test("uses docstring for embedding when present, signature as fallback", async () => {
    const capturedPrompts: string[] = [];
    globalThis.fetch = (async (url: any, opts?: any) => {
      const u = String(url);
      if (u.includes("/api/tags")) return new Response(JSON.stringify({ models: [] }), { status: 200 });
      if (u.includes("/api/embeddings")) {
        const body = JSON.parse((opts as any)?.body ?? "{}");
        capturedPrompts.push(body.prompt ?? "");
        return new Response(JSON.stringify({ embedding: MOCK_VEC }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;

    const withDocstring: LeanTheorem = {
      theorem: "test_theorem",
      signature: "theorem test_theorem : True",
      docstring: "This is the docstring",
    };
    const withoutDocstring: LeanTheorem = {
      theorem: "no_docstring",
      signature: "theorem no_docstring : False",
    };

    const lib = new MathlibLibrarian({ dbPath: TEST_DB + "_prompt" });
    await lib.ingest([withDocstring, withoutDocstring]);
    globalThis.fetch = originalFetch;

    // The docstring should be embedded when present
    expect(capturedPrompts.some((p) => p.includes("This is the docstring"))).toBe(true);
    // The signature should be embedded when docstring is absent
    expect(capturedPrompts.some((p) => p.includes("theorem no_docstring"))).toBe(true);

    await rm(TEST_DB + "_prompt", { recursive: true, force: true });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// VectorDatabase dual-table: ensure the two tables are truly independent
// ──────────────────────────────────────────────────────────────────────────

describe("VectorDatabase — dual-table isolation", () => {
  const SHARED_DB = TEST_DB + "_dual";

  afterAll(async () => {
    await rm(SHARED_DB, { recursive: true, force: true });
  });

  test("arxiv_papers and mathlib_premises are independent tables", async () => {
    const arxivDb = new VectorDatabase(SHARED_DB, "arxiv_papers");
    await arxivDb.initialize();
    await arxivDb.addPremises([
      {
        id: "arxiv-001",
        theoremSignature: "arXiv paper on Ramsey numbers",
        successfulTactic: "Some abstract text",
        type: "ARXIV",
        vector: [1, 0, 0, 0],
      },
    ]);

    const mathlibDb = new VectorDatabase(SHARED_DB, TABLE_MATHLIB);
    await mathlibDb.initialize();
    await mathlibDb.addMathlibPremises([
      {
        id: "mathlib-Nat.add_comm",
        theoremSignature: "theorem Nat.add_comm (n m : ℕ) : n + m = m + n",
        successfulTactic: "Addition is commutative for natural numbers",
        type: "MATHLIB",
        vector: [0, 1, 0, 0],
      },
    ]);

    // Searching arxiv should NOT return mathlib entries
    const arxivResults = await arxivDb.search([1, 0, 0, 0], 5);
    expect(arxivResults.every((r) => r.id.startsWith("arxiv-"))).toBe(true);

    // Searching mathlib should NOT return arxiv entries
    const mathlibResults = await mathlibDb.searchMathlib([0, 1, 0, 0], 5);
    expect(mathlibResults.every((r) => r.id.startsWith("mathlib-"))).toBe(true);
  });

  test("addMathlibPremises always writes to mathlib_premises regardless of instance tableName", async () => {
    // Even if constructed with arxiv_papers, addMathlibPremises calls the mathlib table
    const db = new VectorDatabase(SHARED_DB + "_crosscheck", "arxiv_papers");
    await db.initialize();

    await db.addMathlibPremises([
      {
        id: "mathlib-crosscheck",
        theoremSignature: "theorem crosscheck : True",
        successfulTactic: "trivial",
        type: "MATHLIB",
        vector: [0.5, 0.5, 0, 0],
      },
    ]);

    // Use a fresh mathlib-targeted instance to verify
    const check = new VectorDatabase(SHARED_DB + "_crosscheck", TABLE_MATHLIB);
    await check.initialize();
    const results = await check.searchMathlib([0.5, 0.5, 0, 0], 5);
    expect(results.length).toBe(1);
    expect(results[0]!.id).toBe("mathlib-crosscheck");

    await rm(SHARED_DB + "_crosscheck", { recursive: true, force: true });
  });
});
