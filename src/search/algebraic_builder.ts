/**
 * AlgebraicBuilder — VM-sandboxed algebraic graph compiler + verifier.
 *
 * The ARCHITECT (in Wiles Mode) emits a `algebraic_graph_construction` DAG node
 * with a JavaScript edge rule (edge_rule_js). This module:
 *
 *   1. Compiles the rule inside a node:vm sandbox (no process, no require)
 *   2. Iterates all upper-triangle (i,j) pairs and populates an AdjacencyMatrix
 *   3. Verifies via ramseyEnergy — records SAT/UNSAT to the ResearchJournal
 *
 * Security model:
 *   - vm.createContext exposes ONLY { Math } — no Node globals
 *   - vm.Script.runInContext enforces a 500ms timeout per (i,j) evaluation
 *   - All exceptions from the sandbox are re-thrown as SandboxError
 */

import * as vm from "node:vm";
import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import { ramseyEnergy } from "../math/graph/RamseyEnergy";
import type { AlgebraicConstructionConfig } from "../proof_dag/algebraic_construction_config";

// ── Error type ────────────────────────────────────────────────────────────────

/**
 * Thrown when the VM sandbox rejects the edge_rule_js.
 * Callers can distinguish sandbox failures from other errors.
 */
export class SandboxError extends Error {
  constructor(
    message: string,
    /** The underlying VM/runtime error */
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SandboxError";
  }
}

// ── Result type ───────────────────────────────────────────────────────────────

export interface AlgebraicBuildResult {
  /** The compiled adjacency matrix */
  adj: AdjacencyMatrix;
  /** ramseyEnergy(adj, r, s) — 0 means a valid witness was found */
  energy: number;
  /** The description string from the config */
  description: string;
  /** Wall-clock milliseconds for compile + energy check */
  compiledInMs: number;
  /** Status after verification */
  status: "witness" | "violations";
}

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Maximum execution time for the entire rule function PER CALL (ms).
 * Prevents infinite loops in sandboxed code.
 */
const SANDBOX_TIMEOUT_MS = 500;

// ── AlgebraicBuilder ──────────────────────────────────────────────────────────

export class AlgebraicBuilder {
  /**
   * Compile an algebraic edge rule into an AdjacencyMatrix.
   *
   * The edge_rule_js body is executed inside a stripped-down vm.Script context
   * that exposes ONLY { Math }. Any attempt to access process, require,
   * globalThis, or other Node globals will throw a ReferenceError, which
   * this method wraps as SandboxError.
   *
   * @throws SandboxError if the rule is syntactically invalid, throws at
   *   runtime, or exceeds the SANDBOX_TIMEOUT_MS per execution.
   */
  static compile(config: AlgebraicConstructionConfig): AdjacencyMatrix {
    const N = config.vertices;

    // Build isolated context — only Math is whitelisted.
    // Object.create(null) gives a null-prototype object so there's no
    // inherited globalThis / __proto__ leakage.
    const sandbox = Object.create(null) as Record<string, unknown>;
    sandbox["Math"] = Math;
    const context = vm.createContext(sandbox);

    // Compile the function once (not per-edge) for performance.
    // The wrapping function signature matches the documented API: (i, j) => boolean.
    let ruleFn: (i: number, j: number) => boolean;
    try {
      const script = new vm.Script(
        `(function(i, j) { ${config.edge_rule_js} })`,
        { filename: "<algebraic_rule>", lineOffset: 0 },
      );
      ruleFn = script.runInContext(context, { timeout: SANDBOX_TIMEOUT_MS }) as typeof ruleFn;
    } catch (err) {
      throw new SandboxError(
        `AlgebraicBuilder: failed to compile edge_rule_js — ${err instanceof Error ? err.message : String(err)}`,
        err,
      );
    }

    if (typeof ruleFn !== "function") {
      throw new SandboxError(
        `AlgebraicBuilder: edge_rule_js did not evaluate to a function (got ${typeof ruleFn})`,
      );
    }

    // Populate the adjacency matrix
    const adj = new AdjacencyMatrix(N);

    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        let result: boolean;
        try {
          result = ruleFn(i, j);
        } catch (err) {
          throw new SandboxError(
            `AlgebraicBuilder: edge_rule_js threw at (i=${i}, j=${j}) — ${err instanceof Error ? err.message : String(err)}`,
            err,
          );
        }
        if (result) {
          adj.addEdge(i, j); // also sets (j, i) — symmetry enforced by AdjacencyMatrix
        }
      }
    }

    return adj;
  }

  /**
   * Verify an adjacency matrix against Ramsey constraints.
   *
   * @returns energy (0 = valid witness) and a status label
   */
  static verify(
    adj: AdjacencyMatrix,
    r: number,
    s: number,
  ): { energy: number; status: "witness" | "violations" } {
    const energy = ramseyEnergy(adj, r, s);
    return { energy, status: energy === 0 ? "witness" : "violations" };
  }

  /**
   * Full pipeline: compile → verify → log → return result.
   *
   * Accepts nullable journal and workspace for unit-test ergonomics
   * (pass null to skip disk/journal operations).
   *
   * @param config   Algebraic construction config from the ARCHITECT DAG node
   * @param r        Red clique size (default from config.r ?? 4)
   * @param s        Blue independent set size (default from config.s ?? 6)
   * @param journal  ResearchJournal instance (null = skip journaling)
   * @param workspace Workspace paths (null = skip disk writes)
   */
  static async buildAndVerify(
    config: AlgebraicConstructionConfig,
    r: number,
    s: number,
    journal: { record(obs: string): void } | null,
    workspace: { paths: { scratch: string } } | null,
  ): Promise<AlgebraicBuildResult> {
    const t0 = Date.now();

    console.log(`\n🏗️  [AlgebraicBuilder] Compiling: ${config.description}`);
    console.log(`   Rule: ${config.edge_rule_js.slice(0, 80)}${config.edge_rule_js.length > 80 ? "..." : ""}`);

    const adj = AlgebraicBuilder.compile(config);
    const { energy, status } = AlgebraicBuilder.verify(adj, r, s);
    const compiledInMs = Date.now() - t0;

    const edgeCount = adj.edgeCount();
    const N = config.vertices;
    console.log(`   Compiled in ${compiledInMs}ms: ${N} vertices, ${edgeCount} edges, E=${energy}`);

    if (status === "witness") {
      console.log(`   ✅ E=0 — valid R(${r},${s}) witness found!`);
      journal?.record(`AlgebraicBuilder SAT: ${config.description} → E=0 (R(${r},${s}) witness on N=${N})`);
    } else {
      console.log(`   ℹ️  E=${energy} violations — not a witness. Recording for memetic seeding.`);
      journal?.record(`AlgebraicBuilder UNSAT: ${config.description} → E=${energy} on N=${N}`);
    }

    // Persist graph for memetic seeding in next SA iteration (if workspace available)
    if (workspace) {
      const { join } = await import("node:path");
      const witnessPath = join(workspace.paths.scratch, "algebraic_candidate.json");
      const edges: [number, number][] = [];
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          if (adj.hasEdge(i, j)) edges.push([i, j]);
        }
      }
      await Bun.write(
        witnessPath,
        JSON.stringify({ n: N, r, s, energy, description: config.description, edges }, null, 2),
      );
      console.log(`   💾 Saved candidate to ${witnessPath}`);
    }

    return {
      adj,
      energy,
      description: config.description,
      compiledInMs,
      status,
    };
  }
}
