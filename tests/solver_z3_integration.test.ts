import { expect, test, describe } from "bun:test";
import { SolverBridge } from "../src/solver";

describe("SolverBridge — Native Z3 Integration", () => {
  const solver = new SolverBridge();

  test("runZ3 successfully executes a basic Z3 script", async () => {
    const script = `
from z3 import *
x = Int('x')
y = Int('y')
solve(x > 2, y < 10, x + 2*y == 7)
`;
    const result = await solver.runZ3(script, 10_000);
    // The script prints the model, which means exit code 0.
    // Our runZ3 currently sets success = true ONLY if output includes "unsat".
    // Wait, let's check what runZ3 returns for SAT.
    // In src/solver.ts:
    // const isProven = response.stdout.includes("unsat");
    // return { success: isProven, output: response.stdout };
    // So for SAT, it returns success: false, but the output contains the model.
    expect(result.output).toContain("[y = 0, x = 7]");
    // We should probably just check that it didn't error out with a Python traceback
    expect(result.output).not.toContain("Traceback");
    expect(result.output).not.toContain("ModuleNotFoundError");
  });

  test("runZ3 correctly identifies UNSAT", async () => {
    const script = `
from z3 import *
x = Int('x')
s = Solver()
s.add(x > 5, x < 2)
if s.check() == unsat:
    print("unsat")
`;
    const result = await solver.runZ3(script, 10_000);
    expect(result.success).toBe(true);
    expect(result.output).toContain("unsat");
  });

  test("runZ3 handles python execution errors gracefully", async () => {
    const script = `
import sys
sys.exit(1)
`;
    const result = await solver.runZ3(script, 5_000);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Python exited with non-zero code.");
  });

  test("runZ3 enforces timeouts", async () => {
    const script = `
import time
time.sleep(3)
print("done")
`;
    // Set timeout to 100ms, script sleeps for 3s
    const result = await solver.runZ3(script, 100);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Execution timed out");
  });
});
