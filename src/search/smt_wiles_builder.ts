import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import { SolverBridge } from "../solver";
import type { SmtWilesConfig } from "../proof_dag/smt_wiles_config";

export interface SmtWilesBuildResult {
  adj?: AdjacencyMatrix;
  description: string;
  compiledInMs: number;
  status: "witness" | "unsat" | "timeout" | "error";
}

/**
 * SMT Wiles Builder
 * 
 * Takes high-level Z3 assertions directly from the ARCHITECT (Wiles Mode),
 * injects them into a python script payload along with the Ramsey constraints,
 * and directly hands the monolithic formula to runZ3().
 */
export class SmtWilesBuilder {
  static async buildAndVerify(
    config: SmtWilesConfig,
    r: number,
    s: number,
    timeoutMs: number = 60_000
  ): Promise<SmtWilesBuildResult> {
    const start = Date.now();
    const solver = new SolverBridge();
    
    // The ARCHITECT provides assertions over a boolean 2D array called `adj`.
    // We wrap them in standard setup plus the basic symmetry constraints.
    const pythonPayload = `from z3 import *
import json
import traceback

N = ${config.vertices}
r = ${r}
s = ${s}

solver = Solver()

# 1. Create Adj matrix
adj = [[Bool(f"e_{i}_{j}") if i != j else False for j in range(N)] for i in range(N)]

# 2. Add undirectional symmetry constraints
for i in range(N):
    for j in range(i + 1, N):
        solver.add(adj[i][j] == adj[j][i])

# 3. Add Ramsey (Red K_r and Blue K_s) clique constraints
from itertools import combinations
for combo in combinations(range(N), r):
    # No monochromatic red
    solver.add(Or([Not(adj[u][v]) for u, v in combinations(combo, 2)]))

for combo in combinations(range(N), s):
    # No monochromatic blue
    solver.add(Or([adj[u][v] for u, v in combinations(combo, 2)]))

# 4. Inject LLM-provided Structural Assertions (Wiles Mode)
try:
${config.z3_assertions_python.trim().split("\n").map((l: string) => "    " + l).join("\n")}
except Exception as e:
    print(f"ERROR: LLM Assertion Injection Failed: {e}")
    traceback.print_exc()
    sys.exit(1)

result = solver.check()

if result == sat:
    model = solver.model()
    out_adj = []
    for i in range(N):
        row = []
        for j in range(N):
            if i == j: row.append(0)
            else: row.append(1 if is_true(model[adj[i][j]]) else 0)
        out_adj.append(row)
    print("SAT:" + json.dumps(out_adj))
elif result == unsat:
    print("UNSAT")
else:
    print(f"ERROR: {result}")
`;

    console.log("--- PYTHON PAYLOAD ---");
    console.log(pythonPayload);
    console.log("----------------------");

    const result = await solver.runZ3(pythonPayload, timeoutMs);
    const ms = Date.now() - start;
    
    const out = result.output.trim();
    if (!out.startsWith("SAT:") && !out.includes("UNSAT")) {
      console.log("Python Error Output:", out);
    }
    if (out.startsWith("SAT:")) {
      try {
        const jsonStr = out.substring(4).trim();
        const rawArray = JSON.parse(jsonStr) as number[][];
        const graph = new AdjacencyMatrix(config.vertices);
        for(let i = 0; i < config.vertices; i++) {
          for (let j = i + 1; j < config.vertices; j++) {
            if (rawArray[i]?.[j] === 1) graph.addEdge(i, j);
          }
        }
        return { adj: graph, description: config.description, compiledInMs: ms, status: "witness" };
      } catch (e) {
        return { description: config.description, compiledInMs: ms, status: "error" };
      }
    } else if (out.includes("UNSAT")) {
      return { description: config.description, compiledInMs: ms, status: "unsat" };
    } else if (out.includes("timed out")) {
      return { description: config.description, compiledInMs: ms, status: "timeout" };
    } else {
      return { description: config.description, compiledInMs: ms, status: "error" };
    }
  }
}
