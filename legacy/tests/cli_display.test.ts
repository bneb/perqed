
import { expect, test, describe } from "bun:test";
import { displayConfig } from "../src/cli/cli_ui";

// We need to mock console.log to verify the output of displayConfig.
describe("displayConfig", () => {
  test("formats the config correctly for CLI output", () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    const mockConfig = {
      run_name: "test_run",
      problem_description: "test problem",
      theorem_name: "test_theorem",
      max_iterations: 10,
      theorem_signature: "import Mathlib",
    } as any;

    displayConfig(mockConfig, "/path/to/config");

    expect(logs).toContain("✅ ARCHITECT produced run configuration:\n");
    expect(logs).toContain("  Run Name:  test_run");
    expect(logs).toContain("  Problem:   test problem");
    expect(logs).toContain("  Theorem:   test_theorem");
    expect(logs).toContain("  Budget:    10 iterations");
    expect(logs).toContain("  Config:    /path/to/config");

    console.log = originalLog;
  });
});
