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

  test("compileEdgeRule auto-sanitizes standard function closures", () => {
    const rawFunction = "function (u, v, N) { return (u+v)%2===0; }";
    const adj = AlgebraicBuilder.compile({
      vertices: 10,
      description: "testing closures",
      edge_rule_js: rawFunction
    });
    // u/v mapped to i/j. i=1, j=3 => 4%2=0 (true). i=1, j=4 => 5%2!=0 (false).
    expect(adj.hasEdge(1, 3)).toBe(true);
    expect(adj.hasEdge(1, 4)).toBe(false);
  });

  test("compileEdgeRule auto-sanitizes arrow functions closures", () => {
    const rawArrow = "(i, j) => { return (i*j)%3===0; }";
    const adj = AlgebraicBuilder.compile({
      vertices: 10,
      description: "testing arrows",
      edge_rule_js: rawArrow
    });
    // 1*3=3%3=0 (true). 2*4=8%3!=0 (false).
    expect(adj.hasEdge(1, 3)).toBe(true);
    expect(adj.hasEdge(2, 4)).toBe(false);
  });
});
