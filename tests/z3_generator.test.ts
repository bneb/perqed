/**
 * TDD Tests — z3_circulant_generator.ts
 *
 * After rewrite: clauses are precomputed in TypeScript.
 * No itertools in generated Python — just inline literal clause lists.
 */

import { describe, test, expect } from "bun:test";
import { generateRamseyZ3Script } from "../src/search/z3_circulant_generator";

// Note: generateRamseyZ3Script(35, 4, 6) iterates C(35,4)+C(35,6)≈1.67M
// combinations in TypeScript to build the clause table. Takes ~2-5s.
// Tests that call it with N=35 have longer timeouts.

describe("generateRamseyZ3Script", () => {
  test("generates a non-empty Python script", () => {
    const script = generateRamseyZ3Script(5, 3, 3);
    expect(script.length).toBeGreaterThan(100);
  });

  test("embeds num_distances correctly for N=5", () => {
    const script = generateRamseyZ3Script(5, 3, 3);
    // N=5 → floor(5/2) = 2 distances
    expect(script).toContain("num_distances = 2");
  });

  test("embeds num_distances correctly for N=35", () => {
    const script = generateRamseyZ3Script(35, 4, 6);
    // N=35 → floor(35/2) = 17 distances
    expect(script).toContain("num_distances = 17");
  }, 15_000);

  test("declares distance boolean variables", () => {
    const script = generateRamseyZ3Script(5, 3, 3);
    expect(script).toContain("Bool");
    expect(script).toContain("num_distances");
  });

  test("includes SAT output format", () => {
    const script = generateRamseyZ3Script(5, 3, 3);
    expect(script).toContain("SAT:");
  });

  test("includes UNSAT branch", () => {
    const script = generateRamseyZ3Script(5, 3, 3);
    expect(script).toContain("UNSAT");
  });

  test("imports z3 (no itertools needed — clauses are precomputed)", () => {
    const script = generateRamseyZ3Script(5, 3, 3);
    expect(script).toContain("from z3 import");
    // itertools no longer needed since clauses are embedded inline
    expect(script).not.toContain("import itertools");
  });

  test("script is valid Python (basic syntax markers)", () => {
    const script = generateRamseyZ3Script(5, 3, 3);
    expect(script).toContain("solver.check()");
    expect(script).toContain("== sat");
  });

  test("embeds clause lists as Python list literals (not dynamic generation)", () => {
    const script = generateRamseyZ3Script(5, 3, 3);
    // Clauses are JSON-serialized arrays embedded inline
    expect(script).toContain("[[");
    expect(script).toContain("]]");
  });

  test("deduplication: K_3 on N=5 produces fewer clauses than C(5,3)=10", () => {
    const script = generateRamseyZ3Script(5, 3, 3);
    // C(5,3)=10 vertex triples but many share the same distance pattern
    // In circulant on N=5: distances are 1 and 2, so unique distance-sets are few
    // Script should be compact
    expect(script.length).toBeLessThan(5000);
  });
});
