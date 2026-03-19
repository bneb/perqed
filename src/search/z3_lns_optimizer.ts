import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import { type Clique, getAdaptiveLnsWindow } from "./lns_window";
import { cullClauses } from "./z3_clause_generator";
import { SolverBridge } from "../solver";

/**
 * The Adaptive Z3-LNS Loop
 *
 * Sequentially expands the 'Halo' of free edges around the locked hot zone (cliques)
 * and asks Z3 to find a satisfying assignment. If SAT, applies the patch. If UNSAT,
 * the halo grows until it hits MAX_HALO, at which point the macro-structure is doomed.
 */
export async function adaptiveZ3Solve(
  graph: AdjacencyMatrix,
  initialCliques: Clique[],
  solver: SolverBridge,
  r: number = 4,
  s: number = 6,
  lockedVertices?: ReadonlySet<number>,
): Promise<AdjacencyMatrix | null> {
  let currentHalo = 10;
  const MAX_HALO = 100;
  const TIMEOUT_MS = 5000;

  while (currentHalo <= MAX_HALO) {
    // 1. Get the free variables (The Adaptive Window)
    const freeEdgeKeys = getAdaptiveLnsWindow(graph, initialCliques, currentHalo);

    // 2. Call the Clause Culler
    const { redClauses, blueClauses, isStaticallyUnsat } = cullClauses(graph, freeEdgeKeys, r, s);

    if (isStaticallyUnsat) {
      currentHalo += 20;
      continue;
    }

    // 3. Generate Z3 Python constraints (string templating for Python Bridge)
    const pythonScript = generateZ3PythonPayload(
      graph, freeEdgeKeys, redClauses, blueClauses, r, s, lockedVertices
    );

    // 4. Run Z3 with a strict timeout
    const result = await solver.runZ3(pythonScript, TIMEOUT_MS);

    // 5. Interpret Result
    const out = result.output.trim();
    if (out.startsWith("SAT:")) {
      const jsonStr = out.substring(4).trim();
      return applyZ3Model(graph, jsonStr);
    } else if (out.includes("UNSAT") || out.includes("timed out")) {
      currentHalo += 20;
    } else {
      currentHalo += 20;
    }
  }

  // Basin is terminally dead.
  return null;
}

function generateZ3PythonPayload(
  graph: AdjacencyMatrix,
  freeEdgeKeys: Set<string>,
  redClauses: string[][],
  blueClauses: string[][],
  r: number,
  s: number,
  lockedVertices?: ReadonlySet<number>,
): string {
  const N = graph.n;
  const freeEdgeArray = Array.from(freeEdgeKeys);

  // Build frozen adjacency matrix
  const frozenAdj: number[][] = [];
  for (let i = 0; i < N; i++) {
    frozenAdj.push([]);
    for (let j = 0; j < N; j++) {
      frozenAdj[i]!.push(graph.hasEdge(i, j) ? 1 : 0);
    }
  }

  // Build the list of (i, j, value) triples for locked edges.
  // An edge is "frozen-locked" when BOTH endpoints are in lockedVertices.
  // These are asserted as constants in Z3 rather than free Bool variables.
  const frozenLockedEdges: Array<{ i: number; j: number; val: number }> = [];
  if (lockedVertices && lockedVertices.size > 0) {
    for (let i = 0; i < N; i++) {
      if (!lockedVertices.has(i)) continue;
      for (let j = i + 1; j < N; j++) {
        if (!lockedVertices.has(j)) continue;
        frozenLockedEdges.push({ i, j, val: graph.hasEdge(i, j) ? 1 : 0 });
      }
    }
  }

  const frozenLockedJson = JSON.stringify(
    frozenLockedEdges.map(({ i, j, val }) => [i, j, val])
  );

  return `from z3 import *
import json

N = ${N}
r = ${r}
s = ${s}

free_edge_keys = ${JSON.stringify(freeEdgeArray)}
red_clauses = ${JSON.stringify(redClauses)}
blue_clauses = ${JSON.stringify(blueClauses)}
frozen_adj = ${JSON.stringify(frozenAdj)}
frozen_locked_edges = ${frozenLockedJson}

# Z3 boolean variables for free edges
e_vars = {k: Bool('e_' + k) for k in free_edge_keys}

solver = Solver()

# ── FrozenCore assertions ──────────────────────────────────────────────────
# For each edge where both i and j are in the locked core, assert its value
# directly as a constant (True = red, False = blue). This shrinks the search
# space by |lockedVertices| choose 2 free variables.
for i, j, val in frozen_locked_edges:
    k = f'{i}_{j}'
    if k in e_vars:
        solver.add(e_vars[k] == (val == 1))
    else:
        # Edge is in frozen adj but not in free set - still assert for safety
        pass

# Red K_r constraints (no monochromatic red clique allowed -> at least one free edge must be NOT red/blue)
# E_var == True means it is Red. So Not(e) means it is Blue.
for clause in red_clauses:
    solver.add(Or([Not(e_vars[k]) for k in clause if k in e_vars]))

# Blue K_s constraints (no monochromatic blue clique allowed -> at least one free edge must be red)
for clause in blue_clauses:
    solver.add(Or([e_vars[k] for k in clause if k in e_vars]))

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

function applyZ3Model(originalGraph: AdjacencyMatrix, returnedAdjJson: string): AdjacencyMatrix {
  try {
    const rawMatrix = JSON.parse(returnedAdjJson) as number[][];
    const newGraph = new AdjacencyMatrix(originalGraph.n);
    for (let i = 0; i < newGraph.n; i++) {
      for (let j = i + 1; j < newGraph.n; j++) {
        if (rawMatrix[i]?.[j] === 1) {
          newGraph.addEdge(i, j);
        }
      }
    }
    return newGraph;
  } catch (e) {
    // Failsafe serialization error
    return originalGraph;
  }
}
