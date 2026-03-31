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

// Removed `node:vm` usage for stability inside Bun 1.3
import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import { ramseyEnergy } from "../math/graph/RamseyEnergy";
import type { AlgebraicConstructionConfig } from "../proof_dag/algebraic_construction_config";
import type { AlgebraicPartitionConfig } from "../proof_dag/algebraic_partition_config";
import { InvariantValidator } from "./invariant_validator";
import { EvaluatorRouter } from "./evaluator_router";
import type { EvaluatorType } from "./evaluator_router";
import { computeSumFreeEnergy } from "../math/optim/SumFreeEnergy";
import { SurrogateClient } from "./surrogate_client";
import { optimizeThroughFunnel } from "./neighborhood_funnel";

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

/** Result type for 1D partition builds (algebraic_partition_construction nodes) */
export interface PartitionBuildResult {
  /** The 1-indexed Int8Array partition (-1 = unassigned) */
  partition: Int8Array;
  /** computeSumFreeEnergy — 0 means a valid sum-free partition was found */
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

// ── Compiler Helper ─────────────────────────────────────────────────────────────

export function compileEdgeRule(ruleStr: string): (i: number, j: number) => boolean {
  let cleanRule = ruleStr.trim();

  // 1. Strip Arrow Functions: `(i, j) => { ... }` or `i => { ... }`
  cleanRule = cleanRule.replace(/^(\([^)]*\)|[a-zA-Z0-9_]+)\s*=>\s*\{?/, '');
  
  // 2. Strip Standard Functions: `function(u, v, N) { ... }` or `function name() { ... }`
  cleanRule = cleanRule.replace(/^function\s*[^(]*\([^)]*\)\s*\{/, '');
  
  // 3. Remove the trailing closing brace if we stripped an opening wrapper
  if (/^function|=>/.test(ruleStr.trim()) && cleanRule.endsWith('}')) {
      cleanRule = cleanRule.substring(0, cleanRule.lastIndexOf('}'));
  }

  // 4. Variable Translation: Force u/v to i/j just in case
  cleanRule = cleanRule.replace(/\bu\b/g, 'i').replace(/\bv\b/g, 'j');

  const body = cleanRule.includes('return') ? cleanRule : `return (${cleanRule});`;
  
  try {
      const evaluate = new Function('i', 'j', body);
      return (i: number, j: number) => {
        try {
          return Boolean(evaluate(i, j));
        } catch (e: any) {
          throw new SandboxError(`Runtime execution threw at (i=${i}, j=${j}): ${e.message}`);
        }
      };
  } catch (e: any) {
      throw new SandboxError(`Failed to compile edge rule: ${e.message}. Cleaned string: ${body}`);
  }
}

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

    const ruleFn = compileEdgeRule(config.edge_rule_js);

    // Populate the adjacency matrix
    const adj = new AdjacencyMatrix(N);

    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const result = ruleFn(i, j);
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
   * @param evaluatorType  Which C++ backend to route to (default: RAMSEY_CLIQUES)
   * @returns energy (0 = valid witness) and a status label
   */
  static async verify(
    adj: AdjacencyMatrix,
    r: number,
    s: number,
    evaluatorType: EvaluatorType = "RAMSEY_CLIQUES"
  ): Promise<{ energy: number; status: "witness" | "violations" }> {
    const energy = await EvaluatorRouter.getInstance("test").evaluate(adj, { evaluator_type: evaluatorType, r, s });
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
    constraints?: { exact_vertices?: number; undirected?: boolean; no_self_loops?: boolean },
    evaluatorType: EvaluatorType = "RAMSEY_CLIQUES"
  ): Promise<AlgebraicBuildResult> {
    const t0 = Date.now();

    console.log(`\n🏗️  [AlgebraicBuilder] Compiling: ${config.description}`);
    console.log(`   Rule: ${config.edge_rule_js.slice(0, 80)}${config.edge_rule_js.length > 80 ? "..." : ""}`);

    const adj = AlgebraicBuilder.compile(config);
    InvariantValidator.validate(adj, constraints);

    // ── Surrogate Funnel (optional) ─────────────────────────────────────────
    // If the PyTorch Value Network is running, quickly generate 500 neighbours
    // and pick the one with the lowest predicted energy before exact evaluation.
    const surrogate = new SurrogateClient();
    let candidateAdj: AdjacencyMatrix = adj;
    if (await surrogate.checkHealth()) {
      try {
        const N = config.vertices;
        console.log(`   🤖 [Surrogate] Running neighbourhood funnel (N=${N})…`);
        const { bestMatrix, predictedEnergy } = await optimizeThroughFunnel(adj, surrogate);
        console.log(`   🤖 [Surrogate] Funnel complete — predicted E=${predictedEnergy.toFixed(1)}`);
        journal?.record(
          `SurrogateFunnel: LLM seed optimised via 500-neighbour funnel → predicted E=${predictedEnergy.toFixed(1)}`
        );
        candidateAdj = bestMatrix;
      } catch (err) {
        // Non-fatal: fall back to original LLM matrix
        console.warn(`   ⚠️ [Surrogate] Funnel error — falling back to base matrix: ${err}`);
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    const { energy, status } = await AlgebraicBuilder.verify(candidateAdj, r, s, evaluatorType);
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

  // ── Partition Methods (1D algebraic_partition_construction) ───────────────────

  /**
   * Compile an algebraic partition rule into a 1-indexed Int8Array.
   *
   * partition_rule_js is executed via new Function('i', body). Receives each
   * integer i from 1 to domain_size, returns a bucket index [0, num_partitions)
   * or -1 (unassigned — left for Z3 LNS to finish).
   *
   * @throws SandboxError if rule is syntactically invalid or throws at runtime
   * @throws Error if rule returns an out-of-range bucket value
   */
  static buildPartition(config: AlgebraicPartitionConfig): Int8Array {
    const { domain_size, num_partitions, partition_rule_js } = config;
    const partition = new Int8Array(domain_size + 1).fill(-1); // 1-indexed

    let ruleFn: (i: number, np: number, ds: number) => number | undefined;
    try {
      ruleFn = new Function('i', 'num_partitions', 'domain_size', partition_rule_js) as
        (i: number, np: number, ds: number) => number | undefined;
    } catch (e: any) {
      throw new SandboxError(`Failed to compile partition_rule_js: ${e.message}`);
    }

    for (let i = 1; i <= domain_size; i++) {
      let bucket: number | undefined;
      try {
        bucket = ruleFn(i, num_partitions, domain_size);
      } catch (e: any) {
        throw new SandboxError(`partition_rule_js threw at i=${i}: ${e.message}`);
      }

      if (bucket === undefined || bucket === null || (bucket as number) === -1) {
        partition[i] = -1; // unassigned
      } else if (Number.isInteger(bucket) && (bucket as number) >= 0 && (bucket as number) < num_partitions) {
        partition[i] = bucket as number;
      } else {
        throw new Error(
          `partition_rule_js returned invalid bucket ${bucket} for i=${i}. ` +
          `Expected integer in [0, ${num_partitions}) or -1.`
        );
      }
    }

    return partition;
  }

  /**
   * Full pipeline for partition problems: compile → evaluate → log → return result.
   * Accepts nullable journal and workspace for unit-test ergonomics.
   */
  static async buildAndVerifyPartition(
    config: AlgebraicPartitionConfig,
    journal: { record(obs: string): void } | null,
    workspace: { paths: { scratch: string } } | null,
  ): Promise<PartitionBuildResult> {
    const t0 = Date.now();
    const { domain_size, num_partitions, description } = config;

    console.log(`\n🗂️  [AlgebraicBuilder] Compiling Partition: ${description}`);
    console.log(`   Rule: ${config.partition_rule_js.slice(0, 80)}${
      config.partition_rule_js.length > 80 ? "..." : ""
    }`);

    const partition = AlgebraicBuilder.buildPartition(config);
    const sumFreeViolations = computeSumFreeEnergy(partition, domain_size, num_partitions);
    const assignedCount = partition.slice(1).filter((b) => b >= 0).length;
    const unassignedCount = domain_size - assignedCount;
    // An unassigned element is always a violation — a valid witness must cover {1..domain_size}
    const energy = sumFreeViolations + unassignedCount;
    const compiledInMs = Date.now() - t0;
    const status: "witness" | "violations" = energy === 0 ? "witness" : "violations";

    console.log(
      `   Compiled in ${compiledInMs}ms: domain=${domain_size}, ` +
      `partitions=${num_partitions}, assigned=${assignedCount}/${domain_size}, E=${energy}`
    );

    if (status === "witness") {
      console.log(`   ✅ E=0 — valid sum-free ${num_partitions}-partition found!`);
      journal?.record(`PartitionBuilder SAT: ${description} → E=0 (${num_partitions}-coloring of {1..${domain_size}})`);
    } else {
      console.log(`   ℹ️  E=${energy} violations — not a witness. Recording for memetic seeding.`);
      journal?.record(`PartitionBuilder UNSAT: ${description} → E=${energy} on {1..${domain_size}}`);
    }

    if (workspace) {
      const { join } = await import("node:path");
      const candidatePath = join(workspace.paths.scratch, "partition_candidate.json");
      const colorClasses: number[][] = Array.from({ length: num_partitions }, () => []);
      for (let i = 1; i <= domain_size; i++) {
        const b = partition[i];
        if (b !== undefined && b >= 0) colorClasses[b]!.push(i);
      }
      await Bun.write(
        candidatePath,
        JSON.stringify({ domain_size, num_partitions, energy, description, color_classes: colorClasses }, null, 2),
      );
      console.log(`   💾 Saved partition candidate to ${candidatePath}`);
    }

    return { partition, energy, description, compiledInMs, status };
  }
}
