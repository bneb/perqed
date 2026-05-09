import { describe, test, expect } from "bun:test";
import { generateRamseyZ3Script } from "../src/search/z3_circulant_generator";

describe("generateRamseyZ3Script", () => {
  test("generates basic circulant constraints by default", () => {
    const script = generateRamseyZ3Script(35, 4, 6);
    expect(script).toContain("num_distances = 17");
    expect(script).not.toContain("block-circulant");
  });

  test("generates block-circulant constraints when requested", () => {
    const script = generateRamseyZ3Script(35, 4, 6, "block-circulant");
    expect(script).toContain("num_distances = 17");
    expect(script).toContain("Block-circulant symmetry constraints");
    expect(script).toContain("solver.add(e[d - 1] == e[d])");
  });
});