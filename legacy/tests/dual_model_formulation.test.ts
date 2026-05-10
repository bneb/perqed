/**
 * dual_model_formulation.test.ts — P2 RED tests
 *
 * Validates the two-call pipeline for formulateAlgebraicRule:
 *   Call 1 (ARCHITECT): returns a pure math spec string
 *   Call 2 (CompilerAgent): translates spec to edge_rule_js body
 *
 * All network calls are mocked — tests are hermetic.
 */
import { describe, expect, it } from "bun:test";
import { CompilerAgent } from "../src/agents/compiler";

// ── P2a: CompilerAgent targetLanguage="javascript" ───────────────────────────

describe("CompilerAgent — targetLanguage javascript", () => {
  it("accepts targetLanguage: 'javascript' in CompilationRequest", async () => {
    const agent = new CompilerAgent({ apiKey: "test" }); // apiKey=test → fallback path
    const result = await agent.generateEvaluator({
      constraint: "Paley graph over GF(37)",
      n: 37,
      r: 4,
      s: 6,
      targetLanguage: "javascript",
    });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns a JS function body (not a C++ source file) for targetLanguage=javascript", async () => {
    const agent = new CompilerAgent({ apiKey: "test" });
    const result = await agent.generateEvaluator({
      constraint: "Cayley graph over Z_35 with connection set {1..9}",
      n: 35,
      r: 4,
      s: 6,
      targetLanguage: "javascript",
    });
    // JS output must NOT contain C++ includes or extern "C"
    expect(result).not.toContain("#include");
    expect(result).not.toContain('extern "C"');
    // Must be a valid JS return statement body
    expect(result).toMatch(/return/);
  });

  it("defaults to 'cpp' when targetLanguage is omitted (backward compat)", async () => {
    const agent = new CompilerAgent({ apiKey: "test" });
    const result = await agent.generateEvaluator({
      constraint: "R(4,6) Ramsey energy",
      n: 35,
      r: 4,
      s: 6,
      // targetLanguage intentionally omitted
    });
    // C++ fallback stub contains extern "C"
    expect(result).toContain("extern");
  });
});

// ── P2b: Two-call pipeline simulation ────────────────────────────────────────

describe("dual-model pipeline (ARCHITECT spec → CompilerAgent JS)", () => {
  /**
   * Simulates the two-call pipeline that formulateAlgebraicRule will implement:
   *   1. ARCHITECT returns a math spec string
   *   2. CompilerAgent.generateEvaluator({targetLanguage: "javascript", ...}) returns JS body
   *   3. The JS body is merged into the AlgebraicConstructionConfig as edge_rule_js
   */
  async function simulatePipeline(
    mathSpec: string,
    mockJsBody: string,
    r: number,
    s: number,
    n: number
  ): Promise<{ vertices: number; r: number; s: number; edge_rule_js: string }> {
    // Call 2: CompilerAgent compile step.
    // Use "mock-key" (not "test") so the apiKey guard passes and our
    // mocked _callGemini actually executes instead of short-circuiting to _fallback.
    const agent = new CompilerAgent({ apiKey: "mock-key" });
    (agent as any)._callGemini = async () => mockJsBody;

    const jsBody = await agent.generateEvaluator({
      constraint: mathSpec,
      n,
      r,
      s,
      targetLanguage: "javascript",
    });

    return { vertices: n, r, s, edge_rule_js: jsBody };
  }

  it("produces an AlgebraicConstructionConfig with edge_rule_js from CompilerAgent", async () => {
    const mathSpec = "Construct a Paley graph over GF(37): edge (i,j) iff (i-j) is a quadratic residue mod 37";
    const expectedJs = "const d = ((i - j) % 37 + 37) % 37; return [1,6,8,10].includes(d);";

    const config = await simulatePipeline(mathSpec, expectedJs, 4, 6, 37);

    expect(config.vertices).toBe(37);
    expect(config.r).toBe(4);
    expect(config.s).toBe(6);
    expect(config.edge_rule_js).toBe(expectedJs);
  });

  it("edge_rule_js comes from CompilerAgent, not from ARCHITECT JSON output", async () => {
    // The ARCHITECT should output only math prose — never raw JS
    const mathSpec = "Use cyclotomic cosets of order 5 modulo 71";
    const compilerOutput = "return (i * j) % 71 < 20;";

    const config = await simulatePipeline(mathSpec, compilerOutput, 4, 6, 71);

    // The JS must come from the compiler, not from parsing the math spec
    expect(config.edge_rule_js).toBe(compilerOutput);
    expect(config.edge_rule_js).not.toBe(mathSpec);
  });

  it("pipeline works even when CompilerAgent falls back to stub (no valid Gemini key)", async () => {
    // When apiKey="test", CompilerAgent returns STUB_CPP_RAMSEY for cpp
    // For javascript targetLanguage with test key, we expect a fallback JS string
    const agent = new CompilerAgent({ apiKey: "test" });
    const result = await agent.generateEvaluator({
      constraint: "any math spec",
      n: 35,
      r: 4,
      s: 6,
      targetLanguage: "javascript",
    });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
