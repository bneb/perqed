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
  private readonly cwd?: string;

  constructor(leanBinary?: string, cwd?: string) {
    // Default: look in ~/.elan/bin first, then fall back to PATH
    this.leanBinary = leanBinary ?? `${process.env.HOME}/.elan/bin/lean`;
    this.cwd = cwd;
  }

  /**
   * Build a complete Lean 4 source file from theorem components.
   *
   * The generated file has the structure:
   *   import Mathlib
   *   open Nat
   *
   *   theorem <name> <signature> := by
   *     <tactic1>
   *     <tactic2>
   *     ...
   *   def main : IO Unit := IO.println "PROOF_VALID"
   *
   * @param preamble Optional import block override. Defaults to
   *   'import Mathlib\nopen Nat\n\n' which provides ℕ, Fin, LE, OfNat,
   *   and all Mathlib instances needed for Ramsey/Schur theorem signatures.
   */
  buildLeanSource(
    theoremName: string,
    signature: string,
    tactics: string[],
    preamble: string = "import Mathlib\nopen Nat\n\n",
  ): string {
    const tacticBlock = tactics.map((t) => `  ${t}`).join("\n");

    return [
      preamble.trimEnd(),
      "",
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
    const lakeBinary = `${process.env.HOME}/.elan/bin/lake`;
    const cmd = this.cwd 
      ? [lakeBinary, "env", this.leanBinary, "--stdin", "--run"]
      : [this.leanBinary, "--stdin", "--run"];

    const proc = Bun.spawn(cmd, {
      cwd: this.cwd,
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

  // ──────────────────────────────────────────────
  // Sprint 15: Gauntlet Methods (Conjecturer)
  // ──────────────────────────────────────────────

  /**
   * Verifies if a theorem signature is syntactically valid Lean 4.
   * Compiles the signature with `sorry` — if it compiles (even with sorry warning),
   * the syntax is valid.
   *
   * @param signature - Full theorem declaration (e.g., "theorem foo (n : Nat) : n = n")
   * @returns true if syntactically valid
   */
  async checkSyntax(signature: string): Promise<boolean> {
    const source = `${signature} := by sorry\n\ndef main : IO Unit := IO.println "SYNTAX_CHECK"\n`;
    const result = await this.executeLean(source, 10_000);

    // Valid if no hard errors (sorry warning is expected and OK)
    if (result.error && result.error.includes("error:")) return false;
    return true;
  }

  /**
   * Fires a rapid barrage of trivial decision procedures.
   * Returns true if ANY trivial tactic solves the theorem (meaning it's too easy).
   *
   * @param theoremName - Name for the theorem declaration
   * @param signature - Theorem signature (e.g., "(n : Nat) : n + 0 = n")
   * @returns true if trivially solvable
   */
  async isTrivial(theoremName: string, signature: string): Promise<boolean> {
    const trivialTactics = ["rfl", "simp", "omega", "trivial", "decide"];

    for (const tactic of trivialTactics) {
      const result = await this.checkProof(theoremName, signature, [tactic], 5_000);
      if (result.isComplete) return true;
    }

    return false;
  }

  // ──────────────────────────────────────────────
  // Sprint 19: Goal Parsing for AND/OR Topology
  // ──────────────────────────────────────────────

  /**
   * Parses the Lean state output to determine the number of active goals.
   * If the string contains "N goals", returns N. Otherwise, defaults to 1.
   * If the state is empty or "no goals", returns 0.
   */
  parseGoalCount(leanState: string): number {
    if (!leanState || leanState.trim() === "no goals") return 0;

    const match = leanState.match(/^(\d+)\s+goals/i);
    if (match) {
      return parseInt(match[1]!, 10);
    }
    return 1;
  }

  /**
   * Splits a multi-goal Lean state string into an array of individual goal strings.
   */
  splitGoals(leanState: string): string[] {
    const count = this.parseGoalCount(leanState);
    if (count <= 1) return [leanState.trim()];

    // Split by "case " headers if present, otherwise by double-newlines
    let parts: string[];
    if (leanState.includes("\ncase ")) {
      parts = leanState.split(/\n(?=case )/);
    } else {
      parts = leanState.split(/\n\n/);
    }

    return parts
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .filter(p => !/^\d+\s+goals$/i.test(p)); // Strip the "N goals" header
  }

  // ──────────────────────────────────────────────
  // Phase 7 P1: Structural Skeleton Verification
  // ──────────────────────────────────────────────

  /**
   * Verify that a sorry-laden Lean 4 skeleton is structurally valid.
   *
   * Mathematical invariant: a skeleton is "valid" if and only if:
   *   1. Lean compiles it with exit code 0 (no hard type errors)
   *   2. The output contains sorry warnings (hasSorry = true)
   *   3. The output contains NO "error:" substring (distinguishes sorry warnings from failures)
   *
   * If valid, extracts the names of all sorry-stubbed declarations so the
   * orchestrator can spawn targeted tactic sub-nodes for each.
   *
   * Warning formats Lean 4 emits for sorry stubs:
   *   "warning: declaration 'NAME' uses 'sorry'"   ← standard
   *   "warning: 'NAME' uses `sorry`"               ← older/alternate
   *
   * @param leanCode  Raw Lean 4 source (may include imports and def main)
   * @param timeoutMs Timeout passed to executeLean (default 30s)
   */
  async verifyStructuralSkeleton(
    leanCode: string,
    timeoutMs: number = 30_000,
  ): Promise<{ valid: boolean; sorryGoals: string[] }> {
    const result = await this.executeLean(leanCode, timeoutMs);

    // Hard error (type mismatch, unknown identifier, syntax error) — skeleton is broken
    if (result.rawOutput.includes("error:")) {
      return { valid: false, sorryGoals: [] };
    }

    // A fully proved proof is not a sorry skeleton (nothing left to decompose)
    if (!result.hasSorry) {
      return { valid: false, sorryGoals: [] };
    }

    // Skeleton is structurally valid — extract sorry goal names
    // Pattern 1: warning: declaration 'NAME' uses 'sorry'
    // Pattern 2: warning: 'NAME' uses `sorry`
    const sorryGoals: string[] = [];
    const pattern =
      /warning:\s+(?:declaration\s+)?'([^']+)'\s+uses\s+[`']sorry[`']/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(result.rawOutput)) !== null) {
      const name = match[1]!;
      if (!sorryGoals.includes(name)) {
        sorryGoals.push(name);
      }
    }

    return { valid: true, sorryGoals };
  }
}
