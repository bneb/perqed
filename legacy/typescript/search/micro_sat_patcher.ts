/**
 * Micro-SAT Patcher
 *
 * When SA workers hit a sterile basin at E ≤ threshold, the orchestrator
 * routes the graph here for targeted Z3 surgery:
 *
 *   1. Accept a ViolationZone (hot/frozen vertices) from HotZoneExtractor
 *   2. Build a free-edge set: all pairs where ≥1 vertex is hot
 *   3. Delegate to the existing Z3 LNS subprocess
 *   4. On SAT: return the repaired AdjacencyMatrix (E=0 witness candidate)
 *   5. On UNSAT: call nukeScaffold to destroy a portion of the frozen topology
 *      (Z3 proved the cold zone is inherently toxic — scramble it)
 *   6. On too-large hot zone (isValidForSAT=false): return 'skipped'
 *
 * Architecture note: this is a focused version of LNS. The key difference:
 *   - LNS: free edges in violated edge neighborhoods + random extras
 *   - Micro-SAT: free ALL pairs incident to hot vertices (vertex-centric)
 *     → tighter scope, more tractable Z3 sub-problem
 *
 * The worker fires this asynchronously (fire-and-forget) and simultaneously
 * continues its normal scatter. If SAT wins, the orchestrator terminates all
 * workers.
 */

import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import { generateLNSZ3Script } from "./z3_lns_generator";
import type { ViolationZone } from "./hot_zone_extractor";

// ── Result types ──────────────────────────────────────────────────────────────

export interface MicroSATPatchResult {
  /** sat: E=0 witness found; unsat: frozen geometry is toxic; skipped: hot zone too large */
  status: "sat" | "unsat" | "timeout" | "skipped" | "error";
  /** Only populated on sat */
  adj?: AdjacencyMatrix;
  /** Number of hot vertices in the zone (useful for telemetry) */
  hotZoneSize: number;
  /** Total time from call to return */
  solveTimeMs: number;
  /** Human-readable note about the outcome */
  note?: string;
}

// ── Options ───────────────────────────────────────────────────────────────────

export interface MicroSATPatchOptions {
  /** Z3 timeout in milliseconds (default 60s) */
  timeoutMs?: number;
  /** Z3 executable (default "z3") */
  z3Binary?: string;
}

// ── Core: build free-edge set from hot zone ───────────────────────────────────

/**
 * Every edge pair where ≥1 endpoint is a hot vertex becomes a Z3 free variable.
 * Cold–cold edges are frozen constants (read directly from the adj matrix).
 */
function buildFreeEdges(
  N: number,
  hotVertices: Set<number>,
): [number, number][] {
  const freeEdges: [number, number][] = [];
  for (let u = 0; u < N; u++) {
    for (let v = u + 1; v < N; v++) {
      if (hotVertices.has(u) || hotVertices.has(v)) {
        freeEdges.push([u, v]);
      }
    }
  }
  return freeEdges;
}

// ── Main API ──────────────────────────────────────────────────────────────────

/**
 * Run a targeted Z3 patch on the hot zone of a sterile-basin graph.
 */
