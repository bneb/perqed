/**
 * SolverBridge — Subprocess execution bridge for formal verification solvers.
 *
 * Spawns isolated child processes via Bun.spawn to execute LLM-generated
 * Python (Z3) or Lean code. Enforces strict timeouts to prevent runaway processes.
 */

import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export interface SolverResult {
  success: boolean;
  output: string;
}

export class SolverBridge {
  private readonly pythonBinary: string;
  private readonly smtBinary: string;

  constructor(pythonBinary: string = "python3", smtBinary: string = "z3") {
    this.pythonBinary = pythonBinary;
    this.smtBinary = smtBinary;
  }

  /**
   * Execute a Z3 SMT-LIB2 script in an isolated subprocess natively.
   */
  async runZ3SMT(smtCode: string, timeoutMs: number = 30_000): Promise<SolverResult> {
    const tempFile = join(tmpdir(), `perqed_z3_${randomUUID()}.smt2`);
    await Bun.write(tempFile, smtCode);

    try {
      return await this.executeWithTimeout(this.smtBinary, ["-smt2", tempFile], timeoutMs);
    } finally {
      Bun.file(tempFile)
        .exists()
        .then((exists) => {
          if (exists) {
            import("node:fs/promises").then((fs) => fs.unlink(tempFile).catch(() => {}));
          }
        });
    }
  }

  /**
   * Execute a Z3 Python script in an isolated subprocess.
   *
   * Writes the code to a unique temp file, spawns a child process,
   * captures stdout/stderr, and enforces a strict timeout.
   *
   * @returns `success: true` if exit code is 0 AND stdout contains "unsat".
   */
  async runZ3(pythonCode: string, timeoutMs: number = 30_000): Promise<SolverResult> {
    // Write to a unique temp file to prevent cross-contamination
    const tempFile = join(tmpdir(), `perqed_z3_${randomUUID()}.py`);
    await Bun.write(tempFile, pythonCode);

    try {
      return await this.executeWithTimeout(this.pythonBinary, [tempFile], timeoutMs);
    } finally {
      // Clean up temp file — fire and forget
      Bun.file(tempFile)
        .exists()
        .then((exists) => {
          if (exists) {
            import("node:fs/promises").then((fs) => fs.unlink(tempFile).catch(() => {}));
          }
        });
    }
  }

  /**
   * Spawn the process with timeout enforcement.
   */
  private async executeWithTimeout(
    bin: string,
    args: string[],
    timeoutMs: number,
  ): Promise<SolverResult> {
    const useSandbox = process.env.PERQED_USE_DOCKER_SANDBOX === "1" || process.env.PERQED_USE_DOCKER_SANDBOX === "true";
    
    let finalBin = bin;
    let finalArgs = [...args];

    if (useSandbox) {
      // Extract the file path, assuming the last argument is the temp file path we want to mount
      const tempFilePath = args[args.length - 1]; 
      if (tempFilePath && typeof tempFilePath === "string" && tempFilePath.includes("perqed_z3_")) {
        finalBin = "docker";
        finalArgs = [
          "run", "--rm", 
          "--network", "none", // Forbid network access
          "-v", `${tempFilePath}:${tempFilePath}:ro`, // Mount only the isolated temp file read-only
          "z3prover/z3", // Standard Z3 image
          bin === "python3" ? "python3" : "z3",
          ...args
        ];
      }
    }

    const proc = Bun.spawn([finalBin, ...finalArgs], {
      stdout: "pipe",
      stderr: "pipe",
    });

    console.log(`  [SolverBridge] Executing ${bin} (timeout: ${timeoutMs}ms)`);

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
      console.warn(`  [SolverBridge] ⚠️ Execution of ${bin} TIMED OUT after ${timeoutMs}ms`);
      // Kill the runaway process
      proc.kill();
      return {
        success: false,
        output: "Execution timed out.",
      };
    }

    const { stdout, stderr, exitCode } = raceResult;
    console.log(`  [SolverBridge] ${bin} completed with exit code ${exitCode}`);

    if (exitCode !== 0) {
      return {
        success: false,
        output: stderr || stdout || "Process exited with non-zero code.",
      };
    }

    // In Z3: 'unsat' on a negated conjecture means the original is PROVEN
    const isProven = stdout.includes("unsat");
    return {
      success: isProven,
      output: stdout,
    };
  }
}

