/**
 * AlgebraicPartitionConfig — Zod schema and TypeScript interface for
 * algebraic_partition_construction DAG nodes.
 *
 * Used when the ARCHITECT (in Wiles Mode) wants to assign integers from
 * a domain {1, ..., domain_size} into `num_partitions` color classes and
 * verify that each class is sum-free (no x + y = z within a class).
 *
 * Contrast with AlgebraicConstructionConfig which works over a 2D
 * AdjacencyMatrix — this targets 1D set partition problems like:
 *   - Schur numbers S(k)
 *   - Van der Waerden numbers W(k; r)
 */

import { z } from "zod";

/**
 * Config for a 1D algebraic partition construction node.
 *
 * partition_rule_js is a raw JavaScript function *body* (not a full
 * function expression) that accepts an integer `i` (1-indexed, from 1
 * to domain_size) and returns:
 *   - An integer in [0, num_partitions) — the bucket/color for element i
 *   - -1 or undefined — "unassigned" (left for Z3 LNS to resolve)
 *
 * Example:
 *   "return (i - 1) % 6;"   // Round-robin across 6 colors
 *   "if (i % 3 === 0) return 0; if (i % 3 === 1) return 1; return 2;"
 */
export interface AlgebraicPartitionConfig {
  /** Number of integers in the domain, e.g. 537 for S(6) */
  domain_size: number;
  /** Number of color classes / buckets */
  num_partitions: number;
  /** Human-readable description of the partition strategy */
  description: string;
  /**
   * JavaScript function body. Receives `i` (1-indexed integer),
   * must return a bucket index [0, num_partitions) or -1 (unassigned).
   */
  partition_rule_js: string;
}

export const AlgebraicPartitionConfigSchema = z.object({
  domain_size: z.number().int().min(1).max(100_000),
  num_partitions: z.number().int().min(1).max(64),
  description: z.string().min(1),
  partition_rule_js: z.string().min(1),
});

export type AlgebraicPartitionConfigInput = z.input<typeof AlgebraicPartitionConfigSchema>;
