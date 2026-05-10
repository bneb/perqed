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
  /** Z3 executable (default "z3") */
  z3Binary?: string;
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
    z3Binary = "z3",
  } = opts;

  const startTime = Date.now();

  // 1. Extract neighborhood
  const freeEdges = extractLNSNeighborhood(adj, r, s, extraFreePercent);
  const freeEdgeCount = freeEdges.length;

  // 2. Generate Z3 script
  const script = generateLNSZ3Script(N, r, s, adj, freeEdges);
  const tempFile = join(tmpdir(), `perqed_lns_${randomUUID()}.smt2`);

  try {
    await Bun.write(tempFile, script);

    // 3. Run Z3 with timeout
    const proc = Bun.spawn([z3Binary, "-smt2", tempFile], {
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

    if (stdout.startsWith("unsat") || stdout === "UNSAT") {
      return {
        status: "unsat",
        clue: `Z3 UNSAT: neighborhood of ${freeEdgeCount} edges has no valid coloring for R(${r},${s}) on K_${N}`,
        freeEdgeCount,
      };
    }

    if (!stdout.startsWith("sat")) {
      return { status: "error", message: `Unexpected output: ${stdout.slice(0, 200)}` };
    }

    // 5. Parse SAT model
    const repairedAdj = new AdjacencyMatrix(N);
    // Start with a clone of the original broken graph
    for (let u = 0; u < N; u++) {
      for (let v = u + 1; v < N; v++) {
        if (adj.hasEdge(u, v)) repairedAdj.addEdge(u, v);
      }
    }

    // Apply Z3 patches via regex over SMT-LIB2 output
    const valueMatches = stdout.matchAll(/\(e_(\d+)_(\d+)\s+(true|false)\)/g);
    for (const match of valueMatches) {
      const u = parseInt(match[1]!, 10);
      const v = parseInt(match[2]!, 10);
      if (match[3] === "true") repairedAdj.addEdge(u, v);
      else repairedAdj.removeEdge(u, v);
    }

    console.log(`[LNS] SAT in ${solveTimeMs}ms — ${freeEdgeCount} free edges repaired`);
    return { status: "sat", adj: repairedAdj, freeEdgeCount, solveTimeMs };

  } finally {
    try { await unlink(tempFile); } catch {}
  }
}
