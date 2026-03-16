/**
 * Proof Registry Tests — TDD Red-to-Green
 *
 * Tests:
 *   1. Registry lookup
 *   2. RamseyProofGenerator: Lean source + LaTeX proof
 *   3. Unknown types
 */

import { describe, test, expect } from "bun:test";
import {
  ProofRegistry,
  RamseyProofGenerator,
} from "../src/search/proof_registry";
import { paleyGraph } from "../src/math/graph/GraphSeeds";

// ──────────────────────────────────────────────
// Registry
// ──────────────────────────────────────────────

describe("ProofRegistry", () => {

  test("getGenerator returns registered generator", () => {
    const registry = new ProofRegistry();
    registry.register(new RamseyProofGenerator());
    expect(registry.getGenerator("ramsey")).not.toBeNull();
  });

  test("getGenerator returns null for unknown type", () => {
    const registry = new ProofRegistry();
    expect(registry.getGenerator("unknown")).toBeNull();
  });

  test("default registry includes RamseyProofGenerator", () => {
    const registry = ProofRegistry.withDefaults();
    expect(registry.getGenerator("ramsey")).not.toBeNull();
    expect(registry.getGenerator("srg")).toBeNull();
  });
});

// ──────────────────────────────────────────────
// RamseyProofGenerator — Lean
// ──────────────────────────────────────────────

describe("RamseyProofGenerator — Lean", () => {
  const gen = new RamseyProofGenerator();

  test("canHandle('ramsey') is true", () => {
    expect(gen.canHandle("ramsey")).toBe(true);
  });

  test("canHandle('srg') is false", () => {
    expect(gen.canHandle("srg")).toBe(false);
  });

  test("generateLean produces source with theorem name", () => {
    const witness = paleyGraph(5);
    const source = gen.generateLean({
      theoremName: "test_theorem",
      witness,
      params: { r: 3, s: 3, n: 5 },
    });

    expect(source).toContain("theorem test_theorem");
    expect(source).toContain("native_decide");
    expect(source).toContain("Fin 5");
  });

  test("Paley(17) generates R(4,4) proof source", () => {
    const witness = paleyGraph(17);
    const source = gen.generateLean({
      theoremName: "ramsey_R4_4",
      witness,
      params: { r: 4, s: 4, n: 17 },
    });

    expect(source).toContain("theorem ramsey_R4_4");
    expect(source).toContain("Fin 17");
    expect(source.length).toBeGreaterThan(500);
  });
});

// ──────────────────────────────────────────────
// RamseyProofGenerator — LaTeX
// ──────────────────────────────────────────────

describe("RamseyProofGenerator — LaTeX", () => {
  const gen = new RamseyProofGenerator();

  test("generateLatex produces valid LaTeX with documentclass", () => {
    const witness = paleyGraph(5);
    const latex = gen.generateLatex({
      theoremName: "ramsey_R3_3_lower_bound",
      witness,
      params: { r: 3, s: 3, n: 5 },
      problemDescription: "R(3,3) >= 6",
      wallTimeSeconds: 2.9,
      iterations: 36,
      ips: 12,
    });

    expect(latex).toContain("\\documentclass");
    expect(latex).toContain("\\begin{document}");
    expect(latex).toContain("\\end{document}");
  });

  test("LaTeX includes theorem statement", () => {
    const witness = paleyGraph(5);
    const latex = gen.generateLatex({
      theoremName: "ramsey_test",
      witness,
      params: { r: 3, s: 3, n: 5 },
      problemDescription: "R(3,3) >= 6",
      wallTimeSeconds: 1.0,
      iterations: 100,
      ips: 100,
    });

    expect(latex).toContain("R(3,3)");
    expect(latex).toContain("\\begin{theorem}");
  });

  test("LaTeX includes adjacency matrix", () => {
    const witness = paleyGraph(5);
    const latex = gen.generateLatex({
      theoremName: "ramsey_test",
      witness,
      params: { r: 3, s: 3, n: 5 },
      problemDescription: "R(3,3) >= 6",
      wallTimeSeconds: 1.0,
      iterations: 100,
      ips: 100,
    });

    // Should contain the adjacency data
    expect(latex).toContain("adjacency");
  });

  test("LaTeX includes verification metadata", () => {
    const witness = paleyGraph(5);
    const latex = gen.generateLatex({
      theoremName: "ramsey_test",
      witness,
      params: { r: 3, s: 3, n: 5 },
      problemDescription: "R(3,3) >= 6",
      wallTimeSeconds: 2.9,
      iterations: 36,
      ips: 12,
    });

    expect(latex).toContain("2.9");
    expect(latex).toContain("Lean 4");
  });
});
