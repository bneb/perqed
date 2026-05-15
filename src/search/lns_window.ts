import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import { ekey } from "./z3_clause_generator";

/** Reusable type for a monochromatic clique identified by the energy function */
export type Clique = number[];

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

export function extractCliques(adj: AdjacencyMatrix, r: number, s: number): Clique[] {
  const cliques: Clique[] = [];

  // Red K_r violations
  for (const combo of combinations(adj.n, r)) {
    let isRedClique = true;
    for (let i = 0; i < r && isRedClique; i++) {
      for (let j = i + 1; j < r; j++) {
        if (!adj.hasEdge(combo[i]!, combo[j]!)) { isRedClique = false; break; }
      }
    }
    if (isRedClique) cliques.push([...combo]);
  }

  // Blue K_s violations
  for (const combo of combinations(adj.n, s)) {
    let isBlueClique = true;
    for (let i = 0; i < s && isBlueClique; i++) {
      for (let j = i + 1; j < s; j++) {
        if (adj.hasEdge(combo[i]!, combo[j]!)) { isBlueClique = false; break; }
      }
    }
    if (isBlueClique) cliques.push([...combo]);
  }

  return cliques;
}

/**
 * The LNS Window Generator
 *
 * Inverts the legacy locking behavior: Instead of locking the "Hot Zone" and randomizing the 
 * "Cold Zone", this function identifies all edges involved in existing cliques (the Hot Zone),
 * and randomly selects `haloSize` edges from the remainder of the graph (the Cold Zone).
 * It returns the combined set of edge indices (e.g., "u_v") as free variables for Z3.
 */
export function getAdaptiveLnsWindow(
  graph: AdjacencyMatrix,
  cliques: Clique[],
  haloSize: number
): Set<string> {
  const freeEdgeIndices = new Set<string>();

  // 1. Extract all edge indices involved in the provided cliques (The Hot Zone)
  for (const clique of cliques) {
    const sz = clique.length;
    for (let i = 0; i < sz; i++) {
      for (let j = i + 1; j < sz; j++) {
        freeEdgeIndices.add(ekey(clique[i]!, clique[j]!));
      }
    }
  }

  // 2. Identify the rest of the graph (The Cold Zone)
  const coldZoneEdges: string[] = [];
  for (let u = 0; u < graph.n; u++) {
    for (let v = u + 1; v < graph.n; v++) {
      const key = ekey(u, v);
      if (!freeEdgeIndices.has(key)) {
        coldZoneEdges.push(key);
      }
    }
  }

  // 3. Randomly select haloSize edges from the Cold Zone
  // Fisher-Yates shuffle for unbiased uniform selection
  for (let i = coldZoneEdges.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [coldZoneEdges[i], coldZoneEdges[j]] = [coldZoneEdges[j]!, coldZoneEdges[i]!];
  }

  const selectedHalo = coldZoneEdges.slice(0, haloSize);

  // 4. Return the combined set of edge indices (Hot Zone + Halo)
  for (const key of selectedHalo) {
    freeEdgeIndices.add(key);
  }

  return freeEdgeIndices;
}
