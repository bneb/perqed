/**
 * frozen_core.ts — Greedy Frozen Core finder.
 *
 * Identifies the largest "perfect" subgraph (E=0 internally) inside a
 * low-energy Ramsey matrix. The algorithm:
 *   1. Start with V = all vertices.
 *   2. Compute localVertexEnergy for every v ∈ V.
 *   3. Remove the highest-energy vertex.
 *   4. Repeat until subgraphEnergy(V) === 0.
 *
 * The remaining V is the "Frozen Core" — vertices whose internal edges
 * are already clique-free. Mutations should only touch edges incident
 * to at least one FREE vertex (the "crust").
 */

import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import { ramseyEnergy } from "../math/graph/RamseyEnergy";

export interface FrozenCoreResult {
  /** Vertices whose internal edges form an E=0 subgraph (the "core"). */
  lockedVertices: number[];
  /** Vertices removed during peeling — the "crust" to optimise. */
  freeVertices: number[];
  /** Ramsey energy of the induced subgraph on lockedVertices (always 0). */
  coreEnergy: number;
}

// ── Subgraph Energy ────────────────────────────────────────────────────────────

/**
 * Compute Ramsey energy of the induced subgraph on `vertices`.
 *
 * Builds a temporary |vertices|-vertex adjacency matrix and calls
 * ramseyEnergy.  O(k^r + k^s) where k = |vertices|.
 */
export function subgraphEnergy(
  adj: AdjacencyMatrix,
  vertices: readonly number[],
  r: number,
  s: number
): number {
  const k = vertices.length;
  if (k === 0) return 0;

  // Map original indices to [0..k-1]
  const sub = new AdjacencyMatrix(k);
  for (let a = 0; a < k; a++) {
    for (let b = a + 1; b < k; b++) {
      if (adj.hasEdge(vertices[a]!, vertices[b]!)) {
        sub.addEdge(a, b);
      }
    }
  }
  return ramseyEnergy(sub, r, s);
}

// ── Local Vertex Energy ────────────────────────────────────────────────────────

/**
 * How much of the current subgraph energy is "owned" by vertex `v`?
 *
 * We estimate this as:
 *   localEnergy(v) = subgraphEnergy(V) − subgraphEnergy(V \ {v})
 *
 * This is the marginal energy reduction from removing v — it counts
 * exactly the cliques that include v.  O(|V|^r + |V|^s) per call.
 */
export function localVertexEnergy(
  adj: AdjacencyMatrix,
  v: number,
  vertices: readonly number[],
  r: number,
  s: number
): number {
  const withV = subgraphEnergy(adj, vertices, r, s);
  const withoutV = subgraphEnergy(adj, vertices.filter((x) => x !== v), r, s);
  return Math.max(0, withV - withoutV);
}

// ── Greedy Core Finder ─────────────────────────────────────────────────────────

/**
 * Find the largest zero-energy induced subgraph via iterative vertex peeling.
 *
 * At each step removes the vertex with the highest marginal energy
 * contribution until the remaining subgraph is clique-free (E=0).
 */
export function findFrozenCore(
  adj: AdjacencyMatrix,
  r: number,
  s: number
): FrozenCoreResult {
  let candidates: number[] = Array.from({ length: adj.n }, (_, i) => i);
  const peeled: number[] = [];

  while (true) {
    const currentEnergy = subgraphEnergy(adj, candidates, r, s);
    if (currentEnergy === 0) break;
    if (candidates.length === 0) break;

    // Find highest-marginal-energy vertex
    let worstVertex = candidates[0]!;
    let worstEnergy = -1;

    for (const v of candidates) {
      const contribution = localVertexEnergy(adj, v, candidates, r, s);
      if (contribution > worstEnergy) {
        worstEnergy = contribution;
        worstVertex = v;
      }
    }

    // Remove the worst vertex
    candidates = candidates.filter((v) => v !== worstVertex);
    peeled.push(worstVertex);
  }

  return {
    lockedVertices: candidates,
    freeVertices: peeled,
    coreEnergy: 0,
  };
}
