/**
 * Tests for ArchitectClient — Gemini escalation with Zod validation.
 *
 * Mocks the Gemini API to test schema validation, error handling,
 * and prompt construction without requiring a live API key.
 */

import { expect, test, describe, beforeEach, afterEach, mock } from "bun:test";
import { ArchitectClient, type ArchitectClientConfig } from "../src/architect_client";
import { ArchitectResponseSchema } from "../src/schemas";

// ──────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────

const TEST_CONFIG: ArchitectClientConfig = {
  apiKey: "test-api-key-not-real",
  model: "gemini-2.5-pro",
};

const VALID_ARCHITECT_RESPONSE = {
  analysis: "The agent is attempting to prove the inductive step without first establishing the base case. Each Z3 encoding assumes n > 0 but never verifies n = 0.",
  steps_to_backtrack: 2,
  new_directive: "Abandon the current induction approach. Instead, prove the base case (n=0) first as a separate Z3 check, then attempt the inductive step with the base case as a hypothesis.",
};

const VALID_JSON_STRING = JSON.stringify(VALID_ARCHITECT_RESPONSE);

const MARKDOWN_WRAPPED = "```json\n" + VALID_JSON_STRING + "\n```";

const MISSING_FIELD_JSON = JSON.stringify({
  analysis: "The tactic is wrong.",
  // missing steps_to_backtrack and new_directive
});

// ──────────────────────────────────────────────
// Mock Helpers
// ──────────────────────────────────────────────

/**
 * Mock fetch to simulate Gemini REST API responses.
 * Gemini returns: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
 */
function createGeminiMockFetch(...bodies: string[]) {
  let callIndex = 0;

  return mock(async (_url: string | URL | Request, _init?: RequestInit) => {
    const body = bodies[callIndex] ?? bodies[bodies.length - 1]!;
    callIndex++;

    const responseBody = JSON.stringify({
      candidates: [{
        content: {
          parts: [{ text: body }],
        },
      }],
    });

    return new Response(responseBody, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("ArchitectClient — Schema Validation", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("correctly parses valid Gemini JSON response into ArchitectResponseSchema", async () => {
    globalThis.fetch = createGeminiMockFetch(VALID_JSON_STRING) as unknown as typeof fetch;

    const client = new ArchitectClient(TEST_CONFIG);
    const result = await client.escalate("The agent is stuck on step 4...");

    expect(result.analysis).toContain("inductive step");
    expect(result.steps_to_backtrack).toBe(2);
    expect(result.new_directive).toContain("base case");
  });

  test("strips markdown fences from Gemini response before parsing", async () => {
    globalThis.fetch = createGeminiMockFetch(MARKDOWN_WRAPPED) as unknown as typeof fetch;

    const client = new ArchitectClient(TEST_CONFIG);
    const result = await client.escalate("Context here...");

    expect(result.steps_to_backtrack).toBe(2);
    expect(result.new_directive).toContain("base case");
  });

  test("returns fallback directive on missing required fields", async () => {
    globalThis.fetch = createGeminiMockFetch(MISSING_FIELD_JSON) as unknown as typeof fetch;

    const client = new ArchitectClient(TEST_CONFIG);
    const result = await client.escalate("Context here...");

    // Should return a fallback instead of crashing
    expect(result.analysis).toContain("failed");
    expect(result.steps_to_backtrack).toBe(0);
    expect(result.new_directive).toBeTruthy();
  });

  test("zero backtrack steps is valid", async () => {
    const zeroBacktrack = JSON.stringify({
      analysis: "The current state is correct but the tactic is suboptimal.",
      steps_to_backtrack: 0,
      new_directive: "Try using ForAll quantifiers instead of existential encoding.",
    });
    globalThis.fetch = createGeminiMockFetch(zeroBacktrack) as unknown as typeof fetch;

    const client = new ArchitectClient(TEST_CONFIG);
    const result = await client.escalate("Context...");

    expect(result.steps_to_backtrack).toBe(0);
    expect(result.new_directive).toContain("ForAll");
  });

  test("sends the context in the request body", async () => {
    const capturedBodies: string[] = [];

    globalThis.fetch = mock(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.body) {
        capturedBodies.push(
          typeof init.body === "string" ? init.body : await new Response(init.body).text(),
        );
      }
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: VALID_JSON_STRING }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const client = new ArchitectClient(TEST_CONFIG);
    await client.escalate("UNIQUE_CONTEXT_MARKER_12345");

    expect(capturedBodies.length).toBeGreaterThan(0);
    expect(capturedBodies[0]).toContain("UNIQUE_CONTEXT_MARKER_12345");
  });
});
