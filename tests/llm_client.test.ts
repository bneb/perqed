/**
 * Tests for LocalAgent — LLM client with Zod validation and auto-correction.
 *
 * All tests mock `fetch` to simulate LLM responses without requiring
 * a live Ollama/vLLM server. This enables deterministic CI/CD testing.
 */

import { expect, test, describe, beforeEach, afterEach, mock } from "bun:test";
import { LocalAgent, type LocalAgentConfig } from "../src/llm_client";
import { AgentResponseSchema } from "../src/schemas";

// ──────────────────────────────────────────────
// Test Fixtures
// ──────────────────────────────────────────────

const TEST_CONFIG: LocalAgentConfig = {
  endpoint: "http://localhost:11434/api/chat",
  model: "qwen2.5-coder",
  temperature: 0.2,
};

/** A perfectly valid agent response. */
const VALID_RESPONSE = {
  thoughts: "By contradiction, assume x + 1 <= x, which implies 1 <= 0, a contradiction.",
  action: "PROPOSE_TACTICS" as const,
  tactics: [{
    informal_sketch: "Direct proof by contradiction via Z3 negation.",
    confidence_score: 0.95,
    code: "from z3 import *\nx = Int('x')\ns = Solver()\ns.add(Not(x + 1 > x))\nprint(s.check())",
  }],
};

/** Valid JSON string. */
const VALID_JSON_STRING = JSON.stringify(VALID_RESPONSE);

/** Valid JSON wrapped in markdown fences — a common LLM hallucination. */
const MARKDOWN_WRAPPED_JSON = "```json\n" + VALID_JSON_STRING + "\n```";

/** Also common: triple backticks without the language tag. */
const MARKDOWN_WRAPPED_BARE = "```\n" + VALID_JSON_STRING + "\n```";

/** Structurally valid JSON but missing the required `action` field. */
const MISSING_ACTION_JSON = JSON.stringify({
  thoughts: "I think we should try induction.",
  code: "from z3 import *",
  // action is missing — Zod must reject this
});

/** Completely malformed non-JSON garbage. */
const GARBAGE_OUTPUT = "Sure! Here's how I'd approach this problem. First, let me think...";

// ──────────────────────────────────────────────
// Mock Helpers
// ──────────────────────────────────────────────

/**
 * Create a mock fetch that returns the given body strings in sequence.
 * Each call consumes the next body in the queue.
 */
function createMockFetch(...bodies: string[]) {
  let callIndex = 0;

  return mock(async (_url: string | URL | Request, _init?: RequestInit) => {
    const body = bodies[callIndex] ?? bodies[bodies.length - 1]!;
    callIndex++;

    // Ollama /api/chat format: { message: { content: "..." } }
    const responseBody = JSON.stringify({
      message: { role: "assistant", content: body },
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

describe("LocalAgent — Zod Validation", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("parses valid JSON into the Zod schema correctly", async () => {
    globalThis.fetch = createMockFetch(VALID_JSON_STRING) as typeof fetch;

    const agent = new LocalAgent(TEST_CONFIG);
    const result = await agent.generateMove("Prove x + 1 > x");

    expect(result.thoughts).toContain("contradiction");
    expect(result.action).toBe("PROPOSE_TACTICS");
    expect(result.tactics).toBeDefined();
  });

  test("strips markdown ```json fences before parsing", async () => {
    globalThis.fetch = createMockFetch(MARKDOWN_WRAPPED_JSON) as typeof fetch;

    const agent = new LocalAgent(TEST_CONFIG);
    const result = await agent.generateMove("Prove x + 1 > x");

    expect(result.action).toBe("PROPOSE_TACTICS");
    expect(result.tactics).toBeDefined();
  });

  test("strips bare markdown ``` fences before parsing", async () => {
    globalThis.fetch = createMockFetch(MARKDOWN_WRAPPED_BARE) as typeof fetch;

    const agent = new LocalAgent(TEST_CONFIG);
    const result = await agent.generateMove("Prove x + 1 > x");

    expect(result.action).toBe("PROPOSE_TACTICS");
  });

  test("throws ZodError when required field is missing", async () => {
    globalThis.fetch = createMockFetch(MISSING_ACTION_JSON) as typeof fetch;

    const agent = new LocalAgent(TEST_CONFIG);

    await expect(agent.generateMove("Prove something")).rejects.toThrow();
  });
});

describe("LocalAgent — Auto-Correction Loop", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("retries on malformed output and succeeds on second attempt", async () => {
    // First call: garbage. Second call: valid.
    globalThis.fetch = createMockFetch(GARBAGE_OUTPUT, VALID_JSON_STRING) as typeof fetch;

    const agent = new LocalAgent(TEST_CONFIG);
    const result = await agent.generateMoveWithRetry("Prove x + 1 > x", 3);

    expect(result.action).toBe("PROPOSE_TACTICS");
    expect(result.thoughts).toContain("contradiction");

    // Verify the fetch was called twice (original + 1 retry)
    expect((globalThis.fetch as ReturnType<typeof mock>).mock.calls.length).toBe(2);
  });

  test("retries on Zod validation failure and succeeds on second attempt", async () => {
    // First call: valid JSON but missing action. Second call: perfect.
    globalThis.fetch = createMockFetch(MISSING_ACTION_JSON, VALID_JSON_STRING) as typeof fetch;

    const agent = new LocalAgent(TEST_CONFIG);
    const result = await agent.generateMoveWithRetry("Prove x + 1 > x", 3);

    expect(result.action).toBe("PROPOSE_TACTICS");
    expect((globalThis.fetch as ReturnType<typeof mock>).mock.calls.length).toBe(2);
  });

  test("throws after maxRetries is exhausted", async () => {
    // All calls return garbage — should fail after 3 retries
    globalThis.fetch = createMockFetch(
      GARBAGE_OUTPUT,
      GARBAGE_OUTPUT,
      GARBAGE_OUTPUT,
      GARBAGE_OUTPUT,
    ) as typeof fetch;

    const agent = new LocalAgent(TEST_CONFIG);

    await expect(
      agent.generateMoveWithRetry("Prove x + 1 > x", 3),
    ).rejects.toThrow(/after 3 retries/i);

    // 1 initial + 3 retries = 4 total calls
    expect((globalThis.fetch as ReturnType<typeof mock>).mock.calls.length).toBe(4);
  });

  test("correction prompt includes the previous error message", async () => {
    const calls: string[] = [];

    // Intercept the body of each fetch call to verify error feedback is included
    let callIndex = 0;
    const bodies = [GARBAGE_OUTPUT, VALID_JSON_STRING];
    globalThis.fetch = mock(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.body) {
        calls.push(typeof init.body === "string" ? init.body : await new Response(init.body).text());
      }
      const body = bodies[callIndex] ?? bodies[bodies.length - 1]!;
      callIndex++;
      return new Response(
        JSON.stringify({ message: { role: "assistant", content: body } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const agent = new LocalAgent(TEST_CONFIG);
    await agent.generateMoveWithRetry("Prove x + 1 > x", 3);

    // The second call should contain error feedback from the first failure
    expect(calls.length).toBe(2);
    const secondPayload = calls[1]!;
    expect(secondPayload.toLowerCase()).toMatch(/error|failed|invalid|correct/);
  });
});
