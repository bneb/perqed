/**
 * Sprint 7: FormalistAgent — Integration Tests
 *
 * Tests the Ollama-facing FormalistAgent class:
 *   1. <think> tag stripping from DeepSeek-R1 output
 *   2. Markdown fence stripping
 *   3. JSON extraction and FormalistResponseSchema validation
 *   4. Auto-correction loop (error feedback to LLM)
 *   5. Thinking content capture for lab_log telemetry
 */

import { expect, test, describe, mock, afterEach } from "bun:test";
import { FormalistAgent } from "../src/agents/formalist";
import { FormalistResponseSchema } from "../src/schemas";

// ──────────────────────────────────────────────
// Helpers: Mock Ollama Responses
// ──────────────────────────────────────────────

function mockOllamaResponse(content: string) {
  return {
    message: { role: "assistant", content },
  };
}

/** Simulates DeepSeek-R1 output: <think> block + JSON */
const R1_CLEAN_OUTPUT = `<think>
The goal is n + m = m + n. This is basic commutativity of natural numbers.
In Lean 4, the omega tactic handles linear arithmetic over Nat.
I should try omega first with high confidence.
</think>

{
  "thoughts": "Natural number addition commutativity — omega handles this directly.",
  "action": "PROPOSE_LEAN_TACTICS",
  "lean_tactics": [
    {
      "tactic": "omega",
      "informal_sketch": "omega solves linear arithmetic goals including commutativity",
      "confidence_score": 0.95
    }
  ]
}`;

/** R1 output with markdown fences around JSON */
const R1_FENCED_OUTPUT = `<think>
Let me analyze the tactic state. We need to prove n + 0 = n.
This is Nat.add_zero, which simp knows about.
</think>

\`\`\`json
{
  "thoughts": "n + 0 = n is handled by simp with Nat.add_zero",
  "action": "PROPOSE_LEAN_TACTICS",
  "lean_tactics": [
    {
      "tactic": "simp",
      "informal_sketch": "simp closes n + 0 = n via Nat.add_zero",
      "confidence_score": 0.9
    }
  ]
}
\`\`\``;

/** R1 output with nested <think> (edge case) */
const R1_NESTED_THINK = `<think>
Hmm, let me think about this...
I wonder if <think> tags can appear inside the reasoning?
Probably not, but let's handle it.
</think>

{
  "thoughts": "Testing nested think tags",
  "action": "GIVE_UP"
}`;

/** R1 output with no <think> block (pure JSON) */
const R1_NO_THINK = `{
  "thoughts": "Direct JSON without thinking phase",
  "action": "PROPOSE_LEAN_TACTICS",
  "lean_tactics": [
    {
      "tactic": "ring",
      "informal_sketch": "Try ring tactic",
      "confidence_score": 0.7
    }
  ]
}`;

/** R1 output that is totally broken (for retry testing) */
const R1_GARBAGE = `<think>I'm confused</think>
This is not valid JSON at all, just prose about math.`;

// ──────────────────────────────────────────────
// 1. THINK TAG STRIPPING
// ──────────────────────────────────────────────

