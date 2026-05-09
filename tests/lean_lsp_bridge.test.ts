import { expect, test, describe, afterAll } from "bun:test";
import { LeanBridge } from "../src/lean_bridge";

describe("LeanLspBridge — Persistent Language Server tests", () => {
  let bridge: LeanBridge;

  // We reuse a single bridge for TDD speed and persistence testing
  // However, we initialize lazily or inside the block
  // to prevent locking if the first test fails
  
  afterAll(async () => {
    if (bridge) {
      await bridge.shutdown();
    }
  });

  test("initialization works without timing out", async () => {
    bridge = new LeanBridge();
    await bridge.initialize();
    expect(bridge.isReady).toBe(true);
  });

  test("valid omega proof returns success: true, isComplete: true", async () => {
    const result = await bridge.checkProof(
      "test_omega_lsp",
      "(n m : Nat) : n + m = m + n",
      ["omega"],
      30_000,
      "import Init\nopen Nat\n\n"
    );
    expect(result.success).toBe(true);
    expect(result.isComplete).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test("false theorem via omega returns success: false with error", async () => {
    const result = await bridge.checkProof(
      "test_false_lsp",
      "(n : Nat) : n + 1 = n",
      ["omega"],
      30_000,
      "import Init\nopen Nat\n\n"
    );
    expect(result.success).toBe(false);
    expect(result.isComplete).toBe(false);
    expect(result.error).toBeDefined();
    // LSP diagnostic messages generally start with something recognizable
    // or just checking that it has an error trace
  });

  test("sorry tactic returns success: false, hasSorry: true", async () => {
    const result = await bridge.checkProof(
      "test_sorry_lsp",
      "(n : Nat) : n + 1 = n",
      ["sorry"],
      30_000,
      "import Init\nopen Nat\n\n"
    );
    expect(result.success).toBe(false);
    expect(result.isComplete).toBe(false);
    expect(result.hasSorry).toBe(true);
  });
  
  test("structural verification correctly identifies sorry goals without hard errors", async () => {
    const leanCode = `import Init
open Nat

theorem my_structural_proof (p : Nat) : p > 0 := by
  sorry
`;
    const result = await bridge.verifyStructuralSkeleton(leanCode, 30_000);
    expect(result.valid).toBe(true);
    expect(result.sorryGoals).toContain("my_structural_proof");
  });
});
