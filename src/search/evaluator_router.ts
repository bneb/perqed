/**
 * EvaluatorRouter — Dynamic evaluation backend multiplexer.
 *
 * Routes a compiled AdjacencyMatrix to the correct C++ penalty function
 * based on the `evaluator_type` field in the RunConfig.
 *
 * Supported backends:
 *   - RAMSEY_CLIQUES:       Existing ramseyEnergy (# K_r red cliques + # K_s ind-sets)
 *   - SUM_FREE_PARTITION:   Sum-free partition energy (Int8Array input)
 *   - JIT_CPP:              Runtime-compiled C++ via bun:ffi (cached per runName)
 *   - SRG_PARAMETERS:       [STUB] Strongly Regular Graph parameter compliance
 *   - MATRIX_ORTHOGONALITY: [STUB] Hadamard / OA matrix orthogonality violation count
 */

import { ramseyEnergy } from "../math/graph/RamseyEnergy";
import type { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import { computeSumFreeEnergy } from "../math/optim/SumFreeEnergy";
import { buildAndLoadEvaluator, type CompiledEvaluator, STUB_CPP_RAMSEY } from "./dynamic_evaluator";

// ── Evaluator type enum ───────────────────────────────────────────────────────

export type EvaluatorType =
  | "RAMSEY_CLIQUES"
  | "SRG_PARAMETERS"
  | "MATRIX_ORTHOGONALITY"
  | "SUM_FREE_PARTITION"
  | "JIT_CPP";

// ── Options passed to EvaluatorRouter ────────────────────────────────────────

export interface EvaluatorOptions {
  evaluator_type: EvaluatorType;
  /** Red clique size — required for RAMSEY_CLIQUES and JIT_CPP */
  r?: number;
  /** Blue independent set size — required for RAMSEY_CLIQUES and JIT_CPP */
  s?: number;
  /** Domain size — required for SUM_FREE_PARTITION */
  domain_size?: number;
  /** Number of color classes — required for SUM_FREE_PARTITION */
  num_partitions?: number;
  /** C++ source code — used for JIT_CPP. Defaults to STUB_CPP_RAMSEY. */
  cppSource?: string;
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

/**
 * Stateful, per-runName evaluator router with FFI caching.
 *
 * Usage:
 *   const router = EvaluatorRouter.getInstance(config.run_name);
 *   const energy = await router.evaluate(adj, { evaluator_type: "JIT_CPP", r: 4, s: 6 });
 *   router.dispose(); // at end of run
 */
export class EvaluatorRouter {
  // ── Singleton registry ─────────────────────────────────────────────────────
  private static readonly registry = new Map<string, EvaluatorRouter>();

  /**
   * Get or create the EvaluatorRouter for the given run.
   * Subsequent calls with the same runName return the identical instance.
   */
  static getInstance(runName: string): EvaluatorRouter {
    const existing = EvaluatorRouter.registry.get(runName);
    if (existing) return existing;
    const instance = new EvaluatorRouter(runName);
    EvaluatorRouter.registry.set(runName, instance);
    return instance;
  }

  // ── Instance state ─────────────────────────────────────────────────────────
  private readonly runName: string;
  /** Cache: maps cppSource hash (first 32 chars) → compiled FFI evaluator */
  private readonly ffiCache = new Map<string, CompiledEvaluator>();

  private constructor(runName: string) {
    this.runName = runName;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Evaluate a graph or partition using the backend specified in `options`.
   *
   * For JIT_CPP: compiles the C++ source on first call, caches the resulting
   * shared library. Subsequent calls reuse the cached FFI handle — no
   * additional compilation or dlopen overhead.
   *
   * @param state   Either an AdjacencyMatrix (graph problems) or Int8Array (partition problems)
   * @param options Routing options including evaluator_type and backend params
   * @returns       Energy score (0 = valid witness)
   * @throws        NotImplementedError for uncompiled backends
   */
  async evaluate(
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

      case "JIT_CPP": {
        if (state instanceof Int8Array) throw new Error("JIT_CPP expects an AdjacencyMatrix, not Int8Array");
        return this._jitEvaluate(state, options);
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

  /**
   * Release all cached FFI evaluators for this run.
   * Call at the end of a search run to avoid handle leaks.
   */
  dispose(): void {
    for (const [key, evaluator] of this.ffiCache) {
      try { evaluator.cleanup(); } catch {}
      this.ffiCache.delete(key);
    }
    EvaluatorRouter.registry.delete(this.runName);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _jitEvaluate(adj: AdjacencyMatrix, options: EvaluatorOptions): Promise<number> {
    const cppSource = options.cppSource ?? STUB_CPP_RAMSEY;

    // Cache key: use first 64 chars of source as fingerprint (fast + sufficient for identity)
    const cacheKey = cppSource.slice(0, 64);

    let compiled = this.ffiCache.get(cacheKey);
    if (!compiled) {
      // First call: compile and cache
      const libName = `${this.runName}_${this.ffiCache.size}`;
      compiled = await buildAndLoadEvaluator(libName, cppSource);
      this.ffiCache.set(cacheKey, compiled);
      console.log(`[EvaluatorRouter] JIT compiled evaluator for run=${this.runName} (libName=${libName})`);
    }

    // Use adj.raw directly — already Uint8Array, no copy needed
    return compiled.evaluate(adj.raw, adj.n);
  }
}
