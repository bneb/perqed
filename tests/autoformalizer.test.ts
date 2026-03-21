import { expect, test, describe, mock } from "bun:test";
import { AutoformalizerAgent } from "../src/agents/autoformalizer";
import { LeanBridge } from "../src/lean_bridge";

describe("AutoformalizerAgent — Compiler-in-the-Loop", () => {
  test("Iteratively repairs type mismatch errors", async () => {
    // 1. Mock LeanBridge to fail on the first call, succeed on the second
    const mockLeanBridge = new LeanBridge();
    let leanCallCount = 0;
    mockLeanBridge.executeLean = mock(async (source: string) => {
      leanCallCount++;
      if (leanCallCount === 1) {
        return {
          success: false,
          isComplete: false,
          hasSorry: false,
          error: "10:4: error: type mismatch\\n  x\\nhas type\\n  Nat\\nbut is expected to have type\\n  Fin N",
          rawOutput: "error...",
        };
      } else {
        return {
          success: false,
          isComplete: false,
          hasSorry: true,
          error: undefined,
          rawOutput: "warning: declaration uses 'sorry'",
        };
      }
    });

    // 2. Mock Fetch (Gemini)
    let fetchCallCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (url: any, init?: any) => {
      fetchCallCount++;
      
      let responseText = "";
      if (fetchCallCount === 1) {
         responseText = "```lean\\n: ∃ (f : Fin N → Fin 6), f x = 0 := by sorry\\n```";
      } else {
         // The LLM has received the error and fixes it
         const body = JSON.parse(init.body as string);
         expect(body.contents.some((c: any) => JSON.stringify(c).includes("type mismatch"))).toBe(true);
         responseText = "```lean\\n: ∃ (f : Fin N → Fin 6), f x.val = 0 := by sorry\\n```";
      }

      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: responseText }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as any;

    try {
      const agent = new AutoformalizerAgent({
        leanBridge: mockLeanBridge,
        apiKey: "test",
      });

      let errCaught: any;
      let result = "";
      try {
        result = await agent.formalize("We want a valid 6 coloring");
      } catch (e) {
        errCaught = e;
        console.error(e);
      }

      expect(errCaught).toBeUndefined();
      expect(leanCallCount).toBe(2);
      expect(fetchCallCount).toBe(2);
      expect(result).toContain("f x.val = 0");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
