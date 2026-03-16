/**
 * TDD Tests — z3_circulant_generator.ts
 * Written first (red phase). Tests script generation without running Z3.
 */

import { describe, test, expect } from "bun:test";
import { generateRamseyZ3Script } from "../src/search/z3_circulant_generator";

describe("generateRamseyZ3Script", () => {
  test("generates a non-empty Python script", () => {
    const script = generateRamseyZ3Script(5, 3, 3);
    expect(script.length).toBeGreaterThan(100);
  });

  test("embeds N, r, s correctly", () => {
    const script = generateRamseyZ3Script(35, 4, 6);
    expect(script).toContain("N = 35");
    expect(script).toContain("r = 4");
    expect(script).toContain("s = 6");
  });

  test("declares distance boolean variables via f-string template", () => {
    const script = generateRamseyZ3Script(5, 3, 3);
    // Variables are declared via Python f-string: Bool(f'e_{d}')
    // The literal text e_{d} appears in the generated TypeScript string
    expect(script).toContain("e_{d}");
    expect(script).toContain("Bool");
  });

  test("includes SAT output with bit string format", () => {
    const script = generateRamseyZ3Script(5, 3, 3);
    expect(script).toContain("SAT:");
  });

  test("includes UNSAT branch", () => {
    const script = generateRamseyZ3Script(5, 3, 3);
    expect(script).toContain("UNSAT");
  });

  test("imports z3 and itertools", () => {
    const script = generateRamseyZ3Script(35, 4, 6);
    expect(script).toContain("from z3 import");
    expect(script).toContain("import itertools");
  });

  test("includes circ_dist function", () => {
    const script = generateRamseyZ3Script(35, 4, 6);
    expect(script).toContain("circ_dist");
  });

  test("number of distance variables is controlled by floor(N/2) via num_distances", () => {
    // For N=35: num_distances = 17 (via N // 2)
    const script35 = generateRamseyZ3Script(35, 4, 6);
    expect(script35).toContain("N // 2");
    expect(script35).toContain("num_distances");
    // The loop goes to num_distances + 1 to generate e_1 through e_num_distances
    expect(script35).toContain("range(1, num_distances + 1)");
    // N=35 is embedded so we know runtime will produce 17 distances
    expect(script35).toContain("N = 35");
    // N=5 gives 2 distances
    const script5 = generateRamseyZ3Script(5, 3, 3);
    expect(script5).toContain("N = 5");
  });

  test("script is valid Python (basic syntax markers)", () => {
    const script = generateRamseyZ3Script(5, 3, 3);
    // Must have solver.check() and model extraction
    expect(script).toContain("solver.check()");
    expect(script).toContain("== sat");
  });
});
