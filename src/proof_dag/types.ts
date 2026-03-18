/**
 * Proof DAG — type definitions.
 *
 * A ProofDAG is a directed acyclic graph where:
 *   - Nodes are typed proof sub-tasks (search, Z3, Lean, literature, etc.)
 *   - Edges (dependsOn) express data / ordering dependencies
 *
 * The DAGExecutor runs ready nodes (no unresolved deps) concurrently
 * and threads results between nodes via a shared result map.
 */

// ──────────────────────────────────────────────────────────────────────────
// Node catalogue
// ──────────────────────────────────────────────────────────────────────────

export type DAGNodeStatus = "pending" | "running" | "succeeded" | "failed";

export type DAGNodeKind =
  | "search"        // SA combinatorial search (orchestratedSearch)
  | "z3"            // Z3 SMT solve (circulant fast-path or LNS finisher)
  | "lean"          // Lean 4 tactic proof (SolverBridge)
  | "literature"    // Retrieve + format relevant papers from LanceDB
  | "skill_apply"   // Read SKILL.md and inject technique into a downstream prompt
  | "algebraic_graph_construction" // VM execution of topological rules
  | "smt_constraint"// Z3 synthesis of structural rules
  | "mathlib_query" // LanceDB lookups of Lean4 Mathlib
  | "aggregate";    // Merge results from multiple preceding nodes

export interface DAGNode {
  /** Unique identifier, snake_case, e.g. "sa_attempt_1" */
  id: string;
  kind: DAGNodeKind;
  /** Human-readable description shown in logs */
  label: string;
  /** IDs of nodes that must succeed before this node becomes ready */
  dependsOn: string[];
  /** Node-kind-specific configuration object */
  config: Record<string, unknown>;
  status: DAGNodeStatus;
  /** Populated on completion (SAT result, vector results, etc.) */
  result?: unknown;
}

// ──────────────────────────────────────────────────────────────────────────
// Per-kind config interfaces (used by node handlers)
// ──────────────────────────────────────────────────────────────────────────

export interface SearchNodeConfig {
  vertices: number;
  r: number;
  s: number;
  iterations: number;
  workers: number;
  strategy: "island_model" | "single";
  /** If true, warm-start W0 from best_seed.json */
  seedFromVault: boolean;
}

export interface Z3NodeConfig {
  mode: "circulant_fast_path" | "lns_finisher" | "direct";
  vertices: number;
  r: number;
  s: number;
  /** LNS: fraction of edges to free (0–1) */
  extraFreePercent?: number;
  /** LNS: pull candidate adj matrix from a preceding node's result */
  candidatesFromNode?: string;
}

export interface LeanNodeConfig {
  theoremSignature: string;
  /** Pull the witness adj matrix from a preceding node's result */
  witnessFromNode: string;
}

export interface LiteratureNodeConfig {
  /** Free-text query to run against LanceDB */
  query: string;
  /** Top-k results to retrieve */
  k: number;
  /**
   * ID of the node whose prompt context should be enriched with the results.
   * Used by the DAGExecutor to inject retrieved literature into downstream prompts.
   */
  injectIntoNode: string;
}

export interface SkillApplyNodeConfig {
  /** Absolute or repo-relative path to SKILL.md */
  skillPath: string;
  /** Pull input from a preceding node's result */
  inputFromNode: string;
}

export interface AggregateNodeConfig {
  strategy: "best_energy" | "union_constraints" | "majority_vote";
  sourceNodes: string[];
}

// ──────────────────────────────────────────────────────────────────────────
// Top-level DAG
// ──────────────────────────────────────────────────────────────────────────

export interface ProofDAG {
  /** UUID assigned by the ARCHITECT */
  id: string;
  /** The mathematical goal, e.g. "R(4,6) >= 36" */
  goal: string;
  nodes: DAGNode[];
  /** ISO 8601 timestamp */
  createdAt: string;
}
