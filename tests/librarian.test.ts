/**
 * Librarian tests — TDD RED → GREEN
 *
 * Tests for:
 *   1. LocalEmbedder.isAvailable() — health check
 *   2. LocalEmbedder.embedBatch() — batch with retry
 *   3. ArxivLibrarian.run() — graceful Ollama degradation
 *   4. ArxivLibrarian.run() — full happy path (mocked network)
 */

import { describe, test, expect, afterEach } from "bun:test";
import { rm } from "node:fs/promises";
import { LocalEmbedder } from "../src/embeddings/embedder";
import { ArxivLibrarian } from "../src/librarian/arxiv_librarian";

const TEST_DB = "/tmp/test_librarian.lancedb";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ──────────────────────────────────────────────────────────────────────────
// LocalEmbedder.isAvailable()
// ──────────────────────────────────────────────────────────────────────────

describe("LocalEmbedder.isAvailable()", () => {
  test("returns false when Ollama is unreachable", async () => {
    // Mock fetch to throw a connection error (matching real network failure)
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const e = new LocalEmbedder();
    expect(await e.isAvailable()).toBe(false);
  });

  test("returns true when Ollama responds 200", async () => {
    globalThis.fetch = (async (url: any) => {
      if (String(url).includes("/api/tags")) {
        return new Response(JSON.stringify({ models: [] }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;
    const e = new LocalEmbedder();
    expect(await e.isAvailable()).toBe(true);
  });

  test("returns false when Ollama responds non-200", async () => {
    globalThis.fetch = (async () => new Response("error", { status: 503 })) as unknown as typeof fetch;
    const e = new LocalEmbedder();
    expect(await e.isAvailable()).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// LocalEmbedder.embedBatch()
// ──────────────────────────────────────────────────────────────────────────

describe("LocalEmbedder.embedBatch()", () => {
  test("returns vectors for successful embeds", async () => {
    const mockVec = [0.1, 0.2, 0.3];
    globalThis.fetch = (async (url: any) => {
      if (String(url).includes("/api/embeddings")) {
        return new Response(JSON.stringify({ embedding: mockVec }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;

    const e = new LocalEmbedder();
    const results = await e.embedBatch(["text a", "text b"]);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(mockVec);
    expect(results[1]).toEqual(mockVec);
  });

  test("returns null for items that fail after all retries", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    const e = new LocalEmbedder();
    // retries=0 so we only try once per item
    const results = await e.embedBatch(["fail"], 0);
    expect(results).toHaveLength(1);
    expect(results[0]).toBeNull();
  });

  test("returns array parallel to input (mixed success/failure)", async () => {
    let callCount = 0;
    globalThis.fetch = (async (url: any) => {
      if (!String(url).includes("/api/embeddings")) return new Response("ok", { status: 200 });
      callCount++;
      // First call succeeds, second fails
      if (callCount === 1) {
        return new Response(JSON.stringify({ embedding: [1, 2, 3] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("error", { status: 500 });
    }) as unknown as typeof fetch;

    const e = new LocalEmbedder();
    const results = await e.embedBatch(["ok", "fail"], 0);
    expect(results[0]).toEqual([1, 2, 3]);
    expect(results[1]).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// ArxivLibrarian.run()
// ──────────────────────────────────────────────────────────────────────────

describe("ArxivLibrarian.run()", () => {
  test("returns {ingested:0, skipped:0} and does not throw when Ollama is down", async () => {
    globalThis.fetch = (async (url: any) => {
      if (String(url).includes("/api/tags")) return new Response("down", { status: 503 });
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;

    const lib = new ArxivLibrarian({
      queries: ["Ramsey number lower bound"],
      maxPerQuery: 2,
      dbPath: TEST_DB,
    });
    const result = await lib.run();
    expect(result.ingested).toBe(0);
    expect(result.skipped).toBe(0);

    await rm(TEST_DB, { recursive: true, force: true });
  });

  test("ingests papers when arXiv and Ollama are both mocked", async () => {
    const MOCK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.00001v1</id>
    <title>Ramsey Test Paper</title>
    <summary>Abstract about Ramsey numbers lower bounds.</summary>
  </entry>
</feed>`;

    const mockVec = new Array(768).fill(0.1);

    globalThis.fetch = (async (url: any, _opts?: any) => {
      const u = String(url);
      if (u.includes("/api/tags")) return new Response(JSON.stringify({ models: [] }), { status: 200 });
      if (u.includes("/api/embeddings")) {
        return new Response(JSON.stringify({ embedding: mockVec }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (u.includes("arxiv.org/api/query")) {
        return new Response(MOCK_XML, {
          status: 200,
          headers: { "Content-Type": "application/xml" },
        });
      }
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;

    const lib = new ArxivLibrarian({
      queries: ["Ramsey number lower bound"],
      maxPerQuery: 5,
      dbPath: TEST_DB + "_happy",
    });
    const result = await lib.run();
    expect(result.ingested).toBeGreaterThan(0);
    expect(result.skipped).toBe(0);

    await rm(TEST_DB + "_happy", { recursive: true, force: true });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Bug-fix tests — RED → GREEN after all 5 librarian bugs are fixed
// ════════════════════════════════════════════════════════════════════════════

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TABLE_ARXIV, TABLE_MATHLIB, type Premise } from "../src/embeddings/vector_store";
import { extractSearchQuery, keywordLiteratureFallback, formatLibraryMatch } from "../src/librarian/librarian_utils";

// ── Bug 4: extractSearchQuery ─────────────────────────────────────────────

describe("extractSearchQuery — prompt normalisation (Bug 4)", () => {
  test("strips fenced code blocks entirely", () => {
    const input = "Prove Schur S(6).\n```lean\ntheorem foo : True := trivial\n```\nUsing coloring.";
    const result = extractSearchQuery(input);
    expect(result).not.toContain("```");
    expect(result).not.toContain("theorem foo");
    expect(result).toContain("Schur");
  });

  test("strips inline JSON objects", () => {
    const input = 'Config: {"problem_class":"schur_partition","domain_size":537} and Schur theory.';
    const result = extractSearchQuery(input);
    expect(result).not.toContain("{");
    expect(result).toContain("Schur");
  });

  test("caps output at 400 characters", () => {
    const long = "Ramsey ".repeat(200);
    expect(extractSearchQuery(long).length).toBeLessThanOrEqual(400);
  });

  test("collapses multiple whitespace to single space", () => {
    expect(extractSearchQuery("Schur   number\n\n\nlower   bound")).toBe("Schur number lower bound");
  });

  test("returns non-empty string for a realistic Schur prompt", () => {
    const schurPrompt = `## Problem: Schur Number Lower Bound S(6) ≥ 537
\`\`\`lean
: ∃ (f : Fin 537 → Fin 6), ∀ (x y z : Fin 537), ...
\`\`\`
### Search Strategy
{"domain_size": 537, "num_partitions": 6}`;
    const result = extractSearchQuery(schurPrompt);
    expect(result.length).toBeGreaterThan(10);
    expect(result).not.toContain("```");
    expect(result).toContain("Schur");
  });
});

// ── Bug 5: keywordLiteratureFallback ─────────────────────────────────────

describe("keywordLiteratureFallback — offline fallback (Bug 5)", () => {
  test("returns non-empty for 'schur partition sum-free'", () => {
    const result = keywordLiteratureFallback("schur partition sum-free");
    expect(result.length).toBeGreaterThan(20);
    expect(result).toContain("[Paper]");
  });

  test("returns non-empty for 'ramsey graph coloring witness'", () => {
    const result = keywordLiteratureFallback("ramsey graph coloring witness");
    expect(result.length).toBeGreaterThan(20);
    expect(result).toContain("[Paper]");
  });

  test("returns non-empty for 'lean decide formal proof'", () => {
    const result = keywordLiteratureFallback("lean decide formal proof");
    expect(result.length).toBeGreaterThan(20);
  });

  test("returns empty string for completely unrelated topic", () => {
    expect(keywordLiteratureFallback("cooking recipes pasta carbonara")).toBe("");
  });

  test("results sourced from seed_literature.json (contain a year)", () => {
    // Ensures output is from the curated corpus, not empty hardcoded strings
    const result = keywordLiteratureFallback("schur");
    expect(result).toMatch(/\d{4}/);
  });
});

// ── Bug 2: formatLibraryMatch — type-aware rendering ─────────────────────

describe("formatLibraryMatch — correct type-based labeling (Bug 2)", () => {
  test("renders ARXIV as [Paper] with paperTitle and paperAbstract", () => {
    const match: Omit<Premise, "vector"> = {
      id: "arxiv-2301.12345",
      theoremSignature: "Generalised Schur Numbers",
      successfulTactic: "truncated abstract...",
      paperTitle: "Generalised Schur Numbers",
      paperAbstract: "We prove that S(r) grows exponentially...",
      type: "ARXIV",
    };
    const result = formatLibraryMatch(match, 1);
    expect(result).toContain("[Paper]");
    expect(result).not.toContain("[Lemma]");
    expect(result).toContain("Generalised Schur Numbers");
    expect(result).toContain("grows exponentially");
  });

  test("renders MATHLIB as [Lemma] with backtick theorem and tactic", () => {
    const match: Omit<Premise, "vector"> = {
      id: "mathlib-finset-card",
      theoremSignature: "Finset.card_le_card",
      successfulTactic: "exact Finset.card_le_card h",
      type: "MATHLIB",
    };
    const result = formatLibraryMatch(match, 1);
    expect(result).toContain("[Lemma]");
    expect(result).not.toContain("[Paper]");
    expect(result).toContain("Finset.card_le_card");
    expect(result).toContain("exact Finset.card_le_card h");
  });

  test("renders ARXIV with fallback to theoremSignature when paperTitle absent (legacy)", () => {
    const legacy: Omit<Premise, "vector"> = {
      id: "arxiv-old",
      theoremSignature: "Old Paper Title",
      successfulTactic: "old abstract",
      type: "ARXIV",
    };
    const result = formatLibraryMatch(legacy, 1);
    expect(result).toContain("[Paper]");
    expect(result).toContain("Old Paper Title");
  });
});

// ── Bug 3: ArxivLibrarian.count() — metadata sidecar ─────────────────────

describe("ArxivLibrarian.count() — metadata sidecar (Bug 3)", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  test("returns 0 when sidecar does not exist (first run)", async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "perqed-count-test-"));
    const lib = new ArxivLibrarian({ queries: [], maxPerQuery: 0, dbPath: tmpDir });
    expect(await lib.count()).toBe(0);
  });

  test("returns totalIngested from sidecar JSON", async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "perqed-count-test-"));
    await Bun.write(join(tmpDir, "librarian_meta.json"), JSON.stringify({
      totalIngested: 42,
      lastSeeded: new Date().toISOString(),
    }));
    const lib = new ArxivLibrarian({ queries: [], maxPerQuery: 0, dbPath: tmpDir });
    expect(await lib.count()).toBe(42);
  });

  test("returns 0 when sidecar JSON is malformed", async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "perqed-count-test-"));
    await Bun.write(join(tmpDir, "librarian_meta.json"), "not valid json {{{{");
    const lib = new ArxivLibrarian({ queries: [], maxPerQuery: 0, dbPath: tmpDir });
    expect(await lib.count()).toBe(0);
  });

  test("does NOT require Ollama or LanceDB (pure file IO)", async () => {
    // count() must work even when the DB dir doesn't exist
    tmpDir = await mkdtemp(join(tmpdir(), "perqed-count-test-"));
    const lib = new ArxivLibrarian({
      queries: [],
      maxPerQuery: 0,
      dbPath: join(tmpDir, "nonexistent.lancedb"),
    });
    expect(await lib.count()).toBe(0);
  });
});

// ── Bug 3: needsSeeding ───────────────────────────────────────────────────

describe("ArxivLibrarian.needsSeeding() (Bug 3)", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  test("returns true when sidecar absent", async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "perqed-seed-test-"));
    const lib = new ArxivLibrarian({ queries: [], maxPerQuery: 0, dbPath: tmpDir });
    expect(await lib.needsSeeding()).toBe(true);
  });

  test("returns true when totalIngested < minPremises", async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "perqed-seed-test-"));
    await Bun.write(join(tmpDir, "librarian_meta.json"), JSON.stringify({
      totalIngested: 5,
      lastSeeded: new Date().toISOString(),
    }));
    const lib = new ArxivLibrarian({ queries: [], maxPerQuery: 0, dbPath: tmpDir });
    expect(await lib.needsSeeding(50)).toBe(true);
  });

  test("returns false when totalIngested >= minPremises and seeded recently", async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "perqed-seed-test-"));
    await Bun.write(join(tmpDir, "librarian_meta.json"), JSON.stringify({
      totalIngested: 100,
      lastSeeded: new Date().toISOString(), // just now
    }));
    const lib = new ArxivLibrarian({ queries: [], maxPerQuery: 0, dbPath: tmpDir });
    expect(await lib.needsSeeding(50, 7)).toBe(false);
  });

  test("returns true when seeded more than maxAgeDays ago", async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "perqed-seed-test-"));
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(); // 8 days ago
    await Bun.write(join(tmpDir, "librarian_meta.json"), JSON.stringify({
      totalIngested: 100,
      lastSeeded: old,
    }));
    const lib = new ArxivLibrarian({ queries: [], maxPerQuery: 0, dbPath: tmpDir });
    expect(await lib.needsSeeding(50, 7)).toBe(true);
  });
});

