/**
 * Sprint 15: LeanBridge Gauntlet Tests (TDD RED → GREEN)
 *
 * Tests the syntax check and triviality spray methods.
 * Uses mocked executeLean to avoid needing a real Lean installation.
 */

import { describe, test, expect } from "bun:test";
import { LeanBridge, type LeanResult } from "../src/lean_bridge";

// ──────────────────────────────────────────────
// Mock LeanBridge subclass for testing
// ──────────────────────────────────────────────

class MockLeanBridge extends LeanBridge {
  private syntaxResults: Map<string, LeanResult> = new Map();
  private tacticResults: Map<string, LeanResult> = new Map();
  executeLeanCalls: string[] = [];
  checkProofCalls: { name: string; sig: string; tactics: string[] }[] = [];

  /** Register a mock result for executeLean based on source content */
  mockSyntax(keyword: string, result: LeanResult): void {
    this.syntaxResults.set(keyword, result);
  }

  /** Register a mock result for checkProof based on tactic name */
  mockTactic(tactic: string, result: LeanResult): void {
    this.tacticResults.set(tactic, result);
  }

  override async executeLean(source: string, _timeoutMs?: number): Promise<LeanResult> {
    this.executeLeanCalls.push(source);
    // Return first matching keyword result
    for (const [keyword, result] of this.syntaxResults) {
      if (source.includes(keyword)) return result;
    }
    // Default: syntax error
    return {
      success: false,
      isComplete: false,
      hasSorry: false,
      error: "unknown identifier",
      rawOutput: "error: unknown identifier",
    };
  }

  override async checkProof(
    name: string,
    sig: string,
    tactics: string[],
    _timeoutMs?: number,
  ): Promise<LeanResult> {
    this.checkProofCalls.push({ name, sig, tactics });
    const tactic = tactics[0] ?? "";
    const result = this.tacticResults.get(tactic);
    if (result) return result;
    // Default: tactic failed
    return {
      success: false,
      isComplete: false,
      hasSorry: false,
      error: `tactic '${tactic}' failed`,
      rawOutput: `error: tactic '${tactic}' failed`,
    };
  }
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("LeanBridge Gauntlet", () => {

  describe("checkSyntax", () => {
    test("returns true when Lean compiles with sorry (valid syntax)", async () => {
      const lean = new MockLeanBridge();
      lean.mockSyntax("prime_gap", {
        success: false,
        isComplete: false,
        hasSorry: true,
        rawOutput: "warning: uses `sorry`",
      });

      const valid = await lean.checkSyntax("theorem prime_gap (n : Nat) : n > 0");
      expect(valid).toBe(true);
    });

    test("returns false when Lean has syntax errors", async () => {
      const lean = new MockLeanBridge();
      lean.mockSyntax("bad_theorem", {
        success: false,
        isComplete: false,
        hasSorry: false,
        error: "error: unknown identifier 'bogus'",
        rawOutput: "error: unknown identifier 'bogus'",
      });

      const valid = await lean.checkSyntax("theorem bad_theorem : bogus");
      expect(valid).toBe(false);
    });

    test("pipes the signature with sorry to executeLean", async () => {
      const lean = new MockLeanBridge();
      lean.mockSyntax("my_thm", {
        success: false,
        isComplete: false,
        hasSorry: true,
        rawOutput: "uses `sorry`",
      });

      await lean.checkSyntax("theorem my_thm (n : Nat) : n = n");

      expect(lean.executeLeanCalls.length).toBe(1);
      expect(lean.executeLeanCalls[0]).toContain("sorry");
      expect(lean.executeLeanCalls[0]).toContain("my_thm");
    });
  });

  describe("isTrivial", () => {
    test("returns true when a trivial tactic solves the theorem", async () => {
      const lean = new MockLeanBridge();
      // "omega" solves it
      lean.mockTactic("omega", {
        success: true,
        isComplete: true,
        hasSorry: false,
        rawOutput: "PROOF_VALID",
      });

      const trivial = await lean.isTrivial(
        "trivial_thm",
        "(n : Nat) : n + 0 = n",
      );
      expect(trivial).toBe(true);
    });

    test("returns false when no trivial tactic solves it", async () => {
      const lean = new MockLeanBridge();
      // No tactics succeed — all use default (failure)

      const trivial = await lean.isTrivial(
        "hard_thm",
        "(n m : Nat) : n + m = m + n",
      );
      expect(trivial).toBe(false);
    });

    test("short-circuits on first successful tactic", async () => {
      const lean = new MockLeanBridge();
      // "simp" solves it (second tactic in the spray)
      lean.mockTactic("simp", {
        success: true,
        isComplete: true,
        hasSorry: false,
        rawOutput: "PROOF_VALID",
      });

      const trivial = await lean.isTrivial(
        "easy_thm",
        "(n : Nat) : n = n",
      );
      expect(trivial).toBe(true);

      // Should have tried rfl first, then simp (which succeeds), then stopped
      // At most 2 calls (rfl fails, simp succeeds)
      expect(lean.checkProofCalls.length).toBeLessThanOrEqual(2);
    });

    test("fires all 5 trivial tactics when none succeed", async () => {
      const lean = new MockLeanBridge();

      await lean.isTrivial("hard_thm", "(G : Graph) : connected G");

      // Should have tried all 5: rfl, simp, omega, trivial, decide
      expect(lean.checkProofCalls.length).toBe(5);
      const tactics = lean.checkProofCalls.map(c => c.tactics[0]);
      expect(tactics).toContain("rfl");
      expect(tactics).toContain("simp");
      expect(tactics).toContain("omega");
      expect(tactics).toContain("trivial");
      expect(tactics).toContain("decide");
    });
  });
});
