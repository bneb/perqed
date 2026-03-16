/**
 * RamseyEnergy — Count monochromatic cliques for Ramsey number search.
 *
 * For R(r,s) lower bound search on n vertices:
 *   E = (# red K_r cliques) + (# blue K_s independent sets)
 *   E = 0 iff the graph is a valid Ramsey witness.
 *
 * "Red" = edge present (hasEdge = true)
 * "Blue" = edge absent (hasEdge = false)
 */

import type { AdjacencyMatrix } from "./AdjacencyMatrix";

// ──────────────────────────────────────────────
// Naive Full Recompute: O(C(n,r) + C(n,s))
// ──────────────────────────────────────────────

/**
 * Count cliques of size `k` in the graph (red = edges present).
 * Iterates over all C(n,k) subsets.
 */
export function countCliques(adj: AdjacencyMatrix, k: number): number {
  const n = adj.n;
  if (k > n) return 0;
  if (k <= 1) return k === 1 ? n : 1;

  let count = 0;
  const combo = new Int32Array(k);

  // Generate all k-subsets via iterative combinatorial enumeration
  for (let i = 0; i < k; i++) combo[i] = i;

  outer: while (true) {
    // Check if combo forms a clique (all pairs have edges)
    let isClique = true;
    for (let i = 0; i < k && isClique; i++) {
      for (let j = i + 1; j < k; j++) {
        if (!adj.hasEdge(combo[i]!, combo[j]!)) {
          isClique = false;
          break;
        }
      }
    }
    if (isClique) count++;

    // Advance to next k-subset
    let i = k - 1;
    combo[i]!++;
    while (combo[i]! > n - k + i) {
      i--;
      if (i < 0) break outer;
      combo[i]!++;
    }
    for (let j = i + 1; j < k; j++) {
      combo[j] = combo[j - 1]! + 1;
    }
  }

  return count;
}

/**
 * Count independent sets of size `k` (blue = edges absent).
 * An independent set is a clique in the complement graph.
 */
export function countIndependentSets(adj: AdjacencyMatrix, k: number): number {
  const n = adj.n;
  if (k > n) return 0;
  if (k <= 1) return k === 1 ? n : 1;

  let count = 0;
  const combo = new Int32Array(k);

  for (let i = 0; i < k; i++) combo[i] = i;

  outer: while (true) {
    // Check if combo forms an independent set (no edges between any pair)
    let isIndSet = true;
    for (let i = 0; i < k && isIndSet; i++) {
      for (let j = i + 1; j < k; j++) {
        if (adj.hasEdge(combo[i]!, combo[j]!)) {
          isIndSet = false;
          break;
        }
      }
    }
    if (isIndSet) count++;

    // Advance to next k-subset
    let i = k - 1;
    combo[i]!++;
    while (combo[i]! > n - k + i) {
      i--;
      if (i < 0) break outer;
      combo[i]!++;
    }
    for (let j = i + 1; j < k; j++) {
      combo[j] = combo[j - 1]! + 1;
    }
  }

  return count;
}

/**
 * Full Ramsey energy: E = (# red K_r) + (# blue K_s).
 * E = 0 iff the graph is a valid R(r,s) witness.
 */
export function ramseyEnergy(adj: AdjacencyMatrix, r: number, s: number): number {
  return countCliques(adj, r) + countIndependentSets(adj, s);
}

// ──────────────────────────────────────────────
// Incremental Delta on Edge Flip
// ──────────────────────────────────────────────

/**
 * Compute the change in Ramsey energy if edge (u,v) is flipped.
 *
 * When flipping (u,v):
 *   - Only cliques/independent-sets containing BOTH u and v are affected
 *   - For K_r: enumerate (r-2)-subsets from V\{u,v}, check if all edges present
 *   - For K_s: enumerate (s-2)-subsets from V\{u,v}, check if all edges absent
 *
 * Returns the delta: newEnergy - oldEnergy.
 * Positive = flip makes things worse, negative = flip improves.
 */
export function ramseyEnergyDelta(
  adj: AdjacencyMatrix,
  u: number,
  v: number,
  r: number,
  s: number,
): number {
  const edgePresent = adj.hasEdge(u, v);

  // Count how many r-cliques currently contain (u,v) — only possible if edge exists
  // Count how many s-independent-sets currently contain (u,v) — only possible if edge absent
  let cliquesBefore = 0;
  let indSetsBefore = 0;

  if (edgePresent) {
    // (u,v) is an edge → it can participate in red K_r cliques
    // After flip, (u,v) becomes non-edge → it can participate in blue K_s ind-sets
    cliquesBefore = countSubsetsContainingEdge(adj, u, v, r, true);
    // After flip: count potential new independent sets
    // We temporarily flip, count, then flip back
  } else {
    // (u,v) is not an edge → it can participate in blue K_s independent sets
    indSetsBefore = countSubsetsContainingEdge(adj, u, v, s, false);
    // After flip: count potential new cliques
  }

  // Temporarily flip
  if (edgePresent) {
    adj.removeEdge(u, v);
  } else {
    adj.addEdge(u, v);
  }

  let cliquesAfter = 0;
  let indSetsAfter = 0;

  if (edgePresent) {
    // Was edge, now non-edge: count new independent sets containing (u,v)
    indSetsAfter = countSubsetsContainingEdge(adj, u, v, s, false);
  } else {
    // Was non-edge, now edge: count new cliques containing (u,v)
    cliquesAfter = countSubsetsContainingEdge(adj, u, v, r, true);
  }

  // Flip back
  if (edgePresent) {
    adj.addEdge(u, v);
  } else {
    adj.removeEdge(u, v);
  }

  const deltaCl = cliquesAfter - cliquesBefore;
  const deltaIn = indSetsAfter - indSetsBefore;
  return deltaCl + deltaIn;
}

