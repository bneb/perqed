/**
 * Witness Detector — General-purpose constructive existence detection.
 *
 * Separates concerns: the ARCHITECT formulates math,
 * the orchestrator detects when a search phase is needed
 * and auto-configures it.
 *
 *   1. isConstructiveExistence(sig) — does the theorem need a witness?
 *   2. classifyProblem(desc) — what kind of problem is it?
 *   3. extractSearchConfig(pc) — build a search config for that class
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ProblemClass {
  type: "ramsey" | "srg" | "unknown";
  params: Record<string, number>;
}

export interface SearchConfig {
  type: string;
  n: number;
  r: number;
  s: number;
  saIterations: number;
  workers: number;
  strategy: "single" | "island_model";
}

// ──────────────────────────────────────────────
// 1. Constructive Existence Detection
// ──────────────────────────────────────────────

/**
 * Does the theorem signature indicate a constructive existence proof?
 * Checks for ∃ (Unicode) or Exists (ASCII Lean keyword).
 */
export function isConstructiveExistence(signature: string): boolean {
  const trimmed = signature.replace(/^\s*:?\s*/, "");
  return trimmed.startsWith("∃") || trimmed.startsWith("Exists");
}

// ──────────────────────────────────────────────
// 2. Problem Classification
// ──────────────────────────────────────────────

// Pattern: R(r,s) >= bound  or  Ramsey R(r,s)
// Captures: r, s, and (bound - 1) = vertices
const RAMSEY_PATTERN = /R\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*>=?\s*(\d+)/i;
// Natural language: "Ramsey number R(r,s) is at least N"
const RAMSEY_NL_PATTERN = /R\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s+(?:is\s+)?at\s+least\s+(\d+)/i;
// Pattern: "K_n with no monochromatic K_r"
const MONO_K_PATTERN = /K[_\s]*(\d+)\s+with\s+no\s+monochromatic\s+K[_\s]*(\d+)/i;
// Pattern: find a N-vertex graph
const VERTEX_PATTERN = /(\d+)\s*-?\s*vertex/i;

/**
 * Classify a problem description into a known problem class + parameters.
 */
export function classifyProblem(description: string): ProblemClass {
  // Try structured Ramsey pattern: R(4,4) >= 18
  const ramseyMatch = description.match(RAMSEY_PATTERN) ?? description.match(RAMSEY_NL_PATTERN);
  if (ramseyMatch) {
    const r = parseInt(ramseyMatch[1]!, 10);
    const s = parseInt(ramseyMatch[2]!, 10);
    const bound = parseInt(ramseyMatch[3]!, 10);
    const vertices = bound - 1;

    const vertexMatch = description.match(VERTEX_PATTERN);
    const explicitVertices = vertexMatch ? parseInt(vertexMatch[1]!, 10) : null;

    return {
      type: "ramsey",
      params: {
        r,
        s,
        vertices: explicitVertices ?? vertices,
      },
    };
  }

  // Try: "K_17 with no monochromatic K_4" pattern
  const monoMatch = description.match(MONO_K_PATTERN);
  if (monoMatch) {
    const n = parseInt(monoMatch[1]!, 10);
    const k = parseInt(monoMatch[2]!, 10);
    return {
      type: "ramsey",
      params: { r: k, s: k, vertices: n },
    };
  }

  return { type: "unknown", params: {} };
}

// ──────────────────────────────────────────────
// 3. Search Config Extraction
// ──────────────────────────────────────────────

/**
 * Given a problem class, build the search configuration.
 * Returns null if the problem class is unknown or unsupported.
 *
 * Auto-scales concurrency:
 *   - Small (≤20 vertices): single worker, 10M iterations
 *   - Medium (21-30 vertices): 4 workers, 100M iterations each
 *   - Large (>30 vertices): 8 workers, 500M iterations each
 */
export function extractSearchConfig(pc: ProblemClass): SearchConfig | null {
  switch (pc.type) {
    case "ramsey": {
      const { r, s, vertices } = pc.params;
      if (!r || !s || !vertices) return null;

      // Scale based on vertex count tiers
      let saIterations: number;
      let workers: number;
      let strategy: "single" | "island_model";

      if (vertices <= 20) {
        // Small: single core is fast enough
        saIterations = 10_000_000;
        workers = 1;
        strategy = "single";
      } else if (vertices <= 30) {
        // Medium: moderate parallelism
        saIterations = 100_000_000;
        workers = 4;
        strategy = "island_model";
      } else {
        // Large: full parallelism, long budget
        saIterations = 500_000_000;
        workers = 8;
        strategy = "island_model";
      }

      return {
        type: "ramsey_sa",
        n: vertices,
        r,
        s,
        saIterations,
        workers,
        strategy,
      };
    }

    case "unknown":
    default:
      return null;
  }
}
