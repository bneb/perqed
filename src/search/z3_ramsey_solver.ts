/**
 * Z3 Ramsey Solver
 *
 * Primary exact solver for circulant Ramsey witness search.
 * Uses SolverBridge to invoke Python/Z3, parses the SAT:{bits} output,
 * and reconstructs a full AdjacencyMatrix from the 17-bit distance coloring.
 *
 * For R(4,6) on N=35: solves in ~5-30 seconds (vs. SA's glass floor at E=12-15).
 */

import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import { buildCirculantGraph } from "./symmetry";
import { generateRamseyZ3Script } from "./z3_circulant_generator";
import { spawn } from "node:child_process";

export interface Z3SolverOptions {
  timeoutMs?: number;
  pythonBinary?: string;
  symmetry?: 'circulant' | 'paley' | 'block-circulant';
}

export type Z3Result = 
  | { status: 'sat'; adj: AdjacencyMatrix; distanceBits: string; solveTimeMs: number }
  | { status: 'unsat' }
  | { status: 'timeout' }
  | { status: 'error'; message?: string };

export async function isZ3Available(): Promise<boolean> {
  try {
    const { exitCode, stdout } = await new Promise<{exitCode: number, stdout: string}>((resolve) => {
       const proc = spawn("python3", ["-c", "import z3; print('ok')"]);
       let out = "";
       proc.stdout.on("data", (d) => out += d.toString());
       proc.on("close", (code) => resolve({ exitCode: code ?? 1, stdout: out }));
       proc.on("error", () => resolve({ exitCode: 1, stdout: "" }));
    });
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
  const { timeoutMs = 120_000, pythonBinary = "python3", symmetry = 'circulant' } = options;

  const script = generateRamseyZ3Script(N, r, s, symmetry);
  const startTime = Date.now();

  const response = await new Promise<{exitCode: number, stdout: string, stderr: string, timedOut: boolean}>((resolve) => {
      const proc = spawn(pythonBinary, ["-c", script]);
      let out = "";
      let err = "";
      let isTimeout = false;
      proc.stdout.on("data", (d) => out += d.toString());
      proc.stderr.on("data", (d) => err += d.toString());
      
      const timer = setTimeout(() => {
          isTimeout = true;
          proc.kill(9);
      }, timeoutMs);

      proc.on("close", (code) => {
          clearTimeout(timer);
          resolve({ exitCode: code ?? 1, stdout: out, stderr: err, timedOut: isTimeout });
      });
      proc.on("error", (error) => {
          clearTimeout(timer);
          resolve({ exitCode: 1, stdout: out, stderr: error.message, timedOut: false });
      });
  });

  if (response.timedOut) {
     console.error(`[Z3 Native] Timed out after ${timeoutMs}ms for R(${r},${s}) on N=${N}`);
     return { status: 'timeout' };
  }

  const { stdout, stderr, exitCode } = response;
  const solveTimeMs = Date.now() - startTime;
  const outTrimmed = stdout.trim();

  if (exitCode !== 0) {
    console.error(`[Z3 Native] Process error (exit ${exitCode}): ${stderr || outTrimmed}`);
    return { status: 'error', message: stderr || outTrimmed || `exit ${exitCode}` };
  }

    if (outTrimmed === "UNSAT") {
      console.log(`[Z3] UNSAT — no circulant R(${r},${s}) witness exists on N=${N}`);
      return { status: 'unsat' };
    }

    if (outTrimmed.startsWith("ERROR:")) {
      console.error(`[Z3] Solver error: ${outTrimmed}`);
      return { status: 'error', message: outTrimmed };
    }

    // Parse SAT:{bits}
    const match = outTrimmed.match(/^SAT:([01]+)$/);
    if (!match) {
      console.error(`[Z3] Unexpected output: ${outTrimmed}`);
      return { status: 'error', message: `Unexpected output: ${outTrimmed}` };
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
}
