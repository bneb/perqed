/**
 * SRGEnergy — Parameterized energy function for Strongly Regular Graphs.
 *
 * Given target parameters (k, λ, μ), computes:
 *   E = Σ_{u~v} (commonNeighbors(u,v) - λ)²
 *     + Σ_{u≁v} (commonNeighbors(u,v) - μ)²
 *     + degree penalty
 *
 * E = 0 iff the graph is SRG(n, k, λ, μ).
 *
 * Reusable for ANY strongly regular graph parameter set.
 */

import { AdjacencyMatrix } from "./AdjacencyMatrix";

/**
 * Count common neighbors of vertices u and v.
 */
export function commonNeighborCount(
  g: AdjacencyMatrix,
  u: number,
  v: number,
): number {
  let count = 0;
  for (let w = 0; w < g.n; w++) {
    if (g.hasEdge(u, w) && g.hasEdge(v, w)) count++;
  }
  return count;
}

/**
 * Compute SRG energy for the given adjacency matrix and target parameters.
 *
 * @param g - The adjacency matrix
 * @param k - Target degree (regularity)
 * @param lambda - Target common neighbors for adjacent pairs
 * @param mu - Target common neighbors for non-adjacent pairs
 * @returns Energy value (0 = valid SRG)
 */
export function srgEnergy(
  g: AdjacencyMatrix,
  k: number,
  lambda: number,
  mu: number,
): number {
  let energy = 0;

  // Degree penalty: penalize any vertex whose degree ≠ k
  for (let v = 0; v < g.n; v++) {
    const d = g.degree(v);
    energy += (d - k) * (d - k);
  }

  // Common neighbor penalty for all distinct pairs
  for (let u = 0; u < g.n; u++) {
    for (let v = u + 1; v < g.n; v++) {
      const c = commonNeighborCount(g, u, v);
      if (g.hasEdge(u, v)) {
        energy += (c - lambda) * (c - lambda);
      } else {
        energy += (c - mu) * (c - mu);
      }
    }
  }

  return energy;
}
