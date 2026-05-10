import { expect, test, describe } from "bun:test";
import { parseLLMResponse } from "../src/utils/perqed_parser";

describe("PerqedParser (TypeScript Integration)", () => {
  test("extracts standard JSON with conversational filler", () => {
    const raw = `
      Sure, I can help with that! Here is the JSON:
      {
        "action": "DIRECTIVE",
        "target": "node_1"
      }
      Hope this works!
    `;
    const result = parseLLMResponse(raw);
    expect(result.json).toEqual({ action: "DIRECTIVE", target: "node_1" });
    expect(result.think).toBeUndefined();
    expect(result.codeBlocks).toEqual([]);
  });

  test("extracts <think> blocks and code blocks", () => {
    const raw = `
      <think>
      I need to use induction here.
      </think>
      { "action": "PROPOSE_SUBGOAL" }
      \`\`\`lean
      lemma base_case : 0 = 0 := by rfl
      \`\`\`
    `;
    const result = parseLLMResponse(raw);
    expect(result.think?.trim()).toBe("I need to use induction here.");
    expect(result.json).toEqual({ action: "PROPOSE_SUBGOAL" });
    expect(result.codeBlocks).toHaveLength(1);
    expect(result.codeBlocks[0].lang).toBe("lean");
    expect(result.codeBlocks[0].code.trim()).toBe("lemma base_case : 0 = 0 := by rfl");
  });

  test("repairs JSON with trailing commas", () => {
    const raw = `
      {
        "key1": "value1",
        "key2": "value2",
      }
    `;
    const result = parseLLMResponse(raw);
    expect(result.json).toEqual({ key1: "value1", key2: "value2" });
  });

  test("repairs JSON missing closing braces (token limit truncation)", () => {
    const raw = `{"action": "DIRECTIVE", "reasoning": "We should split`;
    const result = parseLLMResponse(raw);
    expect(result.json).toEqual({ action: "DIRECTIVE", reasoning: "We should split" });
  });
  
  test("repairs unescaped quotes inside strings", () => {
    const raw = `{ "code": "theorem foo (x: "type")" }`;
    const result = parseLLMResponse(raw);
    // Standard JSON.parse throws here. Our parser should figure out the inner quotes.
    expect(result.json).toEqual({ code: 'theorem foo (x: "type")' });
  });

  test("adversarial: does not strip trailing commas inside string literals", () => {
    const raw = `{ "text": "Hello, }", "array": [1, 2, ] }`;
    const result = parseLLMResponse(raw);
    expect(result.json).toEqual({ text: "Hello, }", array: [1, 2] });
  });
});
