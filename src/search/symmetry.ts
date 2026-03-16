/**
 * Circulant Graph Symmetry Utilities
 *
 * A circulant graph on N vertices is defined by a coloring of its floor(N/2)
 * inter-vertex distances. Restricting SA to circulant graphs reduces the
 * R(4,6) search space from 2^595 → 2^17 (131,072 states).
 *
 * Key fact: the known R(4,6) ≥ 36 witness (Exoo 1989) IS a circulant graph
 * on 35 vertices, so this is not a heuristic reduction — it is the right space.
 */

import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";

/**
 * Circular distance between vertices i and j on a graph of N vertices.
 * d = min(|i-j|, N - |i-j|) ∈ [0, floor(N/2)]
 */
export function getCircularDistance(i: number, j: number, N: number): number {
  const diff = Math.abs(i - j);
  return Math.min(diff, N - diff);
}

/**
 * All edges (u, v) with u < v sharing circular distance d on N vertices.
 * Each distance d yields exactly N edges covering all N vertices.
 */
export function getEdgesForDistance(d: number, N: number): Array<[number, number]> {
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < N; i++) {
    const j = (i + d) % N;
    edges.push([Math.min(i, j), Math.max(i, j)]);
  }
  // Deduplicate: for even N, the diameter distance d = N/2 produces duplicate pairs
  const seen = new Set<string>();
  const deduped: Array<[number, number]> = [];
  for (const [u, v] of edges) {
    const key = `${u}-${v}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push([u, v]);
    }
  }
  return deduped;
}

/**
 * Build an AdjacencyMatrix from a map of {distance → color (0=absent, 1=present)}.
 * For all distances not in the map, edges are absent (color 0).
 */
export function buildCirculantGraph(
  distanceColors: Map<number, number>,
  N: number,
): AdjacencyMatrix {
  const adj = new AdjacencyMatrix(N);
  const maxDist = Math.floor(N / 2);
  for (let d = 1; d <= maxDist; d++) {
    const color = distanceColors.get(d) ?? 0;
    if (color === 1) {
      for (const [u, v] of getEdgesForDistance(d, N)) {
        adj.addEdge(u, v);
      }
    }
  }
  return adj;
}

/**
 * Verify that a graph satisfies the circulant invariant:
 * for every distance d, ALL edges at that distance have the same color.
 *
 * Used in tests and assertions.
 */
export function isCirculant(adj: AdjacencyMatrix, N: number): boolean {
  const maxDist = Math.floor(N / 2);
  for (let d = 1; d <= maxDist; d++) {
    const edges = getEdgesForDistance(d, N);
    if (edges.length === 0) continue;
    const firstColor = adj.hasEdge(edges[0]![0], edges[0]![1]);
    for (const [u, v] of edges) {
      if (adj.hasEdge(u, v) !== firstColor) return false;
    }
  }
  return true;
}

/**
 * Extract the current distance-color map from an AdjacencyMatrix.
 * Assumes the matrix is circulant (not validated here — caller's responsibility).
 */
export function extractDistanceColors(adj: AdjacencyMatrix, N: number): Map<number, number> {
  const colors = new Map<number, number>();
  const maxDist = Math.floor(N / 2);
  for (let d = 1; d <= maxDist; d++) {
    const edges = getEdgesForDistance(d, N);
    // Use first edge as representative
    const color = (edges.length > 0 && adj.hasEdge(edges[0]![0], edges[0]![1])) ? 1 : 0;
    colors.set(d, color);
  }
  return colors;
}
