import { expect, test, describe } from "bun:test";
import { DAGExecutor } from "../src/proof_dag/dag_executor";
import type { ProofDAG, DAGNode } from "../src/proof_dag/schemas";

describe("Dynamic Replanning Engine", () => {
  test("Executes investigation nodes and resizes DAG", async () => {
    // Initial state: A single algebraic construction node that "fails"
    const currentDag: ProofDAG = {
      id: "test-replan",
      goal: "Prove R(3,3) >= 5",
      nodes: [
        {
          id: "init_alg",
          kind: "algebraic_graph_construction",
          dependsOn: [],
          status: "pending",
          config: { vertices: 5, edge_rule_js: "return false;", description: "fail" }
        }
      ]
    };

    let log: string[] = [];

    // Simulate Wiles Loop attempt 1
    let executor = new DAGExecutor(currentDag, {
      algebraic_graph_construction: async (node) => {
        log.push(`alg_run_${node.id}`);
        // simulate failure (energy > 0)
        return { energy: 1, status: "violations", compiledInMs: 1 };
      }
    });

    await executor.execute();
    expect(log).toEqual(["alg_run_init_alg"]);
    
    // Simulate Architect returning investigation nodes
    const newNodes: DAGNode[] = [
      {
        id: "inv_1",
        kind: "calculate_degrees_of_freedom",
        dependsOn: [],
        status: "pending",
        config: { vertices: 5, edge_rule_js: "return true;" }
      },
      {
        id: "inv_2",
        kind: "query_known_graphs",
        dependsOn: [],
        status: "pending",
        config: { r: 3, s: 3 }
      }
    ];

    currentDag.nodes.push(...newNodes);

    executor = new DAGExecutor(currentDag, {
      calculate_degrees_of_freedom: async (node) => {
        log.push(`inv_dof_${node.id}`);
        return { note: "Space is 2^1" };
      },
      query_known_graphs: async (node) => {
        log.push(`inv_qkg_${node.id}`);
        return { note: "R(3,3)=6" };
      },
      algebraic_graph_construction: async (node) => {
        log.push(`bad_route_should_not_hit`);
        return { energy: 1, status: "violations", compiledInMs: 5 };
      }
    });

    // Execute run 2.
    // The executor skips init_alg because it already has status="succeeded" in the old logic.
    // wait, DAG nodes are kept inside `dag.nodes`. If they have status="succeeded", are they skipped?
    // Let's manually set it since in reality the executor mutates `status`.
    expect(currentDag.nodes[0]!.status).toBe("succeeded");
    
    await executor.execute();
    
    expect(log).toContain("inv_dof_inv_1");
    expect(log).toContain("inv_qkg_inv_2");
    expect(log).not.toContain("bad_route_should_not_hit"); // Init alg shouldn't rerun
  });
});
