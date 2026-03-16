#!/usr/bin/env bun
/**
 * perqed — CLI Entry Point (Single Flow)
 *
 * Formulate → Confirm → Run in one command.
 *
 * Usage:
 *   bun run perqed -- --prompt="Ramsey lower bounds, R(4, 6) >= 37"
 *   bun run perqed -- --prompt="..." --noconfirm    # skip confirmation
 *   bun run perqed -- --config=path/to/run_config.json  # resume from config
 *
 * Prerequisites:
 *   - GEMINI_API_KEY in environment or .env
 */

import { join } from "node:path";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { WorkspaceManager } from "../workspace";
import { SolverBridge } from "../solver";
import { LeanBridge } from "../lean_bridge";
import { AgentFactory } from "../agents/factory";
import { runDynamicLoop } from "../orchestrator";
import { TreePrinter } from "../utils/tree_printer";
import { orchestratedSearch } from "../search/ramsey_orchestrator";
import { ProofRegistry } from "../search/proof_registry";
import {
  buildSearchFailureDigest,
  formatSearchDigestForArchitect,
} from "../search/search_failure_digest";
import {
  isConstructiveExistence,
  extractSearchConfig,
  type ArchitectSearchConfig,
} from "../search/witness_detector";
import { solveWithZ3, isZ3Available } from "../search/z3_ramsey_solver";
import { adjToMatrix } from "../search/ramsey_worker";
import { runLNS } from "../search/lns_solver";
import {
  ResearchJournal,
  distillJournalForPrompt,
  defaultJournalPath,
} from "../search/research_journal";

// ──────────────────────────────────────────────
// CLI Argument Parsing
// ──────────────────────────────────────────────

interface CliArgs {
  prompt?: string;
  configPath?: string;
  noconfirm: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const promptArg = args.find((a) => a.startsWith("--prompt="));
  const configArg = args.find((a) => a.startsWith("--config="));
  const noconfirm = args.includes("--noconfirm");

  if (!promptArg && !configArg) {
    console.error("Usage:");
    console.error("  perqed --prompt=\"<problem description>\"");
    console.error("  perqed --config=<path/to/run_config.json>");
    console.error("  perqed --prompt=\"...\" --noconfirm");
    process.exit(1);
  }

  return {
    prompt: promptArg?.replace("--prompt=", ""),
    configPath: configArg?.replace("--config=", ""),
    noconfirm,
  };
}

// ──────────────────────────────────────────────
// Run Config Schema
// ──────────────────────────────────────────────

export interface SearchPhase {
  type: "ramsey_sa";
  /** Number of vertices */
  vertices: number;
  /** Clique size (red) */
  r: number;
  /** Independent set size (blue) */
  s: number;
  /** Number of SA iterations (default: 10M) */
  sa_iterations?: number;
  /** Search strategy: "single" (default) or "island_model" (multi-worker) */
  strategy?: "single" | "island_model";
  /** Number of workers for island_model (default: 5) */
  workers?: number;
  /** Seed type: "random" (default), "paley", or "circulant" */
  seed?: "random" | "paley" | "circulant";
  /** Symmetry constraint: 'circulant' reduces search space from 2^C(n,2) to 2^floor(n/2) */
  symmetry?: 'none' | 'circulant';
}

export interface RunConfig {
  run_name: string;
  problem_description: string;
  theorem_name: string;
  theorem_signature: string;
  max_iterations: number;
  objective_md: string;
  domain_skills_md: string;
  /** Structured search config emitted by the ARCHITECT — no regex needed */
  search_config: ArchitectSearchConfig;
}

