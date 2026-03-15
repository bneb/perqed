/**
 * Sprint 13: LocalEmbedder Tests (TDD RED → GREEN)
 *
 * Tests the Ollama embedding interface:
 * 1. Successful embed returns a vector array
 * 2. Network failure returns [] gracefully
 * 3. Non-200 response returns [] gracefully
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { LocalEmbedder } from "../src/embeddings/embedder";

describe("LocalEmbedder", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("embed() returns vector from Ollama response", async () => {
    const mockVector = [0.1, 0.2, 0.3, 0.4, 0.5];
    globalThis.fetch = async (_url: any, _opts: any) => {
      return new Response(JSON.stringify({ embedding: mockVector }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const embedder = new LocalEmbedder();
    const result = await embedder.embed("theorem nat_add_comm");

    expect(result).toEqual(mockVector);
  });

  test("embed() sends correct model and prompt to Ollama", async () => {
    let capturedBody: any = null;
    globalThis.fetch = async (_url: any, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return new Response(JSON.stringify({ embedding: [1, 2] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const embedder = new LocalEmbedder();
    await embedder.embed("test prompt");

    expect(capturedBody.model).toBe("nomic-embed-text");
    expect(capturedBody.prompt).toBe("test prompt");
  });

  test("embed() returns [] when fetch rejects (network error)", async () => {
    globalThis.fetch = async () => {
      throw new Error("ECONNREFUSED");
    };

    const embedder = new LocalEmbedder();
    const result = await embedder.embed("test");

    expect(result).toEqual([]);
  });

  test("embed() returns [] on non-200 response", async () => {
    globalThis.fetch = async () => {
      return new Response("Internal Server Error", { status: 500 });
    };

    const embedder = new LocalEmbedder();
    const result = await embedder.embed("test");

    expect(result).toEqual([]);
  });
});
