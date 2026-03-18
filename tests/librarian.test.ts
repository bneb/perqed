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
    globalThis.fetch = async () => {
      throw new Error("ECONNREFUSED");
    };
    const e = new LocalEmbedder();
    expect(await e.isAvailable()).toBe(false);
  });

  test("returns true when Ollama responds 200", async () => {
    globalThis.fetch = async (url: any) => {
      if (String(url).includes("/api/tags")) {
        return new Response(JSON.stringify({ models: [] }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    };
    const e = new LocalEmbedder();
    expect(await e.isAvailable()).toBe(true);
  });

  test("returns false when Ollama responds non-200", async () => {
    globalThis.fetch = async () => new Response("error", { status: 503 });
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
    globalThis.fetch = async (url: any) => {
      if (String(url).includes("/api/embeddings")) {
        return new Response(JSON.stringify({ embedding: mockVec }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("ok", { status: 200 });
    };

    const e = new LocalEmbedder();
    const results = await e.embedBatch(["text a", "text b"]);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(mockVec);
    expect(results[1]).toEqual(mockVec);
  });

  test("returns null for items that fail after all retries", async () => {
    globalThis.fetch = async () => {
      throw new Error("ECONNREFUSED");
    };

    const e = new LocalEmbedder();
    // retries=0 so we only try once per item
    const results = await e.embedBatch(["fail"], 0);
    expect(results).toHaveLength(1);
    expect(results[0]).toBeNull();
  });

  test("returns array parallel to input (mixed success/failure)", async () => {
    let callCount = 0;
    globalThis.fetch = async (url: any) => {
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
    };

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
    globalThis.fetch = async (url: any) => {
      if (String(url).includes("/api/tags")) return new Response("down", { status: 503 });
      return new Response("ok", { status: 200 });
    };

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

    globalThis.fetch = async (url: any, _opts?: any) => {
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
    };

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
