/**
 * Proof DAG — Zod schemas for ARCHITECT output validation.
 *
 * ProofDAGSchema is the authoritative validator for JSON emitted by
 * ArchitectClient.formulateDAG(). If parsing fails, the caller falls
 * back to the existing flat-config pivot path.
 */

import { z } from "zod";

// ── Node kinds ─────────────────────────────────────────────────────────────

export const DAGNodeKindSchema = z.enum([
  "search",
  "z3",
  "lean",
  "literature",
  "skill_apply",
  "aggregate",
  "mathlib_query",
  "smt_constraint",                  // Wiles Mode: Z3 synthesis
  "algebraic_graph_construction",    // Wiles Mode: compile edge_rule_js → AdjacencyMatrix → verify
  "algebraic_partition_construction",// Wiles Mode: compile partition_rule_js → Int8Array → verify
  "partition_sa_search",             // SA optimizer for sum-free partitions (Schur, VdW)
  "calculate_degrees_of_freedom",    // Wiles Mode: investigation skill
  "query_known_graphs",              // Wiles Mode: investigation skill
  "query_literature",                // Wiles Mode: dynamic JIT retrieval
  "lemma_abstraction",               // Phase 3: obstruction detection → Lean 4 lemma emission
  "lean_skeleton",                   // Phase 7 P1: sorry-stub skeleton decomposition
]);


export const DAGNodeStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "failed",
]);

// ── Individual node ────────────────────────────────────────────────────────

export const DAGNodeSchema = z.object({
  id: z.string().min(1),
  kind: DAGNodeKindSchema,
  label: z.string().optional(),
  dependsOn: z.array(z.string()).optional().default([]),
  config: z.record(z.string(), z.unknown()),
  status: DAGNodeStatusSchema.default("pending"),
  result: z.unknown().optional(),
});

// ── Top-level DAG ──────────────────────────────────────────────────────────

export const ProofDAGSchema = z.object({
  id: z.string().min(1),
  goal: z.string().min(1),
  nodes: z
    .array(DAGNodeSchema)
    .refine((arr) => arr.length >= 1, { message: "A ProofDAG must have at least one node" })
    .refine(
      (nodes) => {
        // Every dependsOn reference must point to a real node id
        const ids = new Set(nodes.map((n) => n.id));
        return nodes.every((n) => (n.dependsOn || []).every((dep) => ids.has(dep)));
      },
      { message: "DAG contains dangling dependsOn references" },
    )
    .refine(
      (nodes) => {
        // Detect cycles via DFS
        const adj = new Map<string, string[]>();
        for (const n of nodes) adj.set(n.id, n.dependsOn || []);
        const visited = new Set<string>();
        const inStack = new Set<string>();

        function hasCycle(id: string): boolean {
          if (inStack.has(id)) return true;
          if (visited.has(id)) return false;
          visited.add(id);
          inStack.add(id);
          for (const dep of adj.get(id) ?? []) {
            if (hasCycle(dep)) return true;
          }
          inStack.delete(id);
          return false;
        }

        return !nodes.some((n) => hasCycle(n.id));
      },
      { message: "DAG contains a cycle" },
    ),
  // Accept any non-empty string for createdAt (ISO 8601 or otherwise)
  createdAt: z.string().optional(),
});

export type ProofDAG = z.infer<typeof ProofDAGSchema>;
export type DAGNode = z.infer<typeof DAGNodeSchema>;
