/**
 * SolverBridge — Subprocess execution bridge for formal verification solvers.
 *
 * Spawns isolated child processes via Bun.spawn to execute LLM-generated
 * Python (Z3) or Lean code. Enforces strict timeouts to prevent runaway processes.
 */

import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { TrytetClient } from "./execution/trytet_client";

export interface SolverResult {
  success: boolean;
  output: string;
}

export function shouldAttemptZ3Falsification(domain: string): boolean {
  const hardDomains = new Set(["ramsey", "combinatorial", "graph", "np-hard"]);
  if (hardDomains.has(domain.toLowerCase())) {
    console.log(`[Triage] Bypassing upfront Z3 falsification for hard domain: ${domain}. Routing to Empirical Sandbox.`);
    return false; // Skip Z3, go to SA/FunSearch
  }
  return true; // Safe for Z3 bounded check
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
   * Execute a Z3 Python script securely natively (since Trytet Wasm lacks Z3).
   */
  async runZ3(pythonCode: string, timeoutMs: number = 300_000): Promise<SolverResult> {
     const { spawn } = await import("node:child_process");
     const fs = await import("node:fs");
     const os = await import("node:os");
     const path = await import("node:path");
     const crypto = await import("node:crypto");

     console.log(`  [SolverBridge] Executing Z3 Python natively (timeout: ${timeoutMs}ms)`);

     const tempFile = path.join(os.tmpdir(), `z3_script_${crypto.randomUUID()}.py`);
     fs.writeFileSync(tempFile, pythonCode);

     const response = await new Promise<{exitCode: number, stdout: string, stderr: string, timedOut: boolean}>((resolve) => {
         const proc = spawn("python3", [tempFile]);
         let out = "";
         let err = "";
         let isTimeout = false;
         proc.stdout.on("data", (d: any) => out += d.toString());
         proc.stderr.on("data", (d: any) => err += d.toString());

         const timer = setTimeout(() => {
             isTimeout = true;
             proc.kill(9);
         }, timeoutMs);

         proc.on("close", (code: number) => {
             clearTimeout(timer);
             resolve({ exitCode: code ?? -1, stdout: out, stderr: err, timedOut: isTimeout });
         });
     });

     try {
         fs.unlinkSync(tempFile);
     } catch (e) {}

     if (response.timedOut) {
        console.warn(`  [SolverBridge] ⚠️ Native Python TIMED OUT after ${timeoutMs}ms`);
        return { success: false, output: "Execution timed out." };
     }

    console.log(`  [SolverBridge] Python completed with exit code ${response.exitCode}`);

    if (response.exitCode !== 0) {
      return {
        success: false,
        output: response.stderr || response.stdout || "Python exited with non-zero code.",
      };
    }

    const isProven = response.stdout.includes("unsat");
    return {
      success: isProven,
      output: response.stdout,
    };
  }

  /**
   * Spawn the process with timeout enforcement.
   */
  private async executeWithTimeout(
    bin: string,
    args: string[],
    timeoutMs: number,
  ): Promise<SolverResult> {
    let finalBin = bin;
    let finalArgs = [...args];

    const useSandbox = process.env.PERQED_USE_DOCKER_SANDBOX === "1" || process.env.PERQED_USE_DOCKER_SANDBOX === "true";
    if (useSandbox) {
       const tempFilePath = args[args.length - 1]; 
       if (tempFilePath && typeof tempFilePath === "string" && tempFilePath.includes("perqed_z3_")) {
         finalBin = "docker";
         finalArgs = [
           "run", "--rm", 
           "--network", "none",
           "-v", `${tempFilePath}:${tempFilePath}:ro`,
           "z3prover/z3",
           "z3",
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

