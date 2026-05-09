import { expect, test, describe } from "bun:test";
import { runZ3Repair } from "../src/search/z3_partition_repair";
import { SolverBridge } from "../src/solver";

describe("z3_partition_repair safety cutoffs", () => {
  test("skips repair when domainSize > 800", async () => {
    const partition = new Int8Array(1000).fill(-1);
    const mockSolver = new SolverBridge(); // We won't actually call it
    const mockDetector = () => [[1, 2, 3]]; // Return a fake violation to bypass the E=0 check

    const result = await runZ3Repair(partition, 1000, 2, mockSolver, mockDetector);
    expect(result.solved).toBe(false);
    expect(result.z3Output).toContain("Domain too large");
  });

  test("skips repair when conflict limit exceeded", async () => {
    const partition = new Int8Array(100).fill(-1);
    const mockSolver = new SolverBridge(); // We won't actually call it
    // Create > 250k fake conflicts
    const mockDetector = () => Array(250_001).fill([1, 2, 3]);

    const result = await runZ3Repair(partition, 100, 2, mockSolver, mockDetector);
    expect(result.solved).toBe(false);
    expect(result.z3Output).toContain("Too many constraints");
  });
});
