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
import { computeSumFreeEnergy } from "../math/optim/SumFreeEnergy";

// ── Evaluator type enum ───────────────────────────────────────────────────────

export type EvaluatorType =
  | "RAMSEY_CLIQUES"
  | "SRG_PARAMETERS"
  | "MATRIX_ORTHOGONALITY"
  | "SUM_FREE_PARTITION";

// ── Options passed to EvaluatorRouter ────────────────────────────────────────

export interface EvaluatorOptions {
  evaluator_type: EvaluatorType;
  /** Red clique size — required for RAMSEY_CLIQUES */
  r?: number;
  /** Blue independent set size — required for RAMSEY_CLIQUES */
  s?: number;
  /** Domain size — required for SUM_FREE_PARTITION */
  domain_size?: number;
  /** Number of color classes — required for SUM_FREE_PARTITION */
  num_partitions?: number;
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
   * Evaluate a graph or partition using the backend specified in `options`.
   *
   * @param state   Either an AdjacencyMatrix (graph problems) or Int8Array (partition problems)
   * @param options Routing options including evaluator_type and backend params
   * @returns       Energy score (0 = valid witness)
   * @throws        NotImplementedError for uncompiled backends
   */
  static async evaluate(
    state: AdjacencyMatrix | Int8Array,
    options: EvaluatorOptions,
  ): Promise<number> {
    switch (options.evaluator_type) {
      case "RAMSEY_CLIQUES": {
        if (state instanceof Int8Array) throw new Error("RAMSEY_CLIQUES expects an AdjacencyMatrix, not Int8Array");
        const r = options.r ?? 4;
        const s = options.s ?? 6;
        return ramseyEnergy(state, r, s);
      }

      case "SUM_FREE_PARTITION": {
        if (!(state instanceof Int8Array)) throw new Error("SUM_FREE_PARTITION expects Int8Array, not AdjacencyMatrix");
        const domain_size = options.domain_size ?? state.length - 1;
        const num_partitions = options.num_partitions ?? 2;
        return computeSumFreeEnergy(state, domain_size, num_partitions);
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
