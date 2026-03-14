import { expect, test, describe } from "bun:test";
import { SolverBridge } from "../src/solver";

// ──────────────────────────────────────────────
// Z3 Python Subprocess Execution
// ──────────────────────────────────────────────

describe("SolverBridge — Z3", () => {
  test("valid proof (unsat) returns success: true", async () => {
    const code = `
from z3 import *
x = Int('x')
s = Solver()
# Prove x + 1 > x by checking unsatisfiability of its negation
s.add(Not(x + 1 > x))
print(s.check())
`;
    const bridge = new SolverBridge();
    const { success, output } = await bridge.runZ3(code);
    expect(success).toBe(true);
    expect(output).toContain("unsat");
  });

  test("satisfiable result (counterexample exists) returns success: false", async () => {
    const code = `
from z3 import *
x = Int('x')
s = Solver()
s.add(x > 5)
print(s.check())
`;
    const bridge = new SolverBridge();
    const { success, output } = await bridge.runZ3(code);
    expect(success).toBe(false);
    expect(output).toContain("sat");
  });

  test("syntax error returns success: false with error message", async () => {
    const code = "this is not valid python at all !!!";
    const bridge = new SolverBridge();
    const { success, output } = await bridge.runZ3(code);
    expect(success).toBe(false);
    expect(output.toLowerCase()).toMatch(/error/);
  });

  test("infinite loop is killed by timeout", async () => {
    const code = "while True: pass";
    const bridge = new SolverBridge();
    const { success, output } = await bridge.runZ3(code, 2000);
    expect(success).toBe(false);
    expect(output.toLowerCase()).toMatch(/timed?\s*out/);
  });

  test("each run is isolated — no cross-contamination", async () => {
    const codeA = `
from z3 import *
x = Int('x')
s = Solver()
s.add(Not(x + 1 > x))
print(s.check())
`;
    const codeB = "print('hello from run B')";

    const bridge = new SolverBridge();
    const resultA = await bridge.runZ3(codeA);
    const resultB = await bridge.runZ3(codeB);

    expect(resultA.success).toBe(true);
    // codeB doesn't produce 'unsat', so should be false
    expect(resultB.success).toBe(false);
    expect(resultB.output).toContain("hello from run B");
  });
});
