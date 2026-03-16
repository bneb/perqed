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
// Pattern: find a N-vertex graph
const VERTEX_PATTERN = /(\d+)\s*-?\s*vertex/i;

/**
 * Classify a problem description into a known problem class + parameters.
 */
export function classifyProblem(description: string): ProblemClass {
  // Try Ramsey pattern
  const ramseyMatch = description.match(RAMSEY_PATTERN);
  if (ramseyMatch) {
    const r = parseInt(ramseyMatch[1]!, 10);
    const s = parseInt(ramseyMatch[2]!, 10);
    const bound = parseInt(ramseyMatch[3]!, 10);
    const vertices = bound - 1;

    // Also check for explicit vertex count in description
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

  return { type: "unknown", params: {} };
}

// ──────────────────────────────────────────────
// 3. Search Config Extraction
// ──────────────────────────────────────────────

/**
 * Given a problem class, build the search configuration.
 * Returns null if the problem class is unknown or unsupported.
 */
export function extractSearchConfig(pc: ProblemClass): SearchConfig | null {
  switch (pc.type) {
    case "ramsey": {
      const { r, s, vertices } = pc.params;
      if (!r || !s || !vertices) return null;

      // Scale iterations with search space complexity
      const edges = vertices * (vertices - 1) / 2;
      const baseIters = 10_000_000;
      // Rough scaling: double iterations for every 50 edges beyond 50
      const scaleFactor = Math.max(1, Math.pow(2, (edges - 50) / 50));
      const saIterations = Math.round(baseIters * scaleFactor);

      return {
        type: "ramsey_sa",
        n: vertices,
        r,
        s,
        saIterations,
      };
    }

    case "unknown":
    default:
      return null;
  }
}
