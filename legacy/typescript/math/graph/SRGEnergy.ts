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
 * Combinatorial version: iterates all pairs and counts common neighbors.
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

/**
 * Compute SRG energy using the algebraic matrix identity.
 *
 * For SRG(n, k, λ, μ), the identity is:
 *   A² = (λ − μ)A + (k − μ)I + μJ
 *
 * Rearranging: M = A² − (λ − μ)A − (k − μ)I − μJ = 0 elementwise.
 * Energy = Σᵢⱼ Mᵢⱼ² (Frobenius norm of deviation).
 *
 * Since the mutation operator guarantees k-regularity, no degree penalty
 * is needed — degree violations appear naturally in the diagonal of M.
 *
 * This computes A² via matrix multiplication in O(n³), giving all
 * common neighbor counts at once.
 *
 * @param g - The adjacency matrix (must be k-regular for meaningful results)
 * @param k - Target degree (regularity)
 * @param lambda - Target common neighbors for adjacent pairs
 * @param mu - Target common neighbors for non-adjacent pairs
 * @returns Energy value (0 = valid SRG)
 */
export function srgEnergyAlgebraic(
  g: AdjacencyMatrix,
  k: number,
  lambda: number,
  mu: number,
): number {
  const n = g.n;
  const lm = lambda - mu;  // coefficient of A
  const km = k - mu;        // coefficient of I

  let energy = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      // Compute (A²)ᵢⱼ = common neighbors of i,j
      let a2 = 0;
      for (let w = 0; w < n; w++) {
        if (g.hasEdge(i, w) && g.hasEdge(j, w)) a2++;
      }

      // A_ij
      const aij = g.hasEdge(i, j) ? 1 : 0;

      // I_ij
      const iij = i === j ? 1 : 0;

      // M_ij = A² - (λ-μ)A - (k-μ)I - μJ
      const mij = a2 - lm * aij - km * iij - mu;

      // Frobenius contribution (count off-diagonal twice)
      if (i === j) {
        energy += mij * mij;
      } else {
        energy += 2 * mij * mij;
      }
    }
  }

  return energy;
}