/**
 * Count (k)-subsets of V that include both u and v, where all pairs
 * in the subset satisfy the edge condition.
 *
 * @param wantEdge - true = looking for cliques (all edges present),
 *                   false = looking for independent sets (no edges)
 */
function countSubsetsContainingEdge(
  adj: AdjacencyMatrix,
  u: number,
  v: number,
  k: number,
  wantEdge: boolean,
): number {
  if (k < 2) return 0;
  if (k === 2) return 1; // The pair {u,v} itself

  const n = adj.n;
  const need = k - 2; // How many more vertices we need

  // Build candidate list: vertices connected to both u and v (for cliques)
  // or not connected to either (for independent sets, but need pairwise check)
  // Actually, for correctness we need ALL vertices != u,v, then check subset validity.
  // But we can prune: a vertex w can join the subset only if:
  //   - wantEdge: w-u edge AND w-v edge exist
  //   - !wantEdge: w-u edge AND w-v edge both absent
  const candidates: number[] = [];
  for (let w = 0; w < n; w++) {
    if (w === u || w === v) continue;
    const euW = adj.hasEdge(u, w);
    const evW = adj.hasEdge(v, w);
    if (wantEdge && euW && evW) {
      candidates.push(w);
    } else if (!wantEdge && !euW && !evW) {
      candidates.push(w);
    }
  }

  if (candidates.length < need) return 0;

  // Enumerate all `need`-subsets from candidates, check pairwise
  let count = 0;
  const combo = new Int32Array(need);

  for (let i = 0; i < need; i++) combo[i] = i;

  outer: while (true) {
    // Check pairwise edges within the candidate subset
    let valid = true;
    for (let i = 0; i < need && valid; i++) {
      for (let j = i + 1; j < need; j++) {
        const has = adj.hasEdge(candidates[combo[i]!]!, candidates[combo[j]!]!);
        if (has !== wantEdge) {
          valid = false;
          break;
        }
      }
    }
    if (valid) count++;

    // Advance
    let i = need - 1;
    combo[i]!++;
    while (combo[i]! > candidates.length - need + i) {
      i--;
      if (i < 0) break outer;
      combo[i]!++;
    }
    for (let j = i + 1; j < need; j++) {
      combo[j] = combo[j - 1]! + 1;
    }
  }

  return count;
}

// ──────────────────────────────────────────────
// Convenience: flip + accept/reject
// ──────────────────────────────────────────────

/**
 * Flip edge (u,v) — toggle between present and absent.
 */
export function flipEdge(adj: AdjacencyMatrix, u: number, v: number): void {
  if (adj.hasEdge(u, v)) {
    adj.removeEdge(u, v);
  } else {
    adj.addEdge(u, v);
  }
}

// ──────────────────────────────────────────────
// Batch Delta: for Circulant Mutations
// ──────────────────────────────────────────────

/**
 * Compute the energy delta if all edges in `edges` are simultaneously flipped.
 *
 * Used for circulant SA where a distance-mutation flips N edges at once.
 *
 * Strategy: full recompute before and after — apply all flips, measure
 * newEnergy - oldEnergy, then roll back every flip.
 *
 * ⚠️  SCALABILITY WARNING — Do NOT use this on large unconstrained searches.
 *
 * Actual recompute cost for R(4,6) on N=35:
 *   C(35,4) = 52,360  (red K_4 cliques)
 *   C(35,6) = 1,623,160  (blue K_6 independent sets)
 *   Total = ~1.675 MILLION ops per call (not the ~50K originally estimated — off by 30x)
 *
 * This is only acceptable here because the circulant search space is 2^17 (131,072
 * states), so SA converges in hundreds to low-thousands of steps regardless.
 * At 1.675M ops/step, a thousand steps = ~1.675B ops = a few seconds. Survivable.
 *
 * For any larger graph or unconstrained search, implement a proper incremental
 * batch delta that maintains a clique-count data structure across multi-edge flips.
 *
 * @returns delta = newEnergy - oldEnergy (negative = improvement)
 */
export function ramseyEnergyDeltaBatch(
  adj: AdjacencyMatrix,
  edges: Array<[number, number]>,
  r: number,
  s: number,
): number {
  const oldEnergy = ramseyEnergy(adj, r, s);

  // Apply all flips
  for (const [u, v] of edges) flipEdge(adj, u, v);

  const newEnergy = ramseyEnergy(adj, r, s);

  // Roll back all flips — caller decides whether to keep or discard
  for (const [u, v] of edges) flipEdge(adj, u, v);

  return newEnergy - oldEnergy;
}

