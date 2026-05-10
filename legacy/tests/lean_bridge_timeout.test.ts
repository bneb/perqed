import { expect, test, describe } from "bun:test";
import { LeanBridge } from "../src/lean_bridge";

describe("LeanBridge Compiler Trace Extraction", () => {
  test("should extract compiler trace for broken Mathlib syntax without timing out", async () => {
    const bridge = new LeanBridge(undefined, process.cwd());
    await bridge.initialize();

    // Intentionally broken Lean 4 code to force compiler trace diagnostics
    const source = `import Mathlib\n\ndef myCirculantGraph (\n  symm := by sorry\n`;

    const result1 = await bridge.verifyStructuralSkeleton(source, 15000);
    console.log("VERIFY RESULT:", result1);

    const result2 = await bridge.executeLean(source, 15000); // 15s timeout
    await bridge.shutdown();

    console.log("EXECUTE_LEAN RESULT:", result2);

    // Verify it wasn't a timeout (which returns empty string)
    expect(result2.rawOutput).not.toBe("");
    // Verify it actually caught the parsing error
    expect(result2.success).toBe(false);
  }, 20000); // Allow test itself up to 20s
});
