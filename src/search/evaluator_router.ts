/**
 * EvaluatorRouter — Dynamic evaluation backend multiplexer.
 *
 * Routes a compiled AdjacencyMatrix to the correct C++ penalty function
 * based on the `evaluator_type` field in the RunConfig.
 *
 * Supported backends:
 *   - RAMSEY_CLIQUES:       Existing ramseyEnergy (# K_r red cliques + # K_s ind-sets)
 *   - SRG_PARAMETERS:       [STUB] Strongly Regular Graph parameter compliance
 *   - MATRIX_ORTHOGONALITY: [STUB] Hadamard / OA matrix orthogonality violation count
 */

import { ramseyEnergy } from "../math/graph/RamseyEnergy";
import type { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";

// ── Evaluator type enum ───────────────────────────────────────────────────────

export type EvaluatorType =
  | "RAMSEY_CLIQUES"
  | "SRG_PARAMETERS"
  | "MATRIX_ORTHOGONALITY";

// ── Options passed to EvaluatorRouter ────────────────────────────────────────

export interface EvaluatorOptions {
  evaluator_type: EvaluatorType;
  /** Red clique size — required for RAMSEY_CLIQUES */
  r?: number;
  /** Blue independent set size — required for RAMSEY_CLIQUES */
  s?: number;
}

// ── Error ─────────────────────────────────────────────────────────────────────

/**
 * Thrown when the requested evaluator backend has no compiled implementation.
 * Acts as a typed stub that enables graceful error handling in the outer loop.
 */
export class NotImplementedError extends Error {
  constructor(evaluatorType: EvaluatorType) {
    super(
      `Backend for ${evaluatorType} is not yet compiled or linked. ` +
      `This evaluator type is reserved for a future C++/Rust extension.`
    );
    this.name = "NotImplementedError";
  }
}

// ── EvaluatorRouter ───────────────────────────────────────────────────────────

export class EvaluatorRouter {
  /**
   * Evaluate an adjacency matrix using the backend specified in `options`.
   *
   * @param adj     The compiled graph to evaluate
   * @param options Routing options including evaluator_type and backend params
   * @returns       Energy score (0 = valid witness)
   * @throws        NotImplementedError for uncompiled backends
   */
  static async evaluate(
    adj: AdjacencyMatrix,
    options: EvaluatorOptions,
  ): Promise<number> {
    switch (options.evaluator_type) {
      case "RAMSEY_CLIQUES": {
        const r = options.r ?? 4;
        const s = options.s ?? 6;
        return ramseyEnergy(adj, r, s);
      }

      case "SRG_PARAMETERS":
        throw new NotImplementedError("SRG_PARAMETERS");

      case "MATRIX_ORTHOGONALITY":
        throw new NotImplementedError("MATRIX_ORTHOGONALITY");

      default: {
        // TypeScript exhaustiveness — should never reach here
        const _exhaustive: never = options.evaluator_type;
        throw new NotImplementedError(_exhaustive);
      }
    }
  }
}