const RUN_CONFIG_SCHEMA = {
  type: SchemaType.OBJECT as const,
  properties: {
    run_name: {
      type: SchemaType.STRING as const,
      description: "A lowercase_underscore slug for the workspace directory",
    },
    problem_description: {
      type: SchemaType.STRING as const,
      description: "One-line human-readable description of the problem",
    },
    theorem_name: {
      type: SchemaType.STRING as const,
      description: "Valid Lean 4 identifier for the theorem",
    },
    theorem_signature: {
      type: SchemaType.STRING as const,
      description: "Complete Lean 4 theorem signature (after 'theorem <name>'). Must be valid Lean 4 syntax.",
    },
    max_iterations: {
      type: SchemaType.NUMBER as const,
      description: "Recommended max orchestrator iterations (10-50)",
    },
    objective_md: {
      type: SchemaType.STRING as const,
      description: "Full markdown for objective.md — problem description, proof strategy, success criteria.",
    },
    domain_skills_md: {
      type: SchemaType.STRING as const,
      description: "Problem-specific tips and tactics for the TACTICIAN.",
    },
    search_config: {
      type: SchemaType.OBJECT as const,
      description: "Structured search configuration. problem_class must be 'ramsey_coloring' or 'unknown'.",
      properties: {
        problem_class: {
          type: SchemaType.STRING as const,
          enum: ["ramsey_coloring", "unknown"],
        },
        domain_size: { type: SchemaType.NUMBER as const, description: "Number of vertices, e.g. 35 for K_35" },
        num_colors: { type: SchemaType.NUMBER as const },
        r: { type: SchemaType.NUMBER as const, description: "Clique size for color 0 (red)" },
        s: { type: SchemaType.NUMBER as const, description: "Clique size for color 1 (blue)" },
        forbidden_subgraphs: {
          type: SchemaType.ARRAY as const,
          items: {
            type: SchemaType.OBJECT as const,
            properties: {
              color: { type: SchemaType.NUMBER as const },
              clique_size: { type: SchemaType.NUMBER as const },
            },
            required: ["color", "clique_size"],
          },
        },
        symmetry: {
          type: SchemaType.STRING as const,
          enum: ["none", "circulant"],
          description: "'circulant' restricts search to circulant graphs: reduces R(4,6) from 2^595 to 2^17 states.",
        },
      },
      required: ["problem_class"],
    },
  },
  required: [
    "run_name", "problem_description", "theorem_name",
    "theorem_signature", "max_iterations", "objective_md", "domain_skills_md",
    "search_config",
  ],
};

// ──────────────────────────────────────────────
// ARCHITECT Preamble
// ──────────────────────────────────────────────

const FORMULATION_PREAMBLE_BASE = `You are the Perqed Problem Formulator. A user has described a mathematical problem they want to prove in Lean 4.

Your job is to produce a structured run configuration that the Perqed proof engine can execute autonomously.

## What You Must Produce

1. **theorem_name**: A valid Lean 4 identifier (e.g., \`ramsey_R4_6_lower_bound_37\`)
2. **theorem_signature**: Valid Lean 4 type signature for the theorem. This is everything after \`theorem <name>\` and before \`:= by\`. It must type-check in Lean 4.
3. **objective_md**: A detailed markdown description of the problem for the TACTICIAN agents
4. **domain_skills_md**: Problem-specific tactical advice (which Lean tactics work for this class of problem, common pitfalls)
5. **max_iterations**: How many orchestrator iterations to budget
6. **search_config**: Structured parameters for the search engine (REQUIRED — see below)

## search_config (CRITICAL)

If the problem requires constructing a witness (∃ in the theorem signature), you must populate search_config:

For Ramsey lower bounds R(r,s) ≥ n (i.e., construct a 2-coloring of K_{n-1}):
\`\`\`json
{
  "problem_class": "ramsey_coloring",
  "domain_size": <n-1>,
  "num_colors": 2,
  "r": <r>,
  "s": <s>,
  "symmetry": "circulant"
}
\`\`\`
For example, R(4,6) ≥ 36 — the known Exoo (1989) witness IS a circulant on 35 vertices:
\`\`\`json
{ "problem_class": "ramsey_coloring", "domain_size": 35, "num_colors": 2, "r": 4, "s": 6, "symmetry": "circulant" }
\`\`\`
**IMPORTANT**: When \`symmetry: circulant\` is used, the Z3 SMT solver is attempted first (exact, ~5-30s). If Z3 returns UNSAT, the circulant space is provably empty and the engine will retry unconstrained.

For problems that do NOT require a constructive witness:
\`\`\`json
{ "problem_class": "unknown" }
\`\`\`

## Important Rules

- The theorem must be **formally expressible** in Lean 4 using Fin types, Bool functions, or Nat
- For graph theory problems, encode graphs as \`Fin n → Fin n → Bool\` (adjacency function)
- For Ramsey lower bounds R(r,s) ≥ n, the theorem states: ∃ coloring of K_{n-1} with no red K_r and no blue K_s
- Break large problems into decidable finite instances when possible
- Include relevant Mathlib imports if needed, but prefer self-contained proofs

## Available Infrastructure

The Perqed engine has:
- Simulated Annealing search engine (graph-level, ~500K IPS per core)
- Multi-core Island Model orchestrator (8 workers, ~4M IPS total)
- Lean 4 kernel verification via \`decide\` tactic
- DeepSeek Prover (local) + Gemini (cloud) multi-agent tactic search

`;

