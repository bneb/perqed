/**
 * AlgebraicConstructionConfig — Zod schema and TypeScript interface for
 * algebraic_graph_construction DAG nodes.
 *
 * The ARCHITECT emits this config when it wants to test a specific
 * algebraic edge rule (Cayley graph, Paley graph, block design, etc.)
 * without running Simulated Annealing.
 */

import { z } from "zod";

/**
 * Strongly-typed config for an algebraic graph construction node.
 *
 * edge_rule_js is a raw JavaScript function *body* (not a full function
 * expression) that accepts two integer vertex indices (i, j) and returns
 * a boolean — true means vertex i is connected to vertex j (red edge).
 *
 * Example:
 *   "return ((i - j + 35) % 35 === 1) || ((i - j + 35) % 35 === 7);"
 *
 * The body is executed inside a vm.Script sandbox that exposes only
 * { Math } — process, require, and all Node globals are excluded.
 */
export interface AlgebraicConstructionConfig {
  /** Number of vertices in the graph (e.g. 35 for R(4,6) lower bound) */
  vertices: number;
  /** Human-readable description of the algebraic construction */
  description: string;
  /**
   * JavaScript function body for the edge rule.
   * Receives (i: number, j: number), must return boolean.
   * The symmetry property g(i,j) = g(j,i) is enforced by the compiler —
   * only upper-triangle values (i < j) are evaluated; lower triangle is mirrored.
   */
  edge_rule_js: string;
  /** Red clique size (used for ramseyEnergy verification) — default 4 */
  r?: number;
  /** Blue clique size (independent set size) — default 6 */
  s?: number;
}

export const AlgebraicConstructionConfigSchema = z.object({
  vertices: z.number().int().min(2).max(1000),
  description: z.string().min(1),
  edge_rule_js: z.string().min(1),
  r: z.number().int().min(2).optional(),
  s: z.number().int().min(2).optional(),
});

export type AlgebraicConstructionConfigInput = z.input<typeof AlgebraicConstructionConfigSchema>;
