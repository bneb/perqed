import { expect, test, describe } from "bun:test";
import { AlgebraicBuilder } from "../src/search/algebraic_builder";
import { calculate_degrees_of_freedom } from "../src/skills/investigation_skills";

describe("Dynamic Compilation Fallback", () => {
  test("new Function correctly interprets implicit returns without panicking", () => {
    // This exact string caused Bun's `node:vm` to panic(main thread): unreachable
    const crashingImplicitRule = "((i * i + j * j - 1) % 35 == 0)";
    
    // Test the compiled graph construction
    const adj = AlgebraicBuilder.compile({
      vertices: 35,
      description: "testing",
      edge_rule_js: crashingImplicitRule
    });
    
    // Simply asserting that it evaluates i and j correctly without crashing
    // For i=1, j=1, (1 + 1 - 1) % 35 = 1 != 0 (false)
    // For i=1, j=6, (1 + 36 - 1) % 35 = 36 % 35 = 1 (false)
    // For i=5, j=3, (25 + 9 - 1) % 35 = 33 % 35 = 33 (false)
    expect(adj.hasEdge(1, 1)).toBe(false);
  });

  test("calculate_degrees_of_freedom compiles implicit rules", () => {
    const crashingImplicitRule = "((i * i + j * j - 1) % 35 == 0)";
    const result = calculate_degrees_of_freedom(crashingImplicitRule, 35);
    expect(result).toContain("independent variables");
    expect(result).not.toContain("SandboxError");
  });
});