// Build the preamble with journal context injected
/** Build the ARCHITECT preamble, injecting distilled journal context before the problem statement. */
async function buildPreamble(journalPath: string, goal: string): Promise<string> {
  const journal = new ResearchJournal(journalPath);
  const entries = await journal.getEntriesForGoal(goal);
  const journalContext = distillJournalForPrompt(entries);
  if (!journalContext) return FORMULATION_PREAMBLE_BASE + "## The User's Problem Description\n\n";
  return (
    FORMULATION_PREAMBLE_BASE +
    journalContext + "\n" +
    "## The User's Problem Description\n\n"
  );
}

// ──────────────────────────────────────────────
// Phase 1: Formulate
// ──────────────────────────────────────────────

async function formulate(prompt: string, apiKey: string): Promise<RunConfig> {
  console.log("🏛️  Asking ARCHITECT to formulate the problem...\n");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction:
      "You are the Perqed Problem Formulator. Output a structured JSON run configuration for the Perqed proof engine.",
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: RUN_CONFIG_SCHEMA as any,
    },
  });

  // ── Librarian: inject relevant literature context ──
  let libraryContext = "";
  try {
    const { LocalEmbedder } = await import("../embeddings/embedder");
    const { VectorDatabase } = await import("../embeddings/vector_store");
    const embedder = new LocalEmbedder();
    const db = new VectorDatabase();
    await db.initialize();

    const queryVector = await embedder.embed(prompt);
    if (queryVector.length > 0) {
      const matches = await db.search(queryVector, 5);
      if (matches.length > 0) {
        libraryContext = "\n\n## Relevant Literature (from vector DB)\n\n";
        matches.forEach((m, i) => {
          libraryContext += `${i + 1}. **${m.theoremSignature}**\n   ${m.successfulTactic}\n\n`;
        });
        console.log(`📚 Librarian found ${matches.length} relevant premises`);
      }
    }
  } catch {
    // Ollama or LanceDB not available — proceed without library context
  }

  const doFormulate = async (previousError?: string) => {
    let p = FORMULATION_PREAMBLE_BASE + "## The User's Problem Description\n\n" + prompt + libraryContext;
    if (previousError) {
      p += `\n\n## ⚠️ Previous Response Error\nYour last response caused this error:\n\`\`\`\n${previousError}\n\`\`\`\nPlease respond with a valid JSON object only. No markdown.`;
    }
    const result = await model.generateContent(p);
    let text = result.response.text().trim();
    if (text.startsWith("```json")) text = text.replace(/^```json/i, "");
    else if (text.startsWith("```")) text = text.replace(/^```/, "");
    if (text.endsWith("```")) text = text.replace(/```$/, "");
    return JSON.parse(text.trim()) as RunConfig;
  };

  const config = await callSafe(doFormulate, 3, "ARCHITECT formulate");
  if (!config) throw new Error("ARCHITECT failed to produce a valid run configuration after 3 attempts.");
  return config;
}

// ──────────────────────────────────────────────
// Phase 2: Confirm
// ──────────────────────────────────────────────

function displayConfig(config: RunConfig, configPath: string) {
  console.log("✅ ARCHITECT produced run configuration:\n");
  console.log(`  Run Name:  ${config.run_name}`);
  console.log(`  Problem:   ${config.problem_description}`);
  console.log(`  Theorem:   ${config.theorem_name}`);
  console.log(`  Budget:    ${config.max_iterations} iterations`);
  console.log(`  Signature: ${config.theorem_signature.slice(0, 100)}...`);
  console.log(`  Config:    ${configPath}`);
  console.log();
}

async function confirmOrAbort(): Promise<void> {
  console.log("Continue with this plan? [Y/n] (or use --noconfirm to skip)");
  process.stdout.write("> ");

  const response = await new Promise<string>((resolve) => {
    const handler = (chunk: Buffer) => {
      process.stdin.removeListener("data", handler);
      process.stdin.pause();
      resolve(chunk.toString().trim().toLowerCase());
    };
    process.stdin.resume();
    process.stdin.once("data", handler);
  });

  if (response && response !== "y" && response !== "yes") {
    console.log("\n🛑 Aborted. Config saved — re-run with --config= to resume.");
    process.exit(0);
  }
  console.log();
}

// ──────────────────────────────────────────────
// Search Pivot: ARCHITECT Escalation
// ──────────────────────────────────────────────

const SEARCH_PIVOT_PREAMBLE = `You are the Perqed Search Orchestrator. A Simulated Annealing search for a Ramsey witness has FAILED.

You will receive a SearchFailureDigest containing full thermodynamic telemetry: best energy, temperature trajectory, IPS, failure diagnosis, and a recommendation.

You must produce an UPDATED search_phase configuration that addresses the diagnosed failure.

## Pivot Strategies (choose based on diagnosis)

1. **TEMPERATURE_NOT_COOLING**: Fix the cooling rate. Use: coolingRate = exp(ln(0.01/T_init) / (0.8 * iters))
2. **REHEAT_TOO_AGGRESSIVE**: Increase reheatAfter by 10x, or use geometric reheat decay
3. **GLASS_FLOOR**: Increase sa_iterations by 5-10x. If that was already tried, this problem may need a structural approach.
4. **INSUFFICIENT_BUDGET**: Increase sa_iterations by 5-10x

## CRITICAL RULES
- You MUST NOT change the problem (vertices, r, s) — only the search hyperparameters
- You MUST increase sa_iterations if the previous attempt ran out of budget
- If this is attempt 2+, switch strategy to "island_model" with 5-10 workers
- If this is attempt 3+, also try seed="paley" (if n is prime and ≡ 1 mod 4) or increase workers
- If nothing works, try dramatically larger budgets (50M-100M iterations)
- Output ONLY the updated search_phase JSON

`;

const SEARCH_PIVOT_SCHEMA = {
  type: SchemaType.OBJECT as const,
  properties: {
    type: { type: SchemaType.STRING as const, enum: ["ramsey_sa"] },
    vertices: { type: SchemaType.NUMBER as const },
    r: { type: SchemaType.NUMBER as const },
    s: { type: SchemaType.NUMBER as const },
    sa_iterations: { type: SchemaType.NUMBER as const },
    strategy: { type: SchemaType.STRING as const, enum: ["single", "island_model"] },
    workers: { type: SchemaType.NUMBER as const },
    seed: { type: SchemaType.STRING as const, enum: ["random", "paley", "circulant"] },
    symmetry: { type: SchemaType.STRING as const, enum: ["none", "circulant"] },
  },
  required: ["type", "vertices", "r", "s", "sa_iterations"],
};

/**
 * Generic retry wrapper for fallible LLM calls.
 *
 * Calls fn(previousError?) up to maxRetries times. On each failure,
 * the error message is passed back into the next call so the model
 * can correct its response. Returns the result of the first success,
 * or null if all attempts are exhausted.
 */
async function callSafe<T>(
  fn: (previousError?: string) => Promise<T>,
  maxRetries: number,
  label = "call",
): Promise<T | null> {
  let lastError: string | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn(lastError);
    } catch (err) {
      lastError = String(err);
      console.log(`   ⚠️  ${label} attempt ${attempt}/${maxRetries} failed: ${lastError.slice(0, 100)}`);
      if (attempt < maxRetries) {
        console.log(`   🔄 Retrying with error context...`);
      }
    }
  }
  return null;
}

async function requestSearchPivot(
  apiKey: string,
  digestText: string,
  currentConfig: SearchPhase,
  previousError?: string,
): Promise<SearchPhase> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction:
      "You are the Perqed Search Orchestrator. Output an updated search_phase JSON object only. No markdown, no code blocks.",
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: SEARCH_PIVOT_SCHEMA as any,
      maxOutputTokens: 500,
    },
  });

  // Cap digest to first 1500 chars — prevents prompt bloat eating into output budget
  const digestSummary = digestText.slice(0, 1500);

  let prompt = SEARCH_PIVOT_PREAMBLE +
    `## Current Configuration\n${JSON.stringify(currentConfig)}\n\n` +
    `## SearchFailureDigest\n${digestSummary}`;

  if (previousError) {
    prompt += `\n\n## Previous Error\n${previousError.slice(0, 200)}`;
  }

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  return JSON.parse(text) as SearchPhase; // responseSchema guarantees valid JSON
}

// ──────────────────────────────────────────────
// Phase 3: Run
// ──────────────────────────────────────────────

async function executeRun(config: RunConfig, apiKey: string): Promise<void> {
  const workspaceBase = join(import.meta.dir, "../../agent_workspace");
  const workspace = new WorkspaceManager(workspaceBase, config.run_name);
  await workspace.init();

  // Write objective + domain skills
  await Bun.write(workspace.paths.objective, config.objective_md);
  const skillsPath = join(workspace.paths.domainSkills, "problem_context.md");
  await Bun.write(skillsPath, config.domain_skills_md);

  console.log("═══════════════════════════════════════════════");
  console.log("  🔥 PERQED — Execution");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Workspace: ${workspace.paths.runDir}`);
  console.log("═══════════════════════════════════════════════\n");

  const startTime = Date.now();
  const MAX_ARCHITECT_PIVOTS = 5;

  // ── Research Journal: persistent cross-run memory ──
  const journalPath = defaultJournalPath(join(workspace.paths.runDir, "..", ".."));
  const journal = new ResearchJournal(journalPath);
  const targetGoal = `R(${config.search_config?.r ?? "?"},${config.search_config?.s ?? "?"}) >= ${(config.search_config?.domain_size ?? 0) + 1}`;

  // ── Search Phase: triggered by ARCHITECT-emitted search_config ──
  // search_config.problem_class is the authoritative signal — the ARCHITECT
  // emits it as structured JSON so it's reliable regardless of theorem_signature format.
  // isConstructiveExistence is a secondary sanity check only.
  const needsSearch = config.search_config?.problem_class !== "unknown"
    && config.search_config?.problem_class !== undefined;
  let searchPhase: SearchPhase | null = null;

  if (needsSearch) {
    const searchConfig = extractSearchConfig(config.search_config);

    if (searchConfig) {
      searchPhase = {
        type: searchConfig.type as "ramsey_sa",
        vertices: searchConfig.n,
        r: searchConfig.r,
        s: searchConfig.s,
        sa_iterations: searchConfig.saIterations,
        workers: searchConfig.workers,
        strategy: searchConfig.strategy,
        symmetry: searchConfig.symmetry,
      };
      console.log(`\n🔍 Auto-detected constructive existence proof (∃)`);
      console.log(`   Problem class: ${config.search_config.problem_class}`);
      const symLabel = searchConfig.symmetry === 'circulant' ? ' [CIRCULANT 2^¹⁷]' : '';
      console.log(`   Search config: ${searchConfig.n}v, R(${searchConfig.r},${searchConfig.s}), ${searchConfig.saIterations.toLocaleString()} iters, ${searchConfig.workers} workers (${searchConfig.strategy})${symLabel}`);
    } else {
      console.log(`\n⚠️  Constructive existence detected but problem class unknown — skipping search phase`);
    }
  }

  // ── Search Phase: SA with ARCHITECT Escalation Loop ──
  if (searchPhase) {
    let sp = { ...searchPhase };
    let witnessFound = false;
    let attempt = 0;

    while (!witnessFound && attempt < MAX_ARCHITECT_PIVOTS) {
      attempt++;
      const iters = sp.sa_iterations ?? 10_000_000;

      // ── Z3 Fast Path: try exact SMT solver first for circulant searches ──
      if (sp.symmetry === 'circulant') {
        console.log(`\n⚡ Z3 Fast Path — attempting exact SMT solve (circulant 2^¹⁷ space)...`);
        try {
          const z3Available = await isZ3Available();
          if (z3Available) {
            const z3Result = await solveWithZ3(sp.vertices, sp.r, sp.s, { timeoutMs: 120_000 });

            if (z3Result.status === 'sat') {
              // Witness found — skip SA entirely
              console.log(`   ✅ Z3 found witness in ${z3Result.solveTimeMs}ms!`);
              console.log(`   Distance colors: ${z3Result.distanceBits}`);

              const matrix = adjToMatrix(z3Result.adj);
              const witnessPath = join(workspace.paths.scratch, "witness.json");
              await Bun.write(witnessPath, JSON.stringify({ n: sp.vertices, r: sp.r, s: sp.s, adjacency: matrix }, null, 2));

              const registry = ProofRegistry.withDefaults();
              const proofClass = config.search_config.problem_class === "ramsey_coloring" ? "ramsey" : config.search_config.problem_class;
              const generator = registry.getGenerator(proofClass);
              if (generator) {
                const proofInput = { theoremName: config.theorem_name, witness: z3Result.adj, params: { r: sp.r, s: sp.s, n: sp.vertices } };
                const leanSource = generator.generateLean(proofInput);
                const leanPath = join(workspace.paths.scratch, "Witness.lean");
                await Bun.write(leanPath, leanSource);
                console.log(`\n📄 Lean proof generated: ${leanPath}`);
              }
              witnessFound = true;
              break;

            } else if (z3Result.status === 'unsat') {
              // Provably no circulant witness — record as a permanent LEMMA
              const claim = `No circulant 2-coloring of K_${sp.vertices} witnesses R(${sp.r},${sp.s})`;
              await journal.addEntry({
                type: 'lemma',
                claim,
                evidence: `Z3 UNSAT: 17-var SAT encoding, circulant 2^${Math.floor(sp.vertices/2)} search space exhausted`,
                target_goal: targetGoal,
              });
              console.log(`   📓 Lemma recorded: "${claim}"`);
              console.log(`   Circulant space is empty. Retrying with unconstrained SA.`);
              sp = { ...sp, symmetry: undefined };

            } else if (z3Result.status === 'timeout') {
              console.log(`   ⏱  Z3 timed out — falling back to SA (not UNSAT, space may have witnesses)`);
              sp = { ...sp, symmetry: undefined };

            } else {
              // error
              console.log(`   ⚠️  Z3 error: ${z3Result.message} — falling back to SA`);
              sp = { ...sp, symmetry: undefined };
            }
          } else {
            console.log(`   ⚠️  Z3 not available — falling back to SA`);
          }
        } catch (e) {
          console.log(`   ⚠️  Z3 exception — falling back to SA: ${e}`);
        }
      }

      if (witnessFound) break;

      // ── SA Path: heuristic search (fallback or symmetry=none) ──

      const workers = sp.workers ?? 1;
      const strategy = sp.strategy ?? "single";

      const orchResult = await orchestratedSearch({
        n: sp.vertices,
        r: sp.r,
        s: sp.s,
        saIterations: iters,
        strategy,
        workers,
        seed: sp.seed ?? "random",
        symmetry: sp.symmetry,
        onProgress: (worker: number, iter: number, energy: number, best: number, temp: number) => {
          const pct = ((iter / iters) * 100).toFixed(1);
          const wLabel = (sp.workers ?? 1) > 1 ? `W${worker} ` : "";
          console.log(`   ${wLabel}[${pct}%] iter=${iter.toLocaleString()} E=${energy} best=${best} T=${temp.toFixed(4)}`);
        },
      });

      const result = orchResult.best;
      console.log(`\n   SA complete: best E=${result.bestEnergy}, ${result.ips.toLocaleString()} IPS`);
      if (orchResult.workersRan > 1) {
        console.log(`   Workers: ${orchResult.workersRan} ran, best from worker ${orchResult.bestWorkerIndex}`);
      }

      if (result.witness) {
        // Save witness as JSON
        const matrix = adjToMatrix(result.witness);
        const witnessPath = join(workspace.paths.scratch, "witness.json");
        await Bun.write(witnessPath, JSON.stringify({ n: sp.vertices, r: sp.r, s: sp.s, adjacency: matrix }, null, 2));

        // Generate Lean proof via registry
        const registry = ProofRegistry.withDefaults();
        const proofClass = config.search_config.problem_class === "ramsey_coloring" ? "ramsey" : config.search_config.problem_class;
        const generator = registry.getGenerator(proofClass);
        if (!generator) {
          console.log(`\n❌ No proof generator for problem class: ${proofClass}`);
          break;
        }

        const proofInput = {
          theoremName: config.theorem_name,
          witness: result.witness,
          params: { r: sp.r, s: sp.s, n: sp.vertices },
        };

        const leanSource = generator.generateLean(proofInput);
        const leanPath = join(workspace.paths.verifiedLib, `${config.theorem_name}.lean`);
        await Bun.write(leanPath, leanSource);

        // Verify with Lean
        const proc = Bun.spawn(["lake", "env", "lean", leanPath], {
          cwd: workspaceBase + "/..",
          stdout: "pipe",
          stderr: "pipe",
        });
        const exitCode = await proc.exited;
        const stderr = await new Response(proc.stderr).text();

        if (exitCode === 0) {
          const elapsed = ((Date.now() - startTime) / 1000);

          // Generate LaTeX proof document
          const latexSource = generator.generateLatex({
            ...proofInput,
            problemDescription: config.problem_description,
            wallTimeSeconds: elapsed,
            iterations: result.iterations,
            ips: result.ips,
          });
          const latexPath = join(workspace.paths.verifiedLib, `${config.theorem_name}.tex`);
          await Bun.write(latexPath, latexSource);

          // Compile to PDF via tectonic
          let pdfPath: string | null = null;
          try {
            const tectonic = Bun.spawn(["tectonic", latexPath], {
              cwd: workspace.paths.verifiedLib,
              stdout: "pipe",
              stderr: "pipe",
            });
            const texExit = await tectonic.exited;
            if (texExit === 0) {
              pdfPath = latexPath.replace(".tex", ".pdf");
            }
          } catch { /* tectonic not installed — skip PDF */ }

          // ── Success Blurb ──
          console.log();
          console.log("══════════════════════════════════════════════");
          console.log(`  ✅ PROVED: R(${sp.r},${sp.s}) ≥ ${sp.vertices + 1}`);
          console.log(`  ${sp.vertices}-vertex witness verified by Lean 4 kernel in ${elapsed.toFixed(1)}s`);
          console.log();
          console.log(`  Lean proof:  ${leanPath}`);
          console.log(`  LaTeX proof: ${latexPath}`);
          if (pdfPath) console.log(`  PDF:         ${pdfPath}`);
          console.log("══════════════════════════════════════════════");
          console.log();
          return;
        } else {
          console.log(`\n❌ Lean verification failed: ${stderr.slice(0, 200)}`);
          console.log(`   Falling back to tactic search...\n`);
          break;
        }
      }

      // ── LNS Finisher: attempt Z3 repair on glass floor ──
      if (!result.witness && result.bestAdj) {
        const lnsThreshold = (config.search_config as any).lns_energy_threshold ?? 20;
        if (result.bestEnergy > 0 && result.bestEnergy <= lnsThreshold) {
          const z3Available = await isZ3Available();
          if (z3Available) {
            console.log(`\n🔬 LNS Finisher — E=${result.bestEnergy} within threshold (≤${lnsThreshold}), attempting Z3 repair...`);
            const lnsResult = await runLNS(
              result.bestAdj, sp.vertices, sp.r, sp.s,
              { extraFreePercent: 0.05, timeoutMs: 90_000 }
            );
            if (lnsResult.status === 'sat') {
              console.log(`   ✅ LNS SAT — Z3 repaired ${lnsResult.freeEdgeCount} edges in ${lnsResult.solveTimeMs}ms`);
              // Hand off as witness → normal Lean proof path
              result.witness = lnsResult.adj;
              result.bestEnergy = 0;
            } else if (lnsResult.status === 'unsat') {
              console.log(`   ❌ LNS UNSAT: ${lnsResult.clue}`);
              await journal.addEntry({
                type: 'failure_mode',
                claim: `LNS could not repair E=${result.bestEnergy} basin for R(${sp.r},${sp.s}) on K_${sp.vertices}`,
                evidence: `${lnsResult.clue}; ${lnsResult.freeEdgeCount} free edges tried`,
                target_goal: targetGoal,
              });
              console.log(`   📓 Failure mode recorded in journal.`);
            } else {
              console.log(`   ⚠️  LNS ${lnsResult.status} — continuing to SA pivot`);
            }
          }
        }
      }

      // ── SEARCH FAILED: Build digest and escalate ──

      if (attempt >= MAX_ARCHITECT_PIVOTS) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log();
        console.log("══════════════════════════════════════════════");
        console.log(`  ❌ FAILED: Could not find witness for R(${sp.r},${sp.s}) ≥ ${sp.vertices + 1}`);
        console.log(`  ${MAX_ARCHITECT_PIVOTS} attempts exhausted in ${elapsed}s (best E=${result.bestEnergy})`);
        console.log("══════════════════════════════════════════════");
        console.log();
        return;
      }

      // ── Build digest and record glass floor observation ──
      const glassFloorClaim = `SA on K_${sp.vertices} R(${sp.r},${sp.s}) converged at E_min=${result.bestEnergy} (attempt ${attempt})`;
      await journal.addEntry({
        type: 'observation',
        claim: glassFloorClaim,
        evidence: `${iters.toLocaleString()} iters × ${workers} workers, strategy=${strategy}, seed=${sp.seed ?? 'random'}`,
        target_goal: targetGoal,
      });
      console.log(`   📓 Observation recorded: "${glassFloorClaim}"`);

      const digest = buildSearchFailureDigest(result.telemetry, {
        n: sp.vertices, r: sp.r, s: sp.s, attemptNumber: attempt,
      });
      const digestText = formatSearchDigestForArchitect(digest);

      console.log(`\n   📋 Diagnosis: ${digest.diagnosis.failureMode}`);
      console.log(`   💡 ${digest.diagnosis.recommendation.slice(0, 120)}...`);
      // Augment digest with journal context so ARCHITECT sees what's been proven
      const journalContext = distillJournalForPrompt(await journal.getEntriesForGoal(targetGoal));
      const augmentedDigest = journalContext ? journalContext + "\n" + digestText : digestText;

      console.log(`\n   🏛️  Asking ARCHITECT for search pivot...\n`);

      const pivotedConfig = await callSafe(
        (previousError) => requestSearchPivot(apiKey, augmentedDigest, sp, previousError),
        3,
        "ARCHITECT pivot",
      );

      if (pivotedConfig) {
        sp = pivotedConfig;
        console.log(`   ✅ ARCHITECT pivoted:`);
        console.log(`      Vertices: ${sp.vertices}, R(${sp.r},${sp.s}), ${(sp.sa_iterations ?? 10_000_000).toLocaleString()} iters`);
      } else {
        console.log(`   ❌ ARCHITECT could not produce a pivot after 3 attempts. Aborting search.`);
        break;
      }
    }

    witnessFound = false; // If we get here, search loop ended without success
  }

  // ── Tactic Phase: LLM-driven proof search (for non-constructive proofs) ──
  const factory = new AgentFactory({ geminiApiKey: apiKey });
  const solver = new SolverBridge();
  const lean = new LeanBridge();

  const result = await runDynamicLoop(workspace, solver, {
    maxGlobalIterations: config.max_iterations,
    maxLocalRetries: 3,
    leanBridge: lean,
    theoremName: config.theorem_name,
    theoremSignature: config.theorem_signature,
    agentFactory: factory,
    batchSize: 3,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n══════════════════════════════════════════════");
  if (result.status === "SOLVED") {
    console.log(`  🏆 SUCCESS: ${config.theorem_name} proved in ${elapsed}s`);
    const proofPath = join(workspace.paths.verifiedLib, `${config.theorem_name}.lean`);
    const proofFile = Bun.file(proofPath);
    if (await proofFile.exists()) {
      console.log(`\n📜 Verified proof:\n${await proofFile.text()}`);
    }
  } else {
    console.log(`  ❌ BUDGET EXHAUSTED after ${elapsed}s (${config.max_iterations} iters)`);
    console.log(`  Lab log: ${workspace.paths.labLog}`);
  }

  if (result.tree) {
    console.log(TreePrinter.print(result.tree));
  }
  console.log("══════════════════════════════════════════════\n");
}

// ──────────────────────────────────────────────
// Main — Single Flow
// ──────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY not set. Export it or add to .env");
    process.exit(1);
  }

  let config: RunConfig;
  let configPath: string;
  const workspaceBase = join(import.meta.dir, "../../agent_workspace");

  if (args.configPath) {
    // Resume from existing config
    const configFile = Bun.file(args.configPath);
    if (!(await configFile.exists())) {
      console.error(`❌ Config not found: ${args.configPath}`);
      process.exit(1);
    }
    config = await configFile.json();
    configPath = args.configPath;
  } else {
    // Phase 1: Formulate
    console.log("═══════════════════════════════════════════════");
    console.log("  🧠 PERQED — Problem Formulation");
    console.log("═══════════════════════════════════════════════");
    console.log(`  Prompt: "${args.prompt}"`);
    console.log("═══════════════════════════════════════════════\n");

    config = await formulate(args.prompt!, apiKey);
    configPath = join(workspaceBase, "runs", config.run_name, "run_config.json");

    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(workspaceBase, "runs", config.run_name), { recursive: true });
    await Bun.write(configPath, JSON.stringify(config, null, 2));
  }

  // Phase 2: Confirm
  displayConfig(config, configPath);

  if (!args.noconfirm) {
    await confirmOrAbort();
  } else {
    console.log("  (--noconfirm: skipping confirmation)\n");
  }

  // Phase 3: Run
  await executeRun(config, apiKey);
}

main().catch((err) => {
  console.error("💥 Perqed failed:", err);
  process.exit(1);
});
