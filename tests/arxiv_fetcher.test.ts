/**
 * Sprint 14: ArxivIngester Tests (TDD RED → GREEN)
 *
 * Tests the full arXiv ingestion pipeline with mocked fetch and embedder.
 */

import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { rm } from "node:fs/promises";
import { ArxivIngester } from "../src/scripts/arxiv_fetcher";
import { VectorDatabase, type Premise } from "../src/embeddings/vector_store";
import type { LocalEmbedder } from "../src/embeddings/embedder";

const TEST_DB_PATH = "./tmp_test_arxiv";

// Minimal arXiv Atom XML with 2 entries
const MOCK_ARXIV_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.12345v1</id>
    <title>On the Distribution of Prime Numbers in Short Intervals</title>
    <summary>We study the asymptotic distribution of prime numbers using analytic methods. Our main result improves the error term in the prime counting function.</summary>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2401.67890v1</id>
    <title>A New Approach to the Goldbach Conjecture</title>
    <summary>We present a novel sieve-theoretic approach to the Goldbach conjecture. Applications to twin primes are discussed.</summary>
  </entry>
</feed>`;

class MockEmbedder {
  embedCount = 0;
  async embed(_text: string): Promise<number[]> {
    this.embedCount++;
    return [0.1, 0.2, 0.3];
  }
}

describe("ArxivIngester", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    await rm(TEST_DB_PATH, { recursive: true, force: true });
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    await rm(TEST_DB_PATH, { recursive: true, force: true });
  });

  test("ingests papers from mocked arXiv XML and stores in VectorDB", async () => {
    globalThis.fetch = async (_url: any) => {
      return new Response(MOCK_ARXIV_XML, {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      });
    };

    const mockEmbedder = new MockEmbedder();
    const db = new VectorDatabase(TEST_DB_PATH);
    await db.initialize();

    const ingester = new ArxivIngester(
      mockEmbedder as unknown as LocalEmbedder,
      db,
    );
    await ingester.ingestCategory("math.NT", 10);

    // Should have embedded at least 2 chunks (one per paper, abstracts are short)
    expect(mockEmbedder.embedCount).toBeGreaterThanOrEqual(2);

    // Search should return results
    const results = await db.search([0.1, 0.2, 0.3], 5);
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  test("stored premises have type ARXIV and correct fields", async () => {
    globalThis.fetch = async (_url: any) => {
      return new Response(MOCK_ARXIV_XML, {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      });
    };

    const mockEmbedder = new MockEmbedder();
    const db = new VectorDatabase(TEST_DB_PATH);
    await db.initialize();

    const ingester = new ArxivIngester(
      mockEmbedder as unknown as LocalEmbedder,
      db,
    );
    await ingester.ingestCategory("math.NT", 10);

    const results = await db.search([0.1, 0.2, 0.3], 5);

    // Check that results have ARXIV type
    const arxivResult = results.find(r => r.type === "ARXIV");
    expect(arxivResult).toBeDefined();

    // Check that the title is prefixed with arXiv category
    expect(arxivResult!.theoremSignature).toContain("[arXiv: math.NT]");

    // Check that the abstract chunk is in successfulTactic
    expect(arxivResult!.successfulTactic.length).toBeGreaterThan(0);
  });

  test("handles arXiv API failure gracefully", async () => {
    globalThis.fetch = async (_url: any) => {
      return new Response("Service Unavailable", { status: 503 });
    };

    const mockEmbedder = new MockEmbedder();
    const db = new VectorDatabase(TEST_DB_PATH);
    await db.initialize();

    const ingester = new ArxivIngester(
      mockEmbedder as unknown as LocalEmbedder,
      db,
    );

    // Should throw on API failure
    let threw = false;
    try {
      await ingester.ingestCategory("math.NT", 10);
    } catch (e: any) {
      threw = true;
      expect(e.message).toContain("503");
    }
    expect(threw).toBe(true);
  });
});
