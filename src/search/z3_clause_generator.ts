import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";

export interface Z3ClauseSet {
  redClauses: string[][];   // each inner array = list of free edge keys that must have ≥1 blue
  blueClauses: string[][];  // each inner array = list of free edge keys that must have ≥1 red
  isStaticallyUnsat: boolean;
}

export function ekey(u: number, v: number): string {
  return u < v ? `${u}_${v}` : `${v}_${u}`;
}

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

/**
 * The Clause Culler
 *
 * Scans the combinatorial space of cliques and generates constraints ONLY for cliques
 * that contain at least one free edge. Cliques composed entirely of locked edges are
 * statically evaluated — if a monochromatic locked clique exists, we are terminally UNSAT
 * before even invoking Z3.
 */
export function cullClauses(
  graph: AdjacencyMatrix,
  freeEdgeIndices: Set<string>,
  maxRed: number = 4,
  maxBlue: number = 6
): Z3ClauseSet {
  const redClauses: string[][] = [];
  const blueClauses: string[][] = [];
  const seen = new Set<string>();

  // Red K_r: no all-red clique allowed
  for (const combo of combinations(graph.n, maxRed)) {
    const freeEdges: string[] = [];
    let frozenBlueFound = false;
    let allFrozenRed = true;

    for (let i = 0; i < maxRed; i++) {
      for (let j = i + 1; j < maxRed; j++) {
        const key = ekey(combo[i]!, combo[j]!);
        const isRed = graph.hasEdge(combo[i]!, combo[j]!); // true = red edge

        if (freeEdgeIndices.has(key)) {
          freeEdges.push(key);
          allFrozenRed = false; // free edge, not frozen
        } else if (!isRed) {
          // Frozen blue edge → constraint already satisfied
          frozenBlueFound = true;
          allFrozenRed = false;
          break;
        }
        // else: frozen red edge — stays allFrozenRed
      }
      if (frozenBlueFound) break;
    }

    if (frozenBlueFound) continue; // constraint already met

    if (freeEdges.length === 0 && allFrozenRed) {
      // Fully frozen all-red clique → pre-UNSAT
      return { redClauses, blueClauses, isStaticallyUnsat: true };
    }

    if (freeEdges.length > 0) {
      // Deduplicate
      const clauseKey = [...freeEdges].sort().join("|");
      if (!seen.has("R:" + clauseKey)) {
        seen.add("R:" + clauseKey);
        redClauses.push(freeEdges);
      }
    }
  }

  // Blue K_s: no all-blue clique allowed
  for (const combo of combinations(graph.n, maxBlue)) {
    const freeEdges: string[] = [];
    let frozenRedFound = false;
    let allFrozenBlue = true;

    for (let i = 0; i < maxBlue; i++) {
      for (let j = i + 1; j < maxBlue; j++) {
        const key = ekey(combo[i]!, combo[j]!);
        const isRed = graph.hasEdge(combo[i]!, combo[j]!);

        if (freeEdgeIndices.has(key)) {
          freeEdges.push(key);
          allFrozenBlue = false;
        } else if (isRed) {
          // Frozen red edge → constraint already satisfied
          frozenRedFound = true;
          allFrozenBlue = false;
          break;
        }
        // else: frozen blue edge — stays allFrozenBlue
      }
      if (frozenRedFound) break;
    }

    if (frozenRedFound) continue;

    if (freeEdges.length === 0 && allFrozenBlue) {
      return { redClauses, blueClauses, isStaticallyUnsat: true };
    }

    if (freeEdges.length > 0) {
      const clauseKey = [...freeEdges].sort().join("|");
      if (!seen.has("B:" + clauseKey)) {
        seen.add("B:" + clauseKey);
        blueClauses.push(freeEdges);
      }
    }
  }

  return { redClauses, blueClauses, isStaticallyUnsat: false };
}
