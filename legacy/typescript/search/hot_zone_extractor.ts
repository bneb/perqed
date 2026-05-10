/**
 * Hot Zone Extractor
 *
 * Identifies the set of vertex IDs that participate in at least one
 * monochromatic violation (red K_r clique or blue K̄_s independent set).
 * These "hot" vertices form the localized sub-problem passed to MicroSATPatcher.
 *
 * Design principles:
 *   - Vertex-level (not edge-level) — tighter scope than LNS neighborhood
 *   - O(C(n,r) + C(n,s)) scan — acceptable for n≤35, r=4, s=6
 *   - Hard limit: if hot zone > hotZoneLimit, mark isValidForSAT=false
 *     (sub-problem too large for instant SMT resolution)
 */

import type { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ViolationZone {
  /** Vertex IDs involved in ≥1 violated clique. Z3 variables. */
  hotVertices: Set<number>;
  /** Vertex IDs in no violation. Z3 constants (frozen). */
  frozenVertices: Set<number>;
  /**
   * true iff hotVertices.size <= hotZoneLimit.
   * When false, the sub-problem is too large for instant SMT resolution;
   * the MicroSATPatcher should return 'skipped'.
   */
  isValidForSAT: boolean;
}

// ── Internals ─────────────────────────────────────────────────────────────────

function* combinations(n: number, r: number): Generator<number[]> {
  if (r > n) return;
  const combo = Array.from({ length: r }, (_, i) => i);
  while (true) {
    yield [...combo];
    let i = r - 1;
    while (i >= 0 && combo[i]! === n - r + i) i--;
    if (i < 0) break;
    combo[i]!++;
    for (let j = i + 1; j < r; j++) combo[j] = combo[j - 1]! + 1;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract the hot zone: vertex IDs involved in any monochromatic violation.
 *
 * @param adj           Current adjacency matrix
 * @param r             Red clique size to avoid
 * @param s             Blue independent set size to avoid
 * @param hotZoneLimit  Max hot vertices before isValidForSAT=false (default 16)
 */
export function extractHotZone(
  adj: AdjacencyMatrix,
  r: number,
  s: number,
  hotZoneLimit = 16,
): ViolationZone {
  const N = adj.n;
  const hotVertices = new Set<number>();

  // ── Red K_r violations ────────────────────────────────────────────────────
  for (const combo of combinations(N, r)) {
    let isRedClique = true;
    for (let i = 0; i < r && isRedClique; i++) {
      for (let j = i + 1; j < r; j++) {
        if (!adj.hasEdge(combo[i]!, combo[j]!)) {
          isRedClique = false;
          break;
        }
      }
    }
    if (isRedClique) {
      for (const v of combo) hotVertices.add(v);
    }
  }

  // ── Blue K̄_s violations (independent sets) ───────────────────────────────
  for (const combo of combinations(N, s)) {
    let isIndepSet = true;
    for (let i = 0; i < s && isIndepSet; i++) {
      for (let j = i + 1; j < s; j++) {
        if (adj.hasEdge(combo[i]!, combo[j]!)) {
          isIndepSet = false;
          break;
        }
      }
    }
    if (isIndepSet) {
      for (const v of combo) hotVertices.add(v);
    }
  }

  // ── Frozen vertices: complement of hot ───────────────────────────────────
  const frozenVertices = new Set<number>();
  for (let v = 0; v < N; v++) {
    if (!hotVertices.has(v)) frozenVertices.add(v);
  }

  return {
    hotVertices,
    frozenVertices,
    isValidForSAT: hotVertices.size <= hotZoneLimit,
  };
}

// ── Heat-Map Ranking ──────────────────────────────────────────────────────────

/**
 * Compute a per-vertex violation entanglement score:
 * the number of violated cliques each vertex participates in.
 *
 * Higher score = more entangled = a better candidate for the hot zone.
 * Vertices with score=0 are clean (frozen).
 */
export function computeVertexHeatMap(
  adj: AdjacencyMatrix,
  r: number,
  s: number,
): Map<number, number> {
  const N = adj.n;
  const scores = new Map<number, number>();
  for (let v = 0; v < N; v++) scores.set(v, 0);

  // Red K_r violations
  for (const combo of combinations(N, r)) {
    let isRedClique = true;
    for (let i = 0; i < r && isRedClique; i++) {
      for (let j = i + 1; j < r; j++) {
        if (!adj.hasEdge(combo[i]!, combo[j]!)) { isRedClique = false; break; }
      }
    }
    if (isRedClique) {
      for (const v of combo) scores.set(v, (scores.get(v) ?? 0) + 1);
    }
  }

  // Blue K̄_s violations
  for (const combo of combinations(N, s)) {
    let isIndepSet = true;
    for (let i = 0; i < s && isIndepSet; i++) {
      for (let j = i + 1; j < s; j++) {
        if (adj.hasEdge(combo[i]!, combo[j]!)) { isIndepSet = false; break; }
      }
    }
    if (isIndepSet) {
      for (const v of combo) scores.set(v, (scores.get(v) ?? 0) + 1);
    }
  }

  return scores;
}

/**
 * Extract a hot zone using heat-map ranking rather than union membership.
 *
 * Selects the top-H vertices by entanglement score (violation participation count).
 * This is more targeted than extractHotZone (which takes ALL violating vertices)
 * and bounds the variable count to exactly H regardless of total violation spread.
 *
 * @param adj           Current adjacency matrix
 * @param r             Red clique size to avoid
 * @param s             Blue independent set size to avoid
 * @param topH          Number of hottest vertices to select (default 10)
 */
export function extractTopHotZone(
  adj: AdjacencyMatrix,
  r: number,
  s: number,
  topH = 10,
): ViolationZone {
  const N = adj.n;
  const heatMap = computeVertexHeatMap(adj, r, s);

  // Sort by score descending, break ties by vertex index
  const ranked = Array.from(heatMap.entries())
    .filter(([, score]) => score > 0)
    .sort(([av, as_], [bv, bs]) => bs - as_ || av - bv)
    .slice(0, topH);

  const hotVertices = new Set<number>(ranked.map(([v]) => v));
  const frozenVertices = new Set<number>();
  for (let v = 0; v < N; v++) {
    if (!hotVertices.has(v)) frozenVertices.add(v);
  }

  return {
    hotVertices,
    frozenVertices,
    isValidForSAT: hotVertices.size <= topH && hotVertices.size > 0,
  };
}
