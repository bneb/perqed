/**
 * LNS Solver
 *
 * Orchestrates the Large Neighborhood Search repair step:
 *   1. Extract the violating neighborhood from the SA best graph
 *   2. Generate a Z3 script pinning frozen edges, freeing violated ones
 *   3. Run Z3 and parse the result
 *   4. Return a discriminated LNSResult
 *
 * Generic over (N, r, s) — not specific to R(4,6).
 */

import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import { extractLNSNeighborhood } from "./lns_extractor";
import { generateLNSZ3Script } from "./z3_lns_generator";

// ── Result types ──────────────────────────────────────────────────────────────

export interface LNSSatResult {
  status: "sat";
  /** Repaired adjacency matrix with E=0 */
  adj: AdjacencyMatrix;
  /** Number of free edges Z3 was allowed to recolor */
  freeEdgeCount: number;
  solveTimeMs: number;
}

export interface LNSUnsatResult {
  status: "unsat";
  /** Human-readable description of why this neighborhood was irrecoverable */
  clue: string;
  freeEdgeCount: number;
}

export interface LNSTimeoutResult { status: "timeout" }
export interface LNSErrorResult  { status: "error"; message: string }

export type LNSResult =
  | LNSSatResult
  | LNSUnsatResult
  | LNSTimeoutResult
  | LNSErrorResult;

// ── Options ───────────────────────────────────────────────────────────────────

export interface LNSOptions {
  /** Fraction of total edges to add as random extras (default 5%) */
  extraFreePercent?: number;
  /** Z3 timeout in milliseconds (default 60s) */
  timeoutMs?: number;
  /** Python executable (default "python3") */
  pythonBinary?: string;
}

// ── Main API ──────────────────────────────────────────────────────────────────

/**
 * Attempt to repair an SA-stuck graph via Z3.
 *
 * Extract the conflict neighborhood from `adj`, pin all other edges as frozen
 * constants, and hand the free sub-graph to Z3's CDCL engine.
 *
 * @param adj   The best adjacency matrix from SA (E > 0)
 * @param N     Number of vertices
 * @param r     Red clique size to avoid
 * @param s     Blue clique size to avoid
 * @param opts  Tuning options
 */
export async function runLNS(
  adj: AdjacencyMatrix,
  N: number,
  r: number,
  s: number,
  opts: LNSOptions = {},
): Promise<LNSResult> {
  const {
    extraFreePercent = 0.05,
    timeoutMs = 60_000,
    pythonBinary = "python3",
  } = opts;

  const startTime = Date.now();

  // 1. Extract neighborhood
  const freeEdges = extractLNSNeighborhood(adj, r, s, extraFreePercent);
  const freeEdgeCount = freeEdges.length;

  // 2. Generate Z3 script
  const script = generateLNSZ3Script(N, r, s, adj, freeEdges);
  const tempFile = join(tmpdir(), `perqed_lns_${randomUUID()}.py`);

  try {
    await Bun.write(tempFile, script);

    // 3. Run Z3 with timeout
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
      return { status: "timeout" };
    }

    const { stdout, stderr, exitCode } = race;
    const solveTimeMs = Date.now() - startTime;

    // 4. Parse result
    if (exitCode !== 0) {
      return { status: "error", message: stderr || stdout || `exit ${exitCode}` };
    }

    if (stdout === "UNSAT") {
      return {
        status: "unsat",
        clue: `Z3 UNSAT: neighborhood of ${freeEdgeCount} edges has no valid coloring for R(${r},${s}) on K_${N}`,
        freeEdgeCount,
      };
    }

    if (stdout.startsWith("ERROR:")) {
      return { status: "error", message: stdout };
    }

    // Parse SAT:{json}
    const satMatch = stdout.match(/^SAT:(\[[\s\S]+\])$/);
    if (!satMatch) {
      return { status: "error", message: `Unexpected output: ${stdout.slice(0, 200)}` };
    }

    // Reconstruct AdjacencyMatrix from 2D array (1=red edge, 0=no edge)
    let matrix: number[][];
    try {
      matrix = JSON.parse(satMatch[1]!) as number[][];
    } catch {
      return { status: "error", message: "Failed to parse SAT adjacency JSON" };
    }

    if (matrix.length !== N) {
      return { status: "error", message: `Matrix size ${matrix.length} != N=${N}` };
    }

    const repairedAdj = new AdjacencyMatrix(N);
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if (matrix[i]?.[j] === 1) repairedAdj.addEdge(i, j);
      }
    }

    console.log(`[LNS] SAT in ${solveTimeMs}ms — ${freeEdgeCount} free edges repaired`);
    return { status: "sat", adj: repairedAdj, freeEdgeCount, solveTimeMs };

  } finally {
    try { await unlink(tempFile); } catch {}
  }
}
