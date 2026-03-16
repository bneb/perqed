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

  // Build frozen adjacency matrix (NxN, 1=red edge present, 0=blue/no-edge)
  const frozenAdj: number[][] = [];
  for (let i = 0; i < N; i++) {
    frozenAdj.push([]);
    for (let j = 0; j < N; j++) {
      frozenAdj[i]!.push(adj.hasEdge(i, j) ? 1 : 0);
    }
  }

  const freeEdgeKeys = Array.from(freeEdgeSet);

  if (preUnsat) {
    // Short-circuit: TypeScript already detected an irrecoverable frozen violation
    return `from z3 import *

N = ${N}
# TypeScript pre-detected frozen violated clique — no Z3 call needed
print("UNSAT")
`;
  }

  return `from z3 import *
import json

N = ${N}
r = ${r}
s = ${s}

# Free edge variables (precomputed by TypeScript — no itertools needed)
free_edge_keys = ${JSON.stringify(freeEdgeKeys)}

# Clauses (precomputed + deduplicated in TypeScript)
# Red clauses: for each, at least one free edge must be NOT red (blue)
red_clauses = ${JSON.stringify(redClauses)}

# Blue clauses: for each, at least one free edge must be red
blue_clauses = ${JSON.stringify(blueClauses)}

# Frozen adjacency matrix (free edge slots may be overwritten by the model)
frozen_adj = ${JSON.stringify(frozenAdj)}

# Build Z3 boolean variables for free edges only
e_vars = {k: Bool('e_' + k) for k in free_edge_keys}

solver = Solver()

# Red K_r constraints: Or([Not(e) for e in clause]) = at least one must be blue
for clause in red_clauses:
    solver.add(Or([Not(e_vars[k]) for k in clause]))

# Blue K_s constraints: Or([e for e in clause]) = at least one must be red
for clause in blue_clauses:
    solver.add(Or([e_vars[k] for k in clause]))

result = solver.check()

if result == sat:
    model = solver.model()
    adj = [row[:] for row in frozen_adj]
    for k, var in e_vars.items():
        parts = k.split('_')
        i, j = int(parts[0]), int(parts[1])
        val = 1 if is_true(model[var]) else 0
        adj[i][j] = val
        adj[j][i] = val
    print("SAT:" + json.dumps(adj))
elif result == unsat:
    print("UNSAT")
else:
    print(f"ERROR:{result}")
`;
}