describe("FormalistAgent — Think Tag Parsing", () => {
  test("strips <think>...</think> and extracts valid JSON", async () => {
    const agent = new FormalistAgent();

    // Mock fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((async () => ({
      ok: true,
      json: async () => mockOllamaResponse(R1_CLEAN_OUTPUT),
    })) as unknown as typeof fetch) as unknown as typeof fetch;

    try {
      const result = await agent.generateMove("test context");
      expect(result.action).toBe("PROPOSE_LEAN_TACTICS");
      expect(result.lean_tactics![0]!.tactic).toBe("omega");
      expect(result.lean_tactics![0]!.confidence_score).toBe(0.95);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("strips markdown fences after think tags", async () => {
    const agent = new FormalistAgent();

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((async () => ({
      ok: true,
      json: async () => mockOllamaResponse(R1_FENCED_OUTPUT),
    })) as unknown as typeof fetch) as unknown as typeof fetch;

    try {
      const result = await agent.generateMove("test context");
      expect(result.action).toBe("PROPOSE_LEAN_TACTICS");
      expect(result.lean_tactics![0]!.tactic).toBe("simp");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("handles output with no <think> block", async () => {
    const agent = new FormalistAgent();

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((async () => ({
      ok: true,
      json: async () => mockOllamaResponse(R1_NO_THINK),
    })) as unknown as typeof fetch) as unknown as typeof fetch;

    try {
      const result = await agent.generateMove("test context");
      expect(result.action).toBe("PROPOSE_LEAN_TACTICS");
      expect(result.lean_tactics![0]!.tactic).toBe("ring");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("handles nested angle brackets inside think block", async () => {
    const agent = new FormalistAgent();

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((async () => ({
      ok: true,
      json: async () => mockOllamaResponse(R1_NESTED_THINK),
    })) as unknown as typeof fetch) as unknown as typeof fetch;

    try {
      const result = await agent.generateMove("test context");
      expect(result.action).toBe("GIVE_UP");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ──────────────────────────────────────────────
// 2. THINKING CONTENT CAPTURE (Telemetry)
// ──────────────────────────────────────────────

describe("FormalistAgent — Telemetry", () => {
  test("extractThinking() captures think block content", () => {
    const agent = new FormalistAgent();
    const thinking = agent.extractThinking(R1_CLEAN_OUTPUT);
    expect(thinking).toContain("omega tactic handles linear arithmetic");
    expect(thinking).not.toContain("<think>");
    expect(thinking).not.toContain("</think>");
  });

  test("extractThinking() returns empty string when no think block", () => {
    const agent = new FormalistAgent();
    const thinking = agent.extractThinking(R1_NO_THINK);
    expect(thinking).toBe("");
  });
});

// ──────────────────────────────────────────────
// 3. BARE TACTIC WRAPPING (Prover-v2 compat)
// ──────────────────────────────────────────────

describe("FormalistAgent — Bare Tactic Wrapping", () => {
  test("auto-wraps bare single tactic into FormalistResponse", async () => {
    const agent = new FormalistAgent();

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((async () => ({
      ok: true,
      json: async () => mockOllamaResponse("omega"),
    })) as unknown as typeof fetch) as unknown as typeof fetch;

    try {
      const result = await agent.generateMove("test context");
      expect(result.action).toBe("PROPOSE_LEAN_TACTICS");
      expect(result.lean_tactics![0]!.tactic).toBe("omega");
      expect(result.lean_tactics![0]!.confidence_score).toBe(0.8);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("auto-wraps multi-line bare tactics", async () => {
    const agent = new FormalistAgent();

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((async () => ({
      ok: true,
      json: async () => mockOllamaResponse("intro n m\nomega"),
    })) as unknown as typeof fetch) as unknown as typeof fetch;

    try {
      const result = await agent.generateMove("test context");
      expect(result.action).toBe("PROPOSE_LEAN_TACTICS");
      expect(result.lean_tactics!.length).toBe(2);
      expect(result.lean_tactics![0]!.tactic).toBe("intro n m");
      expect(result.lean_tactics![1]!.tactic).toBe("omega");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("strips lean fences and auto-wraps bare tactics", async () => {
    const agent = new FormalistAgent();

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((async () => ({
      ok: true,
      json: async () => mockOllamaResponse("```lean\nsimp [Nat.add_comm]\n```"),
    })) as unknown as typeof fetch) as unknown as typeof fetch;

    try {
      const result = await agent.generateMove("test context");
      expect(result.action).toBe("PROPOSE_LEAN_TACTICS");
      expect(result.lean_tactics![0]!.tactic).toBe("simp [Nat.add_comm]");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("Ollama thinking field is used when content is empty", async () => {
    const agent = new FormalistAgent();

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((async () => ({
      ok: true,
      json: async () => ({
        message: {
          role: "assistant",
          content: "",
          thinking: "Model was thinking about commutativity",
        },
      }),
    })) as unknown as typeof fetch) as unknown as typeof fetch;

    try {
      // Content is empty and thinking doesn't contain "action" → should fail
      await expect(agent.generateMove("test context", 1)).rejects.toThrow();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ──────────────────────────────────────────────
// 4. AUTO-CORRECTION RETRY LOOP
// ──────────────────────────────────────────────

describe("FormalistAgent — Retry Loop", () => {
  test("retries on empty content and succeeds if second attempt has valid JSON", async () => {
    const agent = new FormalistAgent();
    let callCount = 0;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({
          message: {
            role: "assistant",
            // First call: empty content (simulates thinking exhaustion)
            // Second call: valid JSON content
            content: callCount === 1 ? "" : R1_NO_THINK,
            thinking: callCount === 1 ? "Thinking too long..." : "",
          },
        }),
      };
    }) as unknown as typeof fetch) as unknown as typeof fetch;

    try {
      const result = await agent.generateMove("test context", 3);
      expect(result.action).toBe("PROPOSE_LEAN_TACTICS");
      expect(callCount).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("throws after exhausting all retries with empty content", async () => {
    const agent = new FormalistAgent();

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((async () => ({
      ok: true,
      json: async () => ({
        message: { role: "assistant", content: "", thinking: "Still thinking..." },
      }),
    })) as unknown as typeof fetch) as unknown as typeof fetch;

    try {
      await expect(agent.generateMove("test context", 2)).rejects.toThrow(/after 2 attempts/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
