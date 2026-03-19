/**
 * lean_skeleton.test.ts — P1 RED tests
 *
 * Validates verifyStructuralSkeleton() in LeanBridge:
 *   - returns valid:true + populated sorryGoals when the skeleton compiles
 *     with only sorry warnings
 *   - returns valid:false when there are hard type errors
 *   - correctly parses sorry goal names from Lean warning output
 */
import { describe, expect, it, mock } from "bun:test";
import { LeanBridge } from "../src/lean_bridge";

// Warning format emitted by Lean 4 for sorry-stub declarations:
// "warning: declaration 'NAME' uses 'sorry'"
// or:
// "warning: 'NAME' uses 'sorry'"

function makeLeanOutputWithSorry(goalNames: string[]): string {
  return goalNames
    .map((n) => `warning: declaration '${n}' uses 'sorry'`)
    .join("\n");
}

describe("verifyStructuralSkeleton", () => {
  it("returns { valid: true, sorryGoals: ['lemma1','lemma2'] } for a 2-sorry skeleton", async () => {
    const bridge = new LeanBridge();
    // Mock executeLean so tests run without the Lean toolchain
    bridge.executeLean = mock(async (_source: string) => ({
      success: false,
      isComplete: false,
      hasSorry: true,
      rawOutput: makeLeanOutputWithSorry(["lemma1", "lemma2"]),
    }));

    const result = await bridge.verifyStructuralSkeleton(
      "lemma lemma1 : True := by sorry\nlemma lemma2 : True := by sorry"
    );

    expect(result.valid).toBe(true);
    expect(result.sorryGoals).toHaveLength(2);
    expect(result.sorryGoals).toContain("lemma1");
    expect(result.sorryGoals).toContain("lemma2");
  });

  it("returns { valid: true, sorryGoals: ['my_thm'] } for a single sorry", async () => {
    const bridge = new LeanBridge();
    bridge.executeLean = mock(async () => ({
      success: false,
      isComplete: false,
      hasSorry: true,
      rawOutput: "warning: declaration 'my_thm' uses 'sorry'",
    }));

    const result = await bridge.verifyStructuralSkeleton("theorem my_thm : 1 = 1 := by sorry");
    expect(result.valid).toBe(true);
    expect(result.sorryGoals).toEqual(["my_thm"]);
  });

  it("returns { valid: false, sorryGoals: [] } when Lean reports a hard error", async () => {
    const bridge = new LeanBridge();
    bridge.executeLean = mock(async () => ({
      success: false,
      isComplete: false,
      hasSorry: false,
      error: "error: unknown identifier 'foo'",
      rawOutput: "error: unknown identifier 'foo'",
    }));

    const result = await bridge.verifyStructuralSkeleton("garbage lean code");
    expect(result.valid).toBe(false);
    expect(result.sorryGoals).toHaveLength(0);
  });

  it("returns { valid: false } when output has both a hard error and sorry", async () => {
    // A skeleton with a type error is not structurally valid even if sorry appears
    const bridge = new LeanBridge();
    bridge.executeLean = mock(async () => ({
      success: false,
      isComplete: false,
      hasSorry: true,
      error: "error: type mismatch",
      rawOutput: "error: type mismatch\nwarning: declaration 'x' uses 'sorry'",
    }));

    const result = await bridge.verifyStructuralSkeleton("...");
    expect(result.valid).toBe(false);
  });

  it("returns { valid: false, sorryGoals: [] } when lean succeeds with no sorry (proof already complete)", async () => {
    // A fully proved skeleton is not a sorry-skeleton
    const bridge = new LeanBridge();
    bridge.executeLean = mock(async () => ({
      success: true,
      isComplete: true,
      hasSorry: false,
      rawOutput: "PROOF_VALID",
    }));

    const result = await bridge.verifyStructuralSkeleton("theorem trivial : True := trivial");
    // Valid proof is NOT a sorry skeleton — valid=false (skeleton has no sorry stubs to expand)
    expect(result.valid).toBe(false);
    expect(result.sorryGoals).toHaveLength(0);
  });

  it("correctly extracts goal name from backtick-quoting style", async () => {
    // Some Lean versions use backticks: "warning: 'my_lemma' uses `sorry`"
    const bridge = new LeanBridge();
    bridge.executeLean = mock(async () => ({
      success: false,
      isComplete: false,
      hasSorry: true,
      rawOutput: "warning: 'case_analysis_lemma' uses `sorry`",
    }));

    const result = await bridge.verifyStructuralSkeleton("...");
    expect(result.valid).toBe(true);
    expect(result.sorryGoals).toContain("case_analysis_lemma");
  });
});
