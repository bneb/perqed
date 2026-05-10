import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { LakatosianVault } from "../../src/vault/lakatosian_vault";
import { existsSync, unlinkSync, rmSync } from "node:fs";
import { join } from "node:path";

const TEST_WORKSPACE = join(process.cwd(), "test_workspace_vault");

describe("Lakatosian Vault (Persistent Memory)", () => {
  const cleanup = () => {
    const p = LakatosianVault.getGraveyardPath(TEST_WORKSPACE);
    if (existsSync(p)) {
      unlinkSync(p);
    }
  };

  beforeAll(cleanup);
  afterAll(cleanup);

  test("Normalizes identically structured hypotheses and prevents duplication", () => {
    const hypothesis1 = "  R(4, 5)   > 24  \n\n";
    const hypothesis2 = "r(4, 5) > 24"; // Notice capitalization and whitespace diff

    LakatosianVault.recordFailure(TEST_WORKSPACE, hypothesis1, { "edge": 1 }, "SMT_UNSAT");
    LakatosianVault.recordFailure(TEST_WORKSPACE, hypothesis2, { "edge": 1 }, "SMT_UNSAT");

    const failures = LakatosianVault.getAllFailures(TEST_WORKSPACE);
    
    // Even though we inserted twice, the normalization should detect they are mathematically identical.
    expect(failures).toHaveLength(1);
    expect(failures[0]!.hypothesisSignature).toBe(hypothesis1); // keeps the original signature structure
    expect(failures[0]!.failureReason).toBe("SMT_UNSAT");
  });

  test("Limits retrieval to the top 20 to preserve LLM token window", () => {
    // Insert 25 unique failures
    for (let i = 0; i < 25; i++) {
       LakatosianVault.recordFailure(TEST_WORKSPACE, `R(5, 5) > ${40 + i}`, {}, "SA_PLATEAU");
    }

    const failures = LakatosianVault.getAllFailures(TEST_WORKSPACE, 20);
    expect(failures).toHaveLength(20);
    // Because it's sorted chronologically (newest first), the first failure should be the 25th inserted (index 24).
    expect(failures[0]!.hypothesisSignature).toBe("R(5, 5) > 64");
  });
});
