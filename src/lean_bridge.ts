/**
 * LeanBridge — Subprocess execution bridge for Lean 4 formal verification.
 *
 * Pipes generated Lean 4 source code via stdin to `lean --stdin --run`.
 * Each invocation is fully isolated — no state leaks between calls.
 *
 * Lean 4.28.0 CLI behavior:
 *   - Exit 0, no "sorry" warning: valid proof, all goals closed
 *   - Exit 0, "uses `sorry`" in output: proof compiled but used sorry axiom
 *   - Exit 1: tactic failure, syntax error, or type mismatch
 *
 * The bridge appends a `def main` harness that prints "PROOF_VALID" on success.
 * This lets us distinguish "Lean compiled the file" from "Lean ran main".
 */

export interface LeanResult {
  /** True if the proof compiled without errors AND without sorry. */
  success: boolean;
  /** True if all goals are closed (no remaining goals, no sorry). */
  isComplete: boolean;
  /** True if the proof used `sorry` axiom. */
  hasSorry: boolean;
  /** Error message if the proof failed. */
  error?: string;
  /** Raw stdout + stderr output from Lean. */
  rawOutput: string;
}

export class LeanBridge {
  private readonly leanBinary: string;

  constructor(leanBinary?: string) {
    // Default: look in ~/.elan/bin first, then fall back to PATH
    this.leanBinary = leanBinary ?? `${process.env.HOME}/.elan/bin/lean`;
  }

  /**
   * Build a complete Lean 4 source file from theorem components.
   *
   * The generated file has the structure:
   *   theorem <name> <signature> := by
   *     <tactic1>
   *     <tactic2>
   *     ...
   *   def main : IO Unit := IO.println "PROOF_VALID"
   */
  buildLeanSource(
    theoremName: string,
    signature: string,
    tactics: string[],
  ): string {
    const tacticBlock = tactics.map((t) => `  ${t}`).join("\n");

    return [
      `theorem ${theoremName} ${signature} := by`,
      tacticBlock,
      "",
      `def main : IO Unit := IO.println "PROOF_VALID"`,
      "",
    ].join("\n");
  }

  /**
   * Check a proof by piping Lean source to `lean --stdin --run`.
   *
   * @param theoremName - Name for the theorem declaration
   * @param signature - Theorem signature (e.g., "(n m : Nat) : n + m = m + n")
   * @param tactics - Array of tactics to apply in sequence
   * @param timeoutMs - Timeout in milliseconds (default: 30s)
   */
  async checkProof(
    theoremName: string,
    signature: string,
    tactics: string[],
    timeoutMs: number = 30_000,
  ): Promise<LeanResult> {
    const source = this.buildLeanSource(theoremName, signature, tactics);
    return this.executeLean(source, timeoutMs);
  }

  /**
   * Execute raw Lean source code via stdin pipe.
   */
  async executeLean(
    source: string,
    timeoutMs: number = 30_000,
  ): Promise<LeanResult> {
    const proc = Bun.spawn([this.leanBinary, "--stdin", "--run"], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    // Write the source code to stdin and close the pipe
    proc.stdin.write(source);
    proc.stdin.end();

    // Race: process completion vs. timeout
    const timeoutPromise = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), timeoutMs),
    );

    const processPromise = (async () => {
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      return { stdout, stderr, exitCode } as const;
    })();

    const raceResult = await Promise.race([processPromise, timeoutPromise]);

    if (raceResult === "timeout") {
      proc.kill();
      return {
        success: false,
        isComplete: false,
        hasSorry: false,
        error: "Lean execution timed out.",
        rawOutput: "",
      };
    }

    const { stdout, stderr, exitCode } = raceResult;
    const combinedOutput = (stdout + "\n" + stderr).trim();

    // Check for sorry usage (Lean compiles but with warning)
    const hasSorry = combinedOutput.includes("uses `sorry`") ||
                     combinedOutput.includes("uses 'sorry'");

    if (exitCode !== 0) {
      // Tactic failure, syntax error, or type mismatch
      return {
        success: false,
        isComplete: false,
        hasSorry: false,
        error: combinedOutput || "Lean exited with non-zero code.",
        rawOutput: combinedOutput,
      };
    }

    if (hasSorry) {
      // Compiled but used sorry — proof is incomplete
      return {
        success: false,
        isComplete: false,
        hasSorry: true,
        error: undefined,
        rawOutput: combinedOutput,
      };
    }

    // Exit 0 + no sorry + PROOF_VALID in output = fully verified
    const isComplete = combinedOutput.includes("PROOF_VALID");
    return {
      success: isComplete,
      isComplete,
      hasSorry: false,
      error: undefined,
      rawOutput: combinedOutput,
    };
  }
}