// ── Bug 2: Premise interface — new optional fields ────────────────────────

describe("Premise interface — arXiv-specific fields (Bug 2)", () => {
  test("accepts paperTitle and paperAbstract as optional fields", () => {
    const p: Premise = {
      id: "arxiv-test",
      theoremSignature: "Title",
      successfulTactic: "abstract",
      type: "ARXIV",
      vector: [0.1, 0.2],
      paperTitle: "Full Paper Title",
      paperAbstract: "Full abstract text...",
    };
    expect(p.paperTitle).toBe("Full Paper Title");
    expect(p.paperAbstract).toBeDefined();
  });

  test("accepts LEAN_RESULT as a valid type literal", () => {
    const p: Premise = {
      id: "lean-result-1",
      theoremSignature: "schur_s6_lower_bound",
      successfulTactic: "exact ⟨witness, by decide⟩",
      type: "LEAN_RESULT",
      vector: [0.5],
    };
    expect(p.type).toBe("LEAN_RESULT");
  });
});

// ── Bug 1: TABLE_* constants ──────────────────────────────────────────────

describe("VectorDatabase table constants (Bug 1)", () => {
  test("TABLE_MATHLIB is 'mathlib_premises'", () => {
    expect(TABLE_MATHLIB).toBe("mathlib_premises");
  });

  test("TABLE_ARXIV is 'arxiv_papers'", () => {
    expect(TABLE_ARXIV).toBe("arxiv_papers");
  });
});
