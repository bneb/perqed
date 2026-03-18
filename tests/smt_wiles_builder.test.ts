import { expect, test, describe } from "bun:test";
import { SmtWilesBuilder } from "../src/search/smt_wiles_builder";
import type { SmtWilesConfig } from "../src/proof_dag/smt_wiles_config";

describe("SMT Wiles Builder (The Orthogonal Paradigm)", () => {
  test("RED Test 3: Structural Synthesis via Z3", async () => {
    // We provide a python string defining exactly what the LLM will provide:
    // constraints on the `adj` boolean 2D array.
    // Let's ask Z3 to synthesize a bipartite graph on 6 vertices.
    const wilesConfig: SmtWilesConfig = {
      vertices: 6,
      description: "Synthesize Bipartite K_{3,3}",
      z3_assertions_python: `
# 6 vertices divided into [0,1,2] and [3,4,5]
# Edges only between partitions, no edges within.
for i in range(3):
    for j in range(i+1, 3):
        solver.add(Not(adj[i][j]))
for i in range(3, 6):
    for j in range(i+1, 6):
        solver.add(Not(adj[i][j]))

# Must have exactly 9 edges (complete bipartite)
edge_sum = Sum([If(adj[i][j], 1, 0) for i in range(6) for j in range(i+1, 6)])
solver.add(edge_sum == 9)
`
    };

    // Note: r=3 and s=10 so the core builder adds Ramsey constraints.
    // A bipartite graph on 6 vertices has no K_3 (red K_r where r=3), so it should satisfy Red K_3 constraints.
    // It's a bipartite graph on 6 vertices, so max indep set is 3. We set s=10 to avoid any blue violations.
    const result = await SmtWilesBuilder.buildAndVerify(wilesConfig, 3, 10);

    expect(result.status).toBe("witness");
    expect(result.adj).toBeDefined();

    // Verify properties of the generated matrix (it must have exactly 9 edges to satisfy the LLM constraints)
    expect(result.adj!.edgeCount()).toBe(9);
    // Verify no red K_3 (handled via Ramsey constraints inside SmtWilesBuilder)
    expect(result.adj!.hasEdge(0, 1)).toBe(false);
    expect(result.adj!.hasEdge(3, 4)).toBe(false);
  });
});
