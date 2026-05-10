/**
 * DAGExecutor — parallel proof DAG runner.
 *
 * Execution model:
 *   1. Each iteration finds all "ready" nodes (pending, all deps succeeded).
 *   2. Ready nodes are executed concurrently via Promise.all.
 *   3. Failed nodes block their downstream dependents.
 *   4. Loop terminates when no more nodes remain or no progress is possible.
 *
 * Node handlers are injected via NodeHandlerMap, keeping the executor
 * decoupled from the actual SA / Z3 / Lean implementations.
 */

import type { DAGNode, ProofDAG } from "./schemas";

// ──────────────────────────────────────────────────────────────────────────
// Handler map
// ──────────────────────────────────────────────────────────────────────────

/**
 * A handler for one node kind.
 *
 * @param node    - The node being executed (config, id, etc.)
 * @param results - Read-only map of results from already-succeeded nodes
 * @returns       - Arbitrary result value stored in the result map
 */
export type NodeHandler = (
  node: DAGNode,
  results: ReadonlyMap<string, unknown>,
) => Promise<unknown>;

export type NodeHandlerMap = Partial<Record<DAGNode["kind"], NodeHandler>>;

// ──────────────────────────────────────────────────────────────────────────
// Execution result
// ──────────────────────────────────────────────────────────────────────────

export interface DAGExecutionResult {
  results: Map<string, unknown>;
  /** IDs of nodes that completed successfully */
  succeeded: string[];
  /** IDs of nodes that failed or were blocked */
  failed: string[];
  /** IDs of nodes that were never reached (blocked by upstream failure) */
  blocked: string[];
}

// ──────────────────────────────────────────────────────────────────────────
// DAGExecutor
// ──────────────────────────────────────────────────────────────────────────

export class DAGExecutor {
  private results = new Map<string, unknown>();

  constructor(
    private readonly dag: ProofDAG,
    private readonly handlers: NodeHandlerMap,
  ) {}

  async execute(): Promise<DAGExecutionResult> {
    const nodeMap = new Map(this.dag.nodes.map((n) => [n.id, n]));
    const remaining = new Set<string>();
    const succeeded = new Set<string>();
    const failed = new Set<string>();

    for (const n of this.dag.nodes) {
      if (n.status === "succeeded") {
        succeeded.add(n.id);
      } else {
        remaining.add(n.id);
      }
    }

    while (remaining.size > 0) {
      // Find nodes whose every dependency has succeeded
      const ready = [...remaining].filter((id) => {
        const node = nodeMap.get(id)!;
        return node.dependsOn.every((dep) => succeeded.has(dep));
      });

      if (ready.length === 0) {
        // No ready nodes — remaining nodes are blocked by upstream failures
        break;
      }

      // Execute all ready nodes concurrently
      await Promise.all(
        ready.map(async (id) => {
          const node = nodeMap.get(id)!;
          node.status = "running";

          try {
            const handler = this.handlers[node.kind];
            if (!handler) {
              throw new Error(
                `[DAGExecutor] No handler registered for node kind "${node.kind}" (id="${id}")`,
              );
            }

            const result = await handler(node, this.results);
            node.result = result;
            node.status = "succeeded";
            this.results.set(id, result);
            succeeded.add(id);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            node.result = { error: message };
            node.status = "failed";
            this.results.set(id, node.result);
            failed.add(id);
            console.error(`[DAGExecutor] Node "${id}" failed: ${message}`);
          }

          remaining.delete(id);
        }),
      );
    }

    // Any nodes still in remaining are blocked (never ran)
    const blocked = [...remaining];

    return {
      results: this.results,
      succeeded: [...succeeded],
      failed: [...failed],
      blocked,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Returns the typed result of a node by id.
   * Throws if the node has not succeeded.
   */
  getResult<T>(nodeId: string): T {
    if (!this.results.has(nodeId)) {
      throw new Error(`[DAGExecutor] No result for node "${nodeId}" — did it succeed?`);
    }
    return this.results.get(nodeId) as T;
  }
}