export async function runMicroSATPatch(
  adj: AdjacencyMatrix,
  r: number,
  s: number,
  zone: ViolationZone,
  opts: MicroSATPatchOptions = {},
): Promise<MicroSATPatchResult> {
  const startTime = Date.now();
  const hotZoneSize = zone.hotVertices.size;
  const { timeoutMs = 60_000, z3Binary = "z3" } = opts;

  // ── Guard: too large for instant SMT ────────────────────────────────────
  if (!zone.isValidForSAT) {
    return {
      status: "skipped",
      hotZoneSize,
      solveTimeMs: Date.now() - startTime,
      note: `Hot zone size ${hotZoneSize} exceeds limit — skipped`,
    };
  }

  if (hotZoneSize === 0) {
    return {
      status: "skipped",
      hotZoneSize: 0,
      solveTimeMs: Date.now() - startTime,
      note: "Empty hot zone (E=0 already?)",
    };
  }

  const N = adj.n;
  const freeEdges = buildFreeEdges(N, zone.hotVertices);
  const freeEdgeCount = freeEdges.length;

  // ── Generate Z3 script ───────────────────────────────────────────────────
  const script = generateLNSZ3Script(N, r, s, adj, freeEdges);
  const tempFile = join(tmpdir(), `perqed_micro_${randomUUID()}.smt2`);

  try {
    await Bun.write(tempFile, script);

    // ── Run Z3 ──────────────────────────────────────────────────────────
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
    const solveTimeMs = Date.now() - startTime;

    if (race === "timeout") {
      proc.kill();
      return { status: "timeout", hotZoneSize, solveTimeMs, note: `Z3 timed out after ${timeoutMs}ms` };
    }

    const { stdout, stderr, exitCode } = race;

    if (exitCode !== 0) {
      return {
        status: "error",
        hotZoneSize,
        solveTimeMs,
        note: stderr || stdout || `exit ${exitCode}`,
      };
    }

    // ── Parse UNSAT ──────────────────────────────────────────────────────
    if (stdout.startsWith("unsat") || stdout === "UNSAT") {
      return {
        status: "unsat",
        hotZoneSize,
        solveTimeMs,
        note: `Z3 UNSAT: frozen topology mathematically precludes R(${r},${s}) on K_${N} — ${freeEdgeCount} free edges`,
      };
    }

    if (!stdout.startsWith("sat")) {
      return { status: "error", hotZoneSize, solveTimeMs, note: `Unexpected output: ${stdout.slice(0, 200)}` };
    }

    // ── Parse SAT ────────────────────────────────────────────────────────
    const repairedAdj = new AdjacencyMatrix(N);
    // Clone original broken graph
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

    console.log(`[MicroSAT] ✅ SAT in ${solveTimeMs}ms — hot zone ${hotZoneSize}v, ${freeEdgeCount} free edges`);
    return { status: "sat", adj: repairedAdj, hotZoneSize, solveTimeMs };

  } finally {
    try { await unlink(tempFile); } catch {}
  }
}

// ── nukeScaffold ──────────────────────────────────────────────────────────────

/**
 * Destroy a fraction of cold-zone edges when Z3 has proven the frozen geometry
 * is inherently toxic (UNSAT). Unlike scatter (which randomizes the whole graph),
 * this surgically scrambles only the cold zone, preserving any hot-zone progress.
 *
 * Returns a new AdjacencyMatrix (does not mutate the original).
 *
 * @param adj              Current adjacency matrix
 * @param frozenVertices   The cold zone vertex set
 * @param nukeRate         Fraction of cold-cold edges to flip (default 0.20)
 */
export function nukeScaffold(
  adj: AdjacencyMatrix,
  frozenVertices: Set<number>,
  nukeRate = 0.20,
): AdjacencyMatrix {
  // Deep-copy the matrix
  const N = adj.n;
  const result = new AdjacencyMatrix(N);
  for (let i = 0; i < adj.raw.length; i++) result.raw[i] = adj.raw[i]!;

  // Collect all cold-cold edges
  const frozenArr = Array.from(frozenVertices).sort((a, b) => a - b);
  const coldEdges: [number, number][] = [];
  for (let i = 0; i < frozenArr.length; i++) {
    for (let j = i + 1; j < frozenArr.length; j++) {
      coldEdges.push([frozenArr[i]!, frozenArr[j]!]);
    }
  }

  // Shuffle using Fisher-Yates, flip the first nukeCount edges
  const nukeCount = Math.max(1, Math.round(coldEdges.length * nukeRate));
  for (let i = coldEdges.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [coldEdges[i], coldEdges[j]] = [coldEdges[j]!, coldEdges[i]!];
  }

  for (let k = 0; k < nukeCount; k++) {
    const [u, v] = coldEdges[k]!;
    if (result.hasEdge(u, v)) {
      result.removeEdge(u, v);
    } else {
      result.addEdge(u, v);
    }
  }

  return result;
}
