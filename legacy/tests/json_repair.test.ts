import { describe, it, expect } from "bun:test";
import { repairJSON } from "../src/util/json_repair";

describe("repairJSON", () => {
  it("parses valid JSON as-is", () => {
    const obj = { action: "DIRECTIVE", reasoning: "use omega" };
    expect(repairJSON(JSON.stringify(obj))).toEqual(obj);
  });

  it("repairs a truncated string value", () => {
    const truncated = '{"action": "DIRECTIVE", "reasoning": "The proof requires an existential';
    const result = repairJSON(truncated);
    expect(result).not.toBeNull();
    expect(result.action).toBe("DIRECTIVE");
    expect(typeof result.reasoning).toBe("string");
  });

  it("repairs missing closing brace", () => {
    const truncated = '{"action": "BACKTRACK", "reasoning": "dead end"';
    const result = repairJSON(truncated);
    expect(result).not.toBeNull();
    expect(result.action).toBe("BACKTRACK");
    expect(result.reasoning).toBe("dead end");
  });

  it("repairs nested object truncation", () => {
    const truncated = '{"action": "DIRECTIVE", "tactics": {"step": "omega", "conf';
    const result = repairJSON(truncated);
    expect(result).not.toBeNull();
    expect(result.action).toBe("DIRECTIVE");
  });

  it("handles escaped quotes inside string", () => {
    const valid = '{"reasoning": "use \\"omega\\" tactic"}';
    expect(repairJSON(valid)).toEqual({ reasoning: 'use "omega" tactic' });
  });

  it("falls back to regex extraction for heavily malformed JSON", () => {
    const garbage = 'blah blah "action": "DIRECTIVE" blah "reasoning": "try omega"';
    const result = repairJSON(garbage);
    expect(result).not.toBeNull();
    expect(result?.action).toBe("DIRECTIVE");
    expect(result?.reasoning).toBe("try omega");
  });

  it("returns null for completely unparseable input", () => {
    expect(repairJSON("not json at all, no fields")).toBeNull();
  });

  it("repairs trailing comma before close", () => {
    const truncated = '{"action": "DIRECTIVE", "reasoning": "complete",}';
    const result = repairJSON(truncated);
    expect(result?.action).toBe("DIRECTIVE");
  });
});
