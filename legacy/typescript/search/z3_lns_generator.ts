/**
 * Z3 LNS Script Generator
 *
 * Generates a Python/Z3 script for the Large Neighborhood Search repair step.
 *
 * Key design principle (same as z3_circulant_generator):
 * ALL clause computation happens in TypeScript. The Python script receives inline
 * precomputed data, not combinatorial logic. This avoids C(35,6)=1.6M Python
 * iterations which caused the circulant timeout.
 *
 * Clause correctness rules (fixes the spec's filter bug):
 *   For each k-subset of vertices:
 *   RED K_r clause (at least one edge must be blue):
 *     - If any frozen (non-free) edge is blue → constraint already satisfied → skip
 *     - If all edges frozen AND all red → frozen violated → emit pre-UNSAT script
 *     - If at least one free edge AND no frozen blue edge → emit Or([Not(e) for free e])
 *   BLUE K_s clause (at least one edge must be red):
 *     - If any frozen edge is red → constraint already satisfied → skip
 *     - If all edges frozen AND all blue → frozen violated → emit pre-UNSAT script
 *     - If at least one free edge AND no frozen red edge → emit Or([e for free e])
 */

import type { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";

// ── Shared combinations iterator ─────────────────────────────────────────────

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

function ekey(u: number, v: number): string {
  return u < v ? `${u}_${v}` : `${v}_${u}`;
}

// ── Clause precomputation ─────────────────────────────────────────────────────

interface LNSClauses {
  redClauses: string[][];   // each inner array = list of free edge keys that must have ≥1 blue
  blueClauses: string[][];  // each inner array = list of free edge keys that must have ≥1 red
  preUnsat: boolean;        // true if a frozen clique is already violated
}

function precomputeClauses(
  adj: AdjacencyMatrix,
  N: number,
  r: number,
  s: number,
  freeEdgeSet: Set<string>,
): LNSClauses {
  const redClauses: string[][] = [];
  const blueClauses: string[][] = [];
  const seen = new Set<string>();

  // Red K_r: no all-red clique allowed
  for (const combo of combinations(N, r)) {
    const freeEdges: string[] = [];
    let frozenBlueFound = false;
    let allFrozenRed = true;

    for (let i = 0; i < r; i++) {
      for (let j = i + 1; j < r; j++) {
        const key = ekey(combo[i]!, combo[j]!);
        const isRed = adj.hasEdge(combo[i]!, combo[j]!); // true = red edge

        if (freeEdgeSet.has(key)) {
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
      return { redClauses, blueClauses, preUnsat: true };
    }

    if (freeEdges.length > 0) {
      // Deduplicate: sort clause keys and use as dedup signature
      const clauseKey = [...freeEdges].sort().join("|");
      if (!seen.has("R:" + clauseKey)) {
        seen.add("R:" + clauseKey);
        redClauses.push(freeEdges);
      }
    }
  }

  // Blue K_s: no all-blue clique allowed (independent set)
  for (const combo of combinations(N, s)) {
    const freeEdges: string[] = [];
    let frozenRedFound = false;
    let allFrozenBlue = true;

    for (let i = 0; i < s; i++) {
      for (let j = i + 1; j < s; j++) {
        const key = ekey(combo[i]!, combo[j]!);
        const isRed = adj.hasEdge(combo[i]!, combo[j]!);

        if (freeEdgeSet.has(key)) {
          freeEdges.push(key);
          allFrozenBlue = false;
        } else if (isRed) {
          // Frozen red edge → blue clique constraint already satisfied
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
      return { redClauses, blueClauses, preUnsat: true };
    }

    if (freeEdges.length > 0) {
      const clauseKey = [...freeEdges].sort().join("|");
      if (!seen.has("B:" + clauseKey)) {
        seen.add("B:" + clauseKey);
        blueClauses.push(freeEdges);
      }
    }
  }

  return { redClauses, blueClauses, preUnsat: false };
}

// ── Script generator ──────────────────────────────────────────────────────────

/**
 * Generate a Python/Z3 script for the LNS repair step.
 *
 * @param N           Number of vertices
 * @param r           Red clique size to avoid
 * @param s           Blue clique size to avoid
 * @param adj         Current SA best adjacency matrix (frozen edges come from here)
 * @param freeEdges   Edges that Z3 may freely recolor ([u,v] with u < v)
 */
export function generateLNSZ3Script(
  N: number,
  r: number,
  s: number,
  adj: AdjacencyMatrix,
  freeEdges: [number, number][],
): string {
  const freeEdgeSet = new Set<string>(freeEdges.map(([u, v]) => ekey(u, v)));
  const { redClauses, blueClauses, preUnsat } = precomputeClauses(adj, N, r, s, freeEdgeSet);

  if (preUnsat) {
    return "(echo \"UNSAT\")";
  }

  const freeEdgeKeys = Array.from(freeEdgeSet);
  let smtScript = "";

  // 1. Declare Booleans for the free edges
  for (const k of freeEdgeKeys) {
    smtScript += `(declare-const e_${k} Bool)\n`;
  }

  // 2. Add Assertions for Red Clauses (at least one blue, i.e., NOT Red)
  for (const clause of redClauses) {
    if (clause.length === 1) {
      smtScript += `(assert (not e_${clause[0]}))\n`;
    } else {
      const orExpr = clause.map(k => `(not e_${k})`).join(" ");
      smtScript += `(assert (or ${orExpr}))\n`;
    }
  }

  // 3. Add Assertions for Blue Clauses (at least one red)
  for (const clause of blueClauses) {
    if (clause.length === 1) {
      smtScript += `(assert e_${clause[0]})\n`;
    } else {
      const orExpr = clause.map(k => `e_${k}`).join(" ");
      smtScript += `(assert (or ${orExpr}))\n`;
    }
  }

  // 4. Check satisfiability and output values
  smtScript += "(check-sat)\n";
  if (freeEdgeKeys.length > 0) {
    const vars = freeEdgeKeys.map(k => `e_${k}`).join(" ");
    smtScript += `(get-value (${vars}))\n`;
  }
  return smtScript;
}
