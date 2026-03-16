/**
 * LNS Neighborhood Extractor
 *
 * Identifies edges involved in monochromatic cliques (the "violating neighborhood")
 * and optionally adds a random sample of clean edges to give Z3 breathing room.
 *
 * Generic over (r, s) — works for any Ramsey problem, not just R(4,6).
 */

import type { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";

// ── Shared combinations iterator ────────────────────────────────────────────

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

function edgeKey(u: number, v: number): string {
  return u < v ? `${u}_${v}` : `${v}_${u}`;
}

// ── Core: find all edges in violated cliques ─────────────────────────────────

/**
 * Find every edge that participates in a monochromatic K_r (red) or K_s (blue).
 * Returns deduplicated [u, v] pairs with u < v (canonical form).
 */
export function extractViolatingEdges(
  adj: AdjacencyMatrix,
  r: number,
  s: number,
): [number, number][] {
  const N = adj.n;
  const violating = new Set<string>();

  // Red K_r: find all r-subsets where every pair has an edge
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
      for (let i = 0; i < r; i++) {
        for (let j = i + 1; j < r; j++) {
          violating.add(edgeKey(combo[i]!, combo[j]!));
        }
      }
    }
  }

  // Blue K_s: find all s-subsets where no pair has an edge (independent set)
  for (const combo of combinations(N, s)) {
    let isBlueClique = true;
    for (let i = 0; i < s && isBlueClique; i++) {
      for (let j = i + 1; j < s; j++) {
        if (adj.hasEdge(combo[i]!, combo[j]!)) {
          isBlueClique = false;
          break;
        }
      }
    }
    if (isBlueClique) {
      for (let i = 0; i < s; i++) {
        for (let j = i + 1; j < s; j++) {
          violating.add(edgeKey(combo[i]!, combo[j]!));
        }
      }
    }
  }

  return Array.from(violating).map((key) => {
    const [u, v] = key.split("_").map(Number);
    return [u!, v!] as [number, number];
  });
}

// ── Public API: extract LNS neighborhood ─────────────────────────────────────

/**
 * Build the free-edge neighborhood for an LNS step:
 *   1. All edges in monochromatic cliques (the violations)
 *   2. + extraFreePercent × totalEdges random "clean" edges (breathing room for Z3)
 *
 * @param extraFreePercent  Fraction of total edges to add as random extras (default 5%)
 * @returns Deduplicated list of [u, v] pairs (u < v) that Z3 may freely color.
 */
export function extractLNSNeighborhood(
  adj: AdjacencyMatrix,
  r: number,
  s: number,
  extraFreePercent = 0.05,
): [number, number][] {
  const N = adj.n;
  const freeSet = new Set<string>();

  // Start with violating edges
  for (const [u, v] of extractViolatingEdges(adj, r, s)) {
    freeSet.add(edgeKey(u, v));
  }

  // Add random clean edges for breathing room
  const totalEdges = (N * (N - 1)) / 2;
  const target = Math.floor(totalEdges * extraFreePercent);
  const baseSize = freeSet.size;
  let attempts = 0;
  const maxAttempts = target * 20 + 100;

  while (freeSet.size < baseSize + target && attempts < maxAttempts) {
    const u = Math.floor(Math.random() * N);
    const v = Math.floor(Math.random() * N);
    attempts++;
    if (u !== v) freeSet.add(edgeKey(Math.min(u, v), Math.max(u, v)));
  }

  return Array.from(freeSet).map((key) => {
    const [u, v] = key.split("_").map(Number);
    return [u!, v!] as [number, number];
  });
}
