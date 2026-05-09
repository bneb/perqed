/**
 * lean_skeleton.test.ts — P1 RED tests
 *
 * Validates verifyStructuralSkeleton() in LeanBridge:
 *   - returns valid:true + populated sorryGoals when the skeleton compiles
 *     with only sorry warnings
 *   - returns valid:false when there are hard type errors
 *   - correctly parses sorry goal names from Lean warning output
 */
import { describe, expect, it, mock, spyOn } from "bun:test";
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
    spyOn(bridge as any, "initialize").mockImplementation(async () => { (bridge as any).isReady = true; });
    spyOn(bridge as any, "sendNotification").mockImplementation(() => {});
    spyOn(bridge as any, "waitForProgress").mockImplementation(async (uri: string) => {
      (bridge as any).diagnosticsMap.set(uri, [
        { range: { start: { line: 0 } }, severity: 2, message: "warning: declaration 'lemma1' uses 'sorry'" },
        { range: { start: { line: 1 } }, severity: 2, message: "warning: declaration 'lemma2' uses 'sorry'" }
      ] as any);
    });

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
    spyOn(bridge as any, "initialize").mockImplementation(async () => { (bridge as any).isReady = true; });
    spyOn(bridge as any, "sendNotification").mockImplementation(() => {});
    spyOn(bridge as any, "waitForProgress").mockImplementation(async (uri: string) => {
      (bridge as any).diagnosticsMap.set(uri, [
        { range: { start: { line: 0 } }, severity: 2, message: "warning: declaration 'my_thm' uses 'sorry'" }
      ] as any);
    });

    const result = await bridge.verifyStructuralSkeleton("theorem my_thm : 1 = 1 := by sorry");
    expect(result.valid).toBe(true);
    expect(result.sorryGoals).toEqual(["my_thm"]);
  });

  it("returns { valid: false, sorryGoals: [] } when Lean reports a hard error", async () => {
    const bridge = new LeanBridge();
    spyOn(bridge as any, "initialize").mockImplementation(async () => { (bridge as any).isReady = true; });
    spyOn(bridge as any, "sendNotification").mockImplementation(() => {});
    spyOn(bridge as any, "waitForProgress").mockImplementation(async (uri: string) => {
      (bridge as any).diagnosticsMap.set(uri, [
        { range: { start: { line: 0 } }, severity: 1, message: "error: unknown identifier 'foo'" }
      ] as any);
    });

    const result = await bridge.verifyStructuralSkeleton("garbage lean code");
    expect(result.valid).toBe(false);
    expect(result.sorryGoals).toHaveLength(0);
  });

  it("returns { valid: false } when output has both a hard error and sorry", async () => {
    // A skeleton with a type error is not structurally valid even if sorry appears
    const bridge = new LeanBridge();
    spyOn(bridge as any, "initialize").mockImplementation(async () => { (bridge as any).isReady = true; });
    spyOn(bridge as any, "sendNotification").mockImplementation(() => {});
    spyOn(bridge as any, "waitForProgress").mockImplementation(async (uri: string) => {
      (bridge as any).diagnosticsMap.set(uri, [
        { range: { start: { line: 0 } }, severity: 1, message: "error: type mismatch" },
        { range: { start: { line: 0 } }, severity: 2, message: "warning: declaration 'x' uses 'sorry'" }
      ] as any);
    });

    const result = await bridge.verifyStructuralSkeleton("lemma case_analysis_lemma : True := by sorry");
    expect(result.valid).toBe(false);
  });

  it("returns { valid: false, sorryGoals: [] } when lean succeeds with no sorry (proof already complete)", async () => {
    // A fully proved skeleton is not a sorry-skeleton
    const bridge = new LeanBridge();
    spyOn(bridge as any, "initialize").mockImplementation(async () => { (bridge as any).isReady = true; });
    spyOn(bridge as any, "sendNotification").mockImplementation(() => {});
    spyOn(bridge as any, "waitForProgress").mockImplementation(async (uri: string) => {
      (bridge as any).diagnosticsMap.set(uri, [] as any);
    });

    const result = await bridge.verifyStructuralSkeleton("theorem trivial : True := trivial");
    // Valid proof is NOT a sorry skeleton — valid=false (skeleton has no sorry stubs to expand)
    expect(result.valid).toBe(false);
    expect(result.sorryGoals).toHaveLength(0);
  });

  it("correctly extracts goal name from backtick-quoting style", async () => {
    // Some Lean versions use backticks: "warning: 'my_lemma' uses `sorry`"
    const bridge = new LeanBridge();
    spyOn(bridge as any, "initialize").mockImplementation(async () => { (bridge as any).isReady = true; });
    spyOn(bridge as any, "sendNotification").mockImplementation(() => {});
    spyOn(bridge as any, "waitForProgress").mockImplementation(async (uri: string) => {
      (bridge as any).diagnosticsMap.set(uri, [
        { range: { start: { line: 0 } }, severity: 2, message: "warning: 'case_analysis_lemma' uses `sorry`" }
      ] as any);
    });

    const result = await bridge.verifyStructuralSkeleton("lemma case_analysis_lemma : True := by sorry");
    expect(result.valid).toBe(true);
    expect(result.sorryGoals).toContain("case_analysis_lemma");
  });
});
