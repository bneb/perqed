/**
 * Witness Detector — Constructive existence detection and search config extraction.
 *
 * Architecture:
 *   1. isConstructiveExistence(sig) — checks Lean theorem signature for ∃
 *   2. extractSearchConfig(cfg)     — converts ARCHITECT-generated ArchitectSearchConfig
 *                                     into a typed SearchConfig for the SA engine
 *
 * No regex NLP parsing. The ARCHITECT emits structured JSON (ArchitectSearchConfig)
 * as part of run_config.json, and this module dispatches on it.
 */

// ──────────────────────────────────────────────
// Types emitted by the ARCHITECT in run_config.json
// ──────────────────────────────────────────────

export interface ForbiddenSubgraph {
  /** Color index (0 = red, 1 = blue, etc.) */
  color: number;
  /** Clique size that must not exist in this color */
  clique_size: number;
}

export interface RamseyArchitectConfig {
  problem_class: "ramsey_coloring";
  /** Vertex count of the complete graph K_n */
  domain_size: number;
  /** Number of colors in the edge coloring */
  num_colors: number;
  /** Clique sizes: r for color 0 (red), s for color 1 (blue) — simplified form */
  r?: number;
  s?: number;
  /** List of forbidden monochromatic cliques — detailed form */
  forbidden_subgraphs?: ForbiddenSubgraph[];
  /** Symmetry constraint: 'circulant' reduces R(4,6) search from 2^595 → 2^17 */
  symmetry?: 'none' | 'circulant';
}

export interface UnknownArchitectConfig {
  problem_class: "unknown";
}

export interface SchurPartitionArchitectConfig {
  problem_class: "schur_partition";
  /** Number of integers to color, i.e. {1..domain_size} */
  domain_size: number;
  /** Number of color classes (partitions) */
  num_partitions: number;
}

/** Discriminated union of all ARCHITECT-emittable search configs */
export type ArchitectSearchConfig =
  | RamseyArchitectConfig
  | SchurPartitionArchitectConfig
  | UnknownArchitectConfig;

// ──────────────────────────────────────────────
// Types consumed by the SA engine
// ──────────────────────────────────────────────

export interface SearchConfig {
  type: string;
  n: number;
  r: number;
  s: number;
  saIterations: number;
  workers: number;
  strategy: "single" | "island_model";
  /** Symmetry constraint passed to the SA engine */
  symmetry?: 'none' | 'circulant';
}

// ──────────────────────────────────────────────
// 1. Constructive Existence Detection
// ──────────────────────────────────────────────

/**
 * Does the Lean theorem signature indicate a constructive existence proof?
 * Checks for ∃ (Unicode) or Exists (ASCII Lean keyword).
 */
export function isConstructiveExistence(signature: string): boolean {
  const trimmed = signature.replace(/^\s*:?\s*/, "");
  return trimmed.startsWith("∃") || trimmed.startsWith("Exists");
}

// ──────────────────────────────────────────────
// 2. Search Config Extraction
// ──────────────────────────────────────────────

/**
 * Convert an ARCHITECT-generated ArchitectSearchConfig into a SearchConfig
 * for the SA engine. Returns null if the problem class is unknown or
 * the config is missing required fields.
 *
 * Auto-scales concurrency based on vertex count:
 *   - Small  (≤20v): single worker,  10M iterations
 *   - Medium (21-30v): 4 workers,   100M iterations each
 *   - Large  (>30v):  8 workers,    500M iterations each
 */
export function extractSearchConfig(cfg: ArchitectSearchConfig): SearchConfig | null {
  switch (cfg.problem_class) {
    case "ramsey_coloring": {
      const n = cfg.domain_size;
      if (!n) return null;

      // Resolve r and s — try forbidden_subgraphs first, then top-level r/s fields
      let r: number | undefined;
      let s: number | undefined;

      const fg = cfg.forbidden_subgraphs;
      if (fg && fg.length >= 2) {
        r = fg.find(f => f.color === 0)?.clique_size;
        s = fg.find(f => f.color === 1)?.clique_size;
      }

      // Fallback: top-level r/s (simpler form the ARCHITECT sometimes emits)
      r = r ?? cfg.r;
      s = s ?? cfg.s;

      if (!r || !s) return null;

      // Auto-scale concurrency
      let saIterations: number;
      let workers: number;
      let strategy: "single" | "island_model";

      if (n <= 20) {
        saIterations = 10_000_000;
        workers = 1;
        strategy = "single";
      } else if (n <= 30) {
        saIterations = 100_000_000;
        workers = 4;
        strategy = "island_model";
      } else {
        saIterations = 500_000_000;
        workers = 8;
        strategy = "island_model";
      }

      return { type: "ramsey_sa", n, r, s, saIterations, workers, strategy, symmetry: cfg.symmetry };
    }

    case "unknown":
    default:
      return null;
  }
}
