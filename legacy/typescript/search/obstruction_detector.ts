/**
 * obstruction_detector.ts — Heuristic common-subgraph extractor.
 *
 * When the SA Island Model consistently stalls at the same low energy
 * (E=1 or E=2), the shared topological obstruction is the *intersection*
 * of those near-miss graphs. We identify it via an 80% edge-presence
 * threshold across the input set.
 *
 * The returned AdjacencyMatrix is NOT a proof — it is a heuristic fingerprint
 * of the obstruction for use by the Formalist Extension to draft a Lean lemma.
 */
import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";

/**
 * Extract the common subgraph shared by ≥80% of the input near-miss graphs.
 *
 * Algorithm:
 *   1. For each upper-triangle edge (i,j), count how many graphs contain it.
 *   2. Mark the edge as "obstructing" if count/total ≥ threshold.
 *   3. Return the AdjacencyMatrix of those obstructing edges.
 *
 * @param graphs     Near-miss adjacency matrices (E ≤ 2); assumed same n.
 * @param threshold  Minimum fraction of graphs that must share the edge (default 0.8).
 */
export function extractCommonSubgraph(
  graphs: AdjacencyMatrix[],
  threshold: number = 0.8
): AdjacencyMatrix {
  if (graphs.length === 0) throw new Error("extractCommonSubgraph: empty graph list");

  const n = graphs[0]!.n;
  const obstruction = new AdjacencyMatrix(n);
  const minCount = Math.ceil(graphs.length * threshold);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let count = 0;
      for (const g of graphs) {
        if (g.hasEdge(i, j)) count++;
      }
      if (count >= minCount) {
        obstruction.addEdge(i, j);
      }
    }
  }

  return obstruction;
}

/**
 * Describe the obstruction in human-readable form for journal logging.
 */
export function describeObstruction(obstruction: AdjacencyMatrix): string {
  let edgeCount = 0;
  for (let i = 0; i < obstruction.n; i++) {
    for (let j = i + 1; j < obstruction.n; j++) {
      if (obstruction.hasEdge(i, j)) edgeCount++;
    }
  }
  return `Shared obstruction: ${obstruction.n}-vertex graph with ${edgeCount} invariant edges`;
}
