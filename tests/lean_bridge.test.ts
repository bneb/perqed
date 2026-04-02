/**
 * Sprint 6: LeanBridge — Integration Tests
 *
 * These tests spawn REAL Lean 4 subprocesses via `lean --stdin --run`.
 * No mocking — same pattern as solver.test.ts which runs real Z3.
 *
 * Lean CLI behavior (4.28.0):
 *   - Exit 0 + no "sorry" warning = valid proof
 *   - Exit 0 + "uses `sorry`" in output = incomplete (sorry axiom)
 *   - Exit 1 + error message = tactic failure or syntax error
 */

import { expect, test, describe, beforeEach } from "bun:test";
import { LeanBridge, type LeanResult } from "../src/lean_bridge";
import { join } from "path";
import { rmSync } from "fs";

beforeEach(() => {
  try {
    rmSync(join(process.cwd(), ".lake", "lake.lock"), { force: true });
  } catch (e) {}
});

// Mock bwrap on macOS for TDD red-to-green workflow
if (process.platform !== "linux") {
  process.env.BWRAP_BIN = join(process.cwd(), "tests/mock_bwrap.sh");
}

// ──────────────────────────────────────────────
// Valid Proofs
// ──────────────────────────────────────────────

describe("LeanBridge — Valid Proofs", () => {
  test("valid omega proof returns success: true, isComplete: true", async () => {
    const bridge = new LeanBridge();
    const result = await bridge.checkProof(
      "test_omega",
      "(n m : Nat) : n + m = m + n",
      ["omega"],
      30_000,
      "import Init\nopen Nat\n\n"
    );
    expect(result.success).toBe(true);
    expect(result.isComplete).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test("multi-step intro + omega proof succeeds", async () => {
    const bridge = new LeanBridge();
    // Use a forall goal so `intro` actually introduces a binder
    const result = await bridge.checkProof(
      "test_intro_omega",
      ": ∀ n : Nat, n + 1 > n",
      ["intro n", "omega"],
      30_000,
      "import Init\nopen Nat\n\n"
    );
    expect(result.success).toBe(true);
    expect(result.isComplete).toBe(true);
  });

  test("simp proof for n + 0 = n", async () => {
    const bridge = new LeanBridge();
    const result = await bridge.checkProof(
      "test_simp",
      "(n : Nat) : n + 0 = n",
      ["simp"],
      30_000,
      "import Init\nopen Nat\n\n"
    );
    expect(result.success).toBe(true);
    expect(result.isComplete).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Failed Tactics
// ──────────────────────────────────────────────

describe("LeanBridge — Failed Tactics", () => {
  test("false theorem via omega returns success: false with error", async () => {
    const bridge = new LeanBridge();
    const result = await bridge.checkProof(
      "test_false",
      "(n : Nat) : n + 1 = n",
      ["omega"],
      30_000,
      "import Init\nopen Nat\n\n"
    );
    expect(result.success).toBe(false);
    expect(result.isComplete).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("error");
  });

  test("wrong tactic returns success: false with descriptive error", async () => {
    const bridge = new LeanBridge();
    const result = await bridge.checkProof(
      "test_wrong_tactic",
      "(n m : Nat) : n + m = m + n",
      ["exact rfl"],
      30_000,
      "import Init\nopen Nat\n\n"
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("nonexistent tactic returns error", async () => {
    const bridge = new LeanBridge();
    const result = await bridge.checkProof(
      "test_bogus",
      "(n : Nat) : n = n",
      ["blurrgghh_not_a_tactic"],
      30_000,
      "import Init\nopen Nat\n\n"
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ──────────────────────────────────────────────
// Sorry Detection
// ──────────────────────────────────────────────

describe("LeanBridge — Sorry Detection", () => {
  test("sorry tactic returns success: false, isComplete: false, hasSorry: true", async () => {
    const bridge = new LeanBridge();
    const result = await bridge.checkProof(
      "test_sorry",
      "(n : Nat) : n + 1 = n",
      ["sorry"],
      30_000,
      "import Init\nopen Nat\n\n"
    );
    expect(result.success).toBe(false);
    expect(result.isComplete).toBe(false);
    expect(result.hasSorry).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Timeout
// ──────────────────────────────────────────────

describe("LeanBridge — Timeout", () => {
  test("extremely short timeout returns timeout error", async () => {
    const bridge = new LeanBridge();
    // omega on a valid proof should succeed, but 1ms timeout should kill it
    const result = await bridge.checkProof(
      "test_timeout",
      "(n m : Nat) : n + m = m + n",
      ["omega"],
      1, // 1ms timeout — impossibly short
      "import Init\nopen Nat\n\n"
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/timed?\s*out/i);
  });
});

// ──────────────────────────────────────────────
// Lean File Generation
// ──────────────────────────────────────────────

describe("LeanBridge — File Generation", () => {
  test("buildLeanSource produces valid Lean 4 syntax", () => {
    const bridge = new LeanBridge();
    const source = bridge.buildLeanSource(
      "my_theorem",
      "(n m : Nat) : n + m = m + n",
      ["intro", "omega"],
      "import Init\nopen Nat\n\n"
    );
    expect(source).toContain("theorem my_theorem");
    expect(source).toContain("(n m : Nat) : n + m = m + n");
    expect(source).toContain("by");
    expect(source).toContain("intro");
    expect(source).toContain("omega");
    expect(source).toContain("def main");
    expect(source).toContain("PROOF_VALID");
  });
});

// ──────────────────────────────────────────────
// Isolation
// ──────────────────────────────────────────────

describe("LeanBridge — Isolation", () => {
  test("runs are isolated — no cross-contamination between proofs", async () => {
    const bridge = new LeanBridge();

    const resultA = await bridge.checkProof(
      "theorem_a",
      "(n : Nat) : n + 0 = n",
      ["simp"],
      30_000,
      "import Init\nopen Nat\n\n"
    );

    const resultB = await bridge.checkProof(
      "theorem_b",
      "(n : Nat) : n + 1 = n",
      ["omega"],
      30_000,
      "import Init\nopen Nat\n\n"
    );

    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(false);
  });
});
