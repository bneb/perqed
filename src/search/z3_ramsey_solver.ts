/**
 * Z3 Ramsey Solver
 *
 * Primary exact solver for circulant Ramsey witness search.
 * Uses SolverBridge to invoke Python/Z3, parses the SAT:{bits} output,
 * and reconstructs a full AdjacencyMatrix from the 17-bit distance coloring.
 *
 * For R(4,6) on N=35: solves in ~5-30 seconds (vs. SA's glass floor at E=12-15).
 */

import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import { buildCirculantGraph } from "./symmetry";
import { generateRamseyZ3Script } from "./z3_circulant_generator";

export interface Z3WitnessResult {
  status: 'sat';
  /** The adjacency matrix of the found witness */
  adj: AdjacencyMatrix;
  /** The distance-color bit string from Z3 (e.g. "10110100110110100") */
  distanceBits: string;
  /** Wall time for Z3 to solve in milliseconds */
  solveTimeMs: number;
}

export interface Z3UnsatResult {
  status: 'unsat';
}

export interface Z3TimeoutResult {
  status: 'timeout';
}

export interface Z3ErrorResult {
  status: 'error';
  message: string;
}

export type Z3Result = Z3WitnessResult | Z3UnsatResult | Z3TimeoutResult | Z3ErrorResult;

export interface Z3SolverOptions {
  /** Timeout for the Z3 process in milliseconds (default 120s) */
  timeoutMs?: number;
  /** Python executable to use (default: "python3") */
  pythonBinary?: string;
}

/**
 * Check if Z3 Python package is installed and available.
 */
export async function isZ3Available(pythonBinary = "python3"): Promise<boolean> {
  try {
    const proc = Bun.spawn([pythonBinary, "-c", "from z3 import *; print('ok')"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, _, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return exitCode === 0 && stdout.trim() === "ok";
  } catch {
    return false;
  }
}

/**
 * Solve the circulant Ramsey witness problem using Z3.
 *
 * @returns Z3WitnessResult if SAT, Z3UnsatResult if provably no witness,
 *          Z3TimeoutResult if solver exceeded the time limit,
 *          Z3ErrorResult on process/parse failure
 */
export async function solveWithZ3(
  N: number,
  r: number,
  s: number,
  options: Z3SolverOptions = {},
): Promise<Z3Result> {
  const { timeoutMs = 120_000, pythonBinary = "python3" } = options;

  const script = generateRamseyZ3Script(N, r, s);
  const tempFile = join(tmpdir(), `perqed_z3_ramsey_${randomUUID()}.py`);
  await Bun.write(tempFile, script);

  const startTime = Date.now();

  try {
    const proc = Bun.spawn([pythonBinary, tempFile], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const timeoutHandle = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), timeoutMs),
    );

    const processResult = (async () => {
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode } as const;
    })();

    const race = await Promise.race([processResult, timeoutHandle]);

    if (race === "timeout") {
      proc.kill();
      console.error(`[Z3] Timed out after ${timeoutMs}ms for R(${r},${s}) on N=${N}`);
      return { status: 'timeout' };
    }

    const { stdout, stderr, exitCode } = race;
    const solveTimeMs = Date.now() - startTime;

    if (exitCode !== 0) {
      console.error(`[Z3] Process error (exit ${exitCode}): ${stderr || stdout}`);
      return { status: 'error', message: stderr || stdout || `exit ${exitCode}` };
    }

    if (stdout === "UNSAT") {
      console.log(`[Z3] UNSAT — no circulant R(${r},${s}) witness exists on N=${N}`);
      return { status: 'unsat' };
    }

    if (stdout.startsWith("ERROR:")) {
      console.error(`[Z3] Solver error: ${stdout}`);
      return { status: 'error', message: stdout };
    }

    // Parse SAT:{bits}
    const match = stdout.match(/^SAT:([01]+)$/);
    if (!match) {
      console.error(`[Z3] Unexpected output: ${stdout}`);
      return { status: 'error', message: `Unexpected output: ${stdout}` };
    }

    const distanceBits = match[1]!;
    const expectedLen = Math.floor(N / 2);
    if (distanceBits.length !== expectedLen) {
      console.error(`[Z3] Bit string length ${distanceBits.length} != expected ${expectedLen}`);
      return { status: 'error', message: `Bit string length ${distanceBits.length} != expected ${expectedLen}` };
    }

    // Reconstruct AdjacencyMatrix from distance-color bits
    const distanceColors = new Map<number, number>();
    for (let d = 1; d <= expectedLen; d++) {
      distanceColors.set(d, parseInt(distanceBits[d - 1]!, 10));
    }
    const adj = buildCirculantGraph(distanceColors, N);

    console.log(`[Z3] SAT in ${solveTimeMs}ms — witness found for R(${r},${s}) on N=${N}`);
    console.log(`[Z3] Distance colors: ${distanceBits}`);

    return { status: 'sat', adj, distanceBits, solveTimeMs };
  } finally {
    // Clean up temp file
    try {
      await import("node:fs/promises").then((fs) => fs.unlink(tempFile).catch(() => {}));
    } catch {}
  }
}
