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
import { JsonHandler } from "../utils/json_handler";
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
import { WILES_OPF_PROMPT } from "../architect_client";
import { solveWithZ3, isZ3Available } from "../search/z3_ramsey_solver";
import { adjToMatrix } from "../search/ramsey_worker";
import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import { runLNS } from "../search/lns_solver";
import {
  ResearchJournal,
  distillJournalForPrompt,
  defaultJournalPath,
} from "../search/research_journal";
import { GistPublisher } from "../gist_publisher";
import { repairJSON } from "../util/json_repair";
import { ArxivLibrarian } from "../librarian/arxiv_librarian";
import { DOMAIN_SEED_QUERIES } from "../librarian/seed_queries";
import { VectorDatabase, TABLE_ARXIV, TABLE_MATHLIB } from "../embeddings/vector_store";
import { LocalEmbedder } from "../embeddings/embedder";
import { DAGExecutor } from "../proof_dag/dag_executor";
import { ArchitectClient } from "../architect_client";
import { readdir } from "node:fs/promises";
import { ZobristHasher } from "../search/zobrist_hash";
import { AlgebraicBuilder } from "../search/algebraic_builder";
import { SmtWilesBuilder } from "../search/smt_wiles_builder";
import { SmtWilesConfigSchema } from "../proof_dag/smt_wiles_config";
import { AlgebraicConstructionConfigSchema } from "../proof_dag/algebraic_construction_config";


// ──────────────────────────────────────────────
// CLI Argument Parsing
// ──────────────────────────────────────────────

interface CliArgs {
  prompt?: string;
  configPath?: string;
  noconfirm: boolean;
  /** Force ARCHITECT into Wiles Mode (Conceptual Scatter) from iteration 0. */
  wiles: boolean;
  /** Override the maximum number of architect replanning pivots (default 5). */
  maxPivots: number;
}

export function parseArgs(argv: string[] = process.argv.slice(2)): CliArgs {
  const args = argv;
  const promptArg = args.find((a) => a.startsWith("--prompt="));
  const configArg = args.find((a) => a.startsWith("--config="));
  const maxPivotsArg = args.find((a) => a.startsWith("--max-pivots="));
  const noconfirm = args.includes("--noconfirm");
  const wiles = args.includes("--wiles");

  const maxPivots = maxPivotsArg ? parseInt(maxPivotsArg.replace("--max-pivots=", ""), 10) : 5;

  if (!promptArg && !configArg) {
    console.error("Usage:");
    console.error("  perqed --prompt=\"<problem description>\"");
    console.error("  perqed --config=<path/to/run_config.json>");
    console.error("  perqed --prompt=\"...\" --noconfirm");
    console.error("  perqed --prompt=\"...\" --wiles   # Force Wiles Mode (Conceptual Scatter)");
    console.error("  perqed --prompt=\"...\" --max-pivots=1000");
    process.exit(1);
  }

  return {
    prompt: promptArg?.replace("--prompt=", ""),
    configPath: configArg?.replace("--config=", ""),
    noconfirm,
    wiles,
    maxPivots,
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
  /** High-level boundary constraints to rigidly evaluate generative solutions against */
  constraints?: {
    exact_vertices?: number;
    undirected?: boolean;
    no_self_loops?: boolean;
  };
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
    constraints: {
      type: SchemaType.OBJECT as const,
      description: "Rigid boundary constraints that any generative solution must perfectly satisfy before evaluation.",
      properties: {
        exact_vertices: { type: SchemaType.NUMBER as const, description: "The exact number of vertices the graph must have (e.g., 35 for R(4,6) >= 36)" },
        undirected: { type: SchemaType.BOOLEAN as const, description: "True if the graph must be strictly undirected/symmetric" },
        no_self_loops: { type: SchemaType.BOOLEAN as const, description: "True if all self-loops must be false" },
      },
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

/**
 * Returns the ARCHITECT system preamble for the initial formulation call.
 * When wilesMode=true the Orthogonal Paradigm Forcing prompt is prepended,
 * forcing the ARCHITECT to bypass standard techniques from Iteration 0.
 *
 * Exported so it can be unit-tested independently of the network call.
 *
 * Pure gate function: should the SA witness-search phase run?
 *
 * Returns false when:
 *   - wilesMode is active (Orthogonal Paradigm Forcing — SA is bypassed, the
 *     ARCHITECT's algebraic DAG strategy drives the proof loop instead)
 *   - problem_class is "unknown" or undefined (no structured search available)
 *
 * Exported for unit testing.
 */
export function shouldRunSearchPhase(
  searchConfig: { problem_class?: string } | null | undefined,
  wilesMode: boolean,
): boolean {
  const pc = searchConfig?.problem_class;
  return pc !== undefined && pc !== "unknown";
}


export function buildFormulationPreamble(wilesMode: boolean): string {
  if (wilesMode) {
    return (
      `${WILES_OPF_PROMPT}\n\n---\n\n` +
      FORMULATION_PREAMBLE_BASE
    );
  }
  return FORMULATION_PREAMBLE_BASE;
}

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

async function formulate(prompt: string, apiKey: string, wilesMode: boolean = false): Promise<RunConfig> {
  console.log("🏛️  Asking ARCHITECT to formulate the problem...\n");
  if (wilesMode) {
    console.log("   🧮 [Formulator] WILES MODE — Orthogonal Paradigm Forcing from iteration 0\n");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction:
      "You are the Perqed Problem Formulator. Output a structured JSON run configuration for the Perqed proof engine.",
    generationConfig: {
      temperature: wilesMode ? 0.95 : 0.3,
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
    let p = buildFormulationPreamble(wilesMode) + "## The User's Problem Description\n\n" + prompt + libraryContext;

    if (previousError) {
      p += `\n\n## ⚠️ Previous Response Error\nYour last response caused this error:\n\`\`\`\n${previousError}\n\`\`\`\nPlease respond with a valid JSON object only. No markdown.`;
    }
    const result = await model.generateContent(p);
    let text = result.response.text().trim();

    try {
      const fs = await import("fs");
      fs.appendFileSync("/tmp/perqed_llm_debug.jsonl", JSON.stringify({ timestamp: new Date().toISOString(), model: "gemini-2.5-flash", step: "doFormulate", rawText: text }) + "\n");
    } catch (e) { }

    const jsonString = JsonHandler.extractAndRepair(text);
    return JSON.parse(jsonString) as RunConfig;
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
 * Build a dynamically-pruned pivot schema by stripping symmetry options
 * that the ResearchJournal has already proven empty.
 * e.g. if journal has [LEMMA] "No circulant..." → remove 'circulant' from enum.
 */
function buildPrunedPivotSchema(journalEntries: Array<{ type: string; claim: string }>): typeof SEARCH_PIVOT_SCHEMA {
  const circulantInvalidated = journalEntries.some(
    e => e.type === 'lemma' && e.claim.toLowerCase().includes('circulant')
  );

  const allowedSymmetries = ['none', circulantInvalidated ? null : 'circulant'].filter(Boolean) as string[];
  const allowedSeeds = ['random', 'paley', circulantInvalidated ? null : 'circulant'].filter(Boolean) as string[];

  return {
    ...SEARCH_PIVOT_SCHEMA,
    properties: {
      ...SEARCH_PIVOT_SCHEMA.properties,
      symmetry: { type: SchemaType.STRING as const, enum: allowedSymmetries },
      seed: { type: SchemaType.STRING as const, enum: allowedSeeds },
    },
  };
}

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
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let lastError: string | undefined;
  const BASE_DELAY_MS = 1000;
  const MAX_DELAY_MS = 30_000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let spinnerTimer: ReturnType<typeof setInterval> | null = null;
    let i = 0;
    process.stdout.write(`   ${frames[0]} [LLM] Awaiting ${label}...\r`);
    spinnerTimer = setInterval(() => {
      i = (i + 1) % frames.length;
      process.stdout.write(`   ${frames[i]} [LLM] Awaiting ${label}...\r`);
    }, 80);

    try {
      const result = await fn(lastError);
      clearInterval(spinnerTimer);
      process.stdout.write(`   ✅ [LLM] ${label} completed.                 \n`);
      return result;
    } catch (err) {
      clearInterval(spinnerTimer);
      process.stdout.write(`   ❌ [LLM] ${label} failed.                    \n`);
      lastError = String(err);
      console.log(`   ⚠️  ${label} error details: ${lastError.slice(0, 100)}`);
      if (attempt < maxRetries) {
        // Exponential backoff with ±25% jitter
        const base = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_DELAY_MS);
        const jitter = base * 0.25 * (Math.random() * 2 - 1);
        const delay = Math.round(base + jitter);
        console.log(`   🔄 Retrying with error context in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  return null;
}

async function requestSearchPivot(
  apiKey: string,
  digestText: string,
  currentConfig: SearchPhase,
  prunedSchema: typeof SEARCH_PIVOT_SCHEMA,
  previousError?: string,
  tabuHashes?: string[],
): Promise<SearchPhase> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction:
      "You are the Perqed Search Orchestrator. Output an updated search_phase JSON object only. No markdown, no code blocks.",
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: prunedSchema as any,
      maxOutputTokens: 2000,
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
  const parsed = repairJSON(text);
  if (!parsed) throw new Error(`Search pivot JSON unparseable: ${text.slice(0, 100)}`);

  const phase = parsed as SearchPhase;

  // ── Tabu hash injection ────────────────────────────────────────────────────
  // Merge journal-extracted glass-floor hashes into the returned SearchPhase.
  // This ensures SA workers spawned from a flat pivot always carry the full
  // cumulative set of Z3-certified sterile basin hashes, preventing re-entry.
  if (tabuHashes && tabuHashes.length > 0) {
    const existing = (phase as any).tabuHashes ?? [];
    const merged = [...new Set([...existing, ...tabuHashes])];
    (phase as any).tabuHashes = merged;
    console.log(`   🚫 Injecting ${merged.length} tabu hash(es) into pivot config`);
  }

  return phase;
}

// ──────────────────────────────────────────────
// Phase 3: Run
// ──────────────────────────────────────────────

async function executeRun(config: RunConfig, apiKey: string, wilesMode: boolean = false, maxPivots: number = 5): Promise<void> {
  const workspaceBase = join(process.cwd(), "agent_workspace");
  const workspace = new WorkspaceManager(workspaceBase, config.run_name);
  await workspace.init();

  // Write objective + domain skills
  await Bun.write(workspace.paths.objective, config.objective_md);
  const skillsPath = join(workspace.paths.domainSkills, "problem_context.md");
  await Bun.write(skillsPath, config.domain_skills_md);

  // Memetic warm-start: carry best graph across all pivot attempts.
  // Persisted to disk so it survives kills, reboots, and cross-machine moves.
  const seedPath = join(workspace.paths.runDir, "best_seed.json");
  let memeticSeed: AdjacencyMatrix | null = null;
  let memeticSeedEnergy: number | null = null;

  // Attempt to reload a prior seed from disk
  try {
    const seedFile = Bun.file(seedPath);
    if (await seedFile.exists()) {
      const saved = await seedFile.json() as { energy: number; edges: [number, number][] };
      const loaded = new AdjacencyMatrix(saved.edges.reduce((n, [u, v]) => Math.max(n, u, v), 0) + 1);
      for (const [u, v] of saved.edges) loaded.addEdge(u, v);
      memeticSeed = loaded;
      memeticSeedEnergy = saved.energy;
      console.log(`   🧬 Memetic seed loaded from disk: E=${saved.energy} (${saved.edges.length} edges)`);
    }
  } catch {
    // No seed or corrupt file — start fresh
  }

  console.log("═══════════════════════════════════════════════");
  console.log("  🔥 PERQED — Execution");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Workspace: ${workspace.paths.runDir}`);
  console.log("═══════════════════════════════════════════════\n");

  // ── Background Library Seeding (non-blocking) ─────────────────────────
  // If the vector store has fewer than 10 papers, kick off a background seed
  // so the ARCHITECT has domain context on the next attempt.
  const DB_PATH = join(workspaceBase, "..", "data", "perqed.lancedb");
  void (async () => {
    try {
      const librarian = new ArxivLibrarian({
        queries: DOMAIN_SEED_QUERIES,
        maxPerQuery: 15,
        dbPath: DB_PATH,
      });
      const count = await librarian.count();
      if (count < 10) {
        console.log("📚 [Librarian] DB sparse — seeding domain papers in background...");
        const { ingested } = await librarian.run();
        if (ingested > 0) {
          console.log(`📚 [Librarian] Background seeding complete: ${ingested} papers ingested`);
        }
      }
    } catch (e: any) {
      // Non-critical — seeding failure must never block the search
      console.warn(`📚 [Librarian] Background seeding skipped: ${e.message}`);
    }
  })();

  const startTime = Date.now();
  const MAX_ARCHITECT_PIVOTS = maxPivots;

  // ── Live telemetry (non-blocking — fire-and-forget on all publishes) ──
  const gist = GistPublisher.fromEnv();
  let lastPublishMs = 0; // throttle: max 1 publish per 30s during SA
  const publish = (state: Parameters<GistPublisher['publishState']>[0]) => {
    const now = Date.now();
    if (now - lastPublishMs < 30_000) return; // 30s cooldown
    lastPublishMs = now;
    gist?.publishState(state); // intentionally un-awaited
  };
  const addEvent = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    gist?.addEvent(msg, type);
  };

  // ── Research Journal: persistent cross-run memory ──
  const journalPath = defaultJournalPath(join(workspace.paths.runDir, "..", ".."));
  const journal = new ResearchJournal(journalPath);
  const targetGoal = `R(${(config.search_config as any)?.r ?? "?"},${(config.search_config as any)?.s ?? "?"}) >= ${((config.search_config as any)?.domain_size ?? 0) + 1}`;

  let searchPhase: SearchPhase | null = null;
  let witnessFound = false;

  // ── Wiles Mode Intercept: Evaluate DAG upfront ──
  if (wilesMode) {
    console.log(`\n🧮 [Wiles] SA bypass active — intercepting for Algebraic Builder DAG`);

    let wilesAttempts = 0;
    while (wilesAttempts < MAX_ARCHITECT_PIVOTS && !witnessFound) {
      wilesAttempts++;
      let dagAttempted = false;
      try {
        const architectClient = new ArchitectClient({
          apiKey,
          model: "gemini-2.5-flash",
        });

        const journalSummaryText = await journal.getSummary(targetGoal);

        console.log(`\n   🏛️  Asking ARCHITECT to formulate Algebraic Rule directly...`);
        const { AlgebraicConstructionConfigSchema } = await import("../proof_dag/algebraic_construction_config");
        
        let builderConfig: any;
        builderConfig = await callSafe(
          () => architectClient.formulateAlgebraicRule(targetGoal, journalSummaryText),
          1,
          "ARCHITECT formulateAlgebraicRule (Wiles)"
        );

        if (!builderConfig) throw new Error("formulateAlgebraicRule failed to return a valid config.");

        builderConfig = AlgebraicConstructionConfigSchema.parse(builderConfig);
        console.log(`   🗺️  ARCHITECT emitted Algebraic Rule for ${builderConfig.vertices} vertices.`);

        const currentDag: any = {
          id: `wiles_run_${wilesAttempts}`,
          goal: targetGoal,
          nodes: [{
            id: "init_alg",
            kind: "algebraic_graph_construction",
            dependsOn: [],
            config: builderConfig
          }]
        };

        const { DAGExecutor } = await import("../proof_dag/dag_executor");
        const { AlgebraicBuilder } = await import("../search/algebraic_builder");
        const { calculate_degrees_of_freedom, query_known_graphs } = await import("../skills/investigation_skills");

        let replanAttempts = 0;
        while (replanAttempts < 3 && !witnessFound) {
          replanAttempts++;
          console.log(`\n   🏗️  [DAGExecutor] Executing Wiles DAG (Attempt ${replanAttempts})...`);
          
          const safeJournal = {
            record: (obs: string) => {
              journal.addEntry({
                type: "observation",
                claim: obs,
                target_goal: targetGoal,
                evidence: "Algebraic Builder run",
              }).catch(console.error);
            }
          };

          const executor = new DAGExecutor(currentDag, {
            calculate_degrees_of_freedom: async (node) => {
              const cfg = node.config as any;
              const result = calculate_degrees_of_freedom(cfg.edge_rule_js, cfg.vertices);
              await journal.recordInvestigation("calculate_degrees_of_freedom", `Graph(V=${cfg.vertices}) Rule: ${cfg.edge_rule_js}`, result);
              console.log(`   🔍 [Investigation] calculate_degrees_of_freedom: ${result}`);
              return { note: result };
            },
            query_known_graphs: async (node) => {
              const cfg = node.config as any;
              const result = query_known_graphs(cfg.r, cfg.s);
              await journal.recordInvestigation("query_known_graphs", `R(${cfg.r}, ${cfg.s})`, result);
              console.log(`   🔍 [Investigation] query_known_graphs: ${result}`);
              return { note: result };
            },
            query_literature: async (node) => {
              const cfg = node.config as any;
              const { query_literature } = await import("../skills/investigation_skills");
              const result = await query_literature(cfg.search_term);
              await journal.recordInvestigation("query_literature", cfg.search_term, result);
              console.log(`   📚 [Investigation] query_literature complete for "${cfg.search_term}"`);
              return { note: result };
            },
            algebraic_graph_construction: async (node) => {
              console.log(`   ⚙️  Compiling Edge Rule for node ${node.id}...`);
              const algConfig = node.config as any;
              const algR = algConfig.r ?? (config.search_config as any)?.r ?? 4;
              const algS = algConfig.s ?? (config.search_config as any)?.s ?? 6;
              let buildResult;
              try {
                buildResult = await AlgebraicBuilder.buildAndVerify(algConfig, algR, algS, safeJournal, workspace as any, config.constraints);
              } catch (e: any) {
                if (e.name === "InvariantViolationError") {
                  console.log(`\n   🛑 [Boundary Violation] LLM attempted to violate constraints: ${e.message}`);
                  await journal.addEntry({
                    type: "failure_mode",
                    claim: `Boundary Violation: rule generated graph with ${e.message}`,
                    target_goal: targetGoal,
                    evidence: "InvariantValidator",
                  });
                  return { energy: NaN, status: "violations", note: e.message };
                }
                throw e;
              }

              if (buildResult.energy === 0) {
                console.log(`   ✅ Algebraic Construction SAT! Witness found. Bypassing MCTS Loop.`);
                witnessFound = true;

                const N = buildResult.adj.n;
                const matrix: number[][] = [];
                for (let i = 0; i < N; i++) {
                  const row: number[] = [];
                  for (let j = 0; j < N; j++) {
                    row.push(buildResult.adj.hasEdge(i, j) ? 1 : 0);
                  }
                  matrix.push(row);
                }
                const witnessPath = join(workspace.paths.scratch, "witness.json");
                await Bun.write(witnessPath, JSON.stringify({ n: N, r: algR, s: algS, adjacency: matrix }, null, 2));

                const registry = ProofRegistry.withDefaults();
                const proofClass = config.search_config.problem_class === "ramsey_coloring" ? "ramsey" : config.search_config.problem_class;
                const generator = registry.getGenerator(proofClass);
                if (generator) {
                  const proofInput = { theoremName: config.theorem_name, witness: buildResult.adj, params: { r: algR, s: algS, n: N } };
                  const leanSource = generator.generateLean(proofInput);
                  const leanPath = join(workspace.paths.scratch, "Witness.lean");
                  await Bun.write(leanPath, leanSource);
                  console.log(`\n📄 Lean proof generated: ${leanPath}`);
                }
              } else {
                console.log(`   ❌ Algebraic Construction ${node.id} failed (E=${buildResult.energy}). Journaling for replan...`);
              }
              return buildResult;
            }
          });

          await executor.execute();

          if (witnessFound) break;

          console.log(`   📝 DAG cycle finished without witness. Invoking Replanner...`);
          const currentJournalsText = await journal.getSummary(targetGoal);
          const cognitiveMode = await journal.getCognitiveTemperature(targetGoal);
          let appendedDag: any;
          appendedDag = await callSafe(
            () => architectClient.replanDAG(currentDag, currentJournalsText, cognitiveMode),
            1,
            "ARCHITECT replanDAG"
          );

          if (appendedDag && appendedDag.nodes) {
            console.log(`   🗺️  ARCHITECT injected ${appendedDag.nodes.length} new node(s).`);
            for (const n of appendedDag.nodes) {
              n.status = "pending";
              if (!n.dependsOn) n.dependsOn = [];
              currentDag.nodes.push(n);
            }
          }
        }
      } catch (e: any) {
        console.error(`   ❌ Failed to execute Algebraic Builder: ${e.message}`);
      }
    } // end while(wilesAttempts < MAX)
  }

  const needsSearch = !wilesMode && !witnessFound && shouldRunSearchPhase(config.search_config, false);

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
                evidence: `Z3 UNSAT: 17-var SAT encoding, circulant 2^${Math.floor(sp.vertices / 2)} search space exhausted`,
                target_goal: targetGoal,
              });
              console.log(`   📓 Lemma recorded: "${claim}"`);
              addEvent(`Z3 UNSAT: no circulant R(${sp.r},${sp.s}) witness on K_${sp.vertices}`, 'info');
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

      // Clamp workers to PHYSICAL cores, not logical threads.
      // os.cpus().length returns logical threads (SMT). Two SA workers on one
      // physical core thrash each other's L1/L2 cache, killing IPS.
      const cpuCount = require("os").cpus().length;
      const physicalCores = Math.max(1, Math.floor(cpuCount / 2));
      const workers = Math.min(Math.max(1, sp.workers ?? 8), physicalCores);
      const strategy = sp.strategy ?? "island_model";


      // ── Tabu hash injection (ALL attempts, including Attempt 1) ───────────
      // Extract cumulative glass-floor hashes from the journal and inject
      // into the OrchestratedSearchConfig so workers hard-reject re-entry
      // into Z3-certified sterile basins from the very first iteration.
      // (Pivot hashes are also injected in requestSearchPivot — this is the
      // belt that covers Attempt 1 which bypasses the pivot path.)
      const bootTabuHashes = await journal.getAllEntries().then(entries =>
        [...new Set(entries
          .filter(e => e.type === "failure_mode" && e.zobristHash)
          .map(e => e.zobristHash!))]
      );
      if (bootTabuHashes.length > 0) {
        console.log(`   🚫 [W*] Booting with ${bootTabuHashes.length} tabu hash(es) from journal`);
      }

      const saTabuHashes: string[] = [
        ...new Set([
          ...bootTabuHashes,
          ...((sp as any).tabuHashes ?? []),
        ])
      ];

      const orchResult = await orchestratedSearch({
        n: sp.vertices,
        r: sp.r,
        s: sp.s,
        saIterations: iters,
        strategy,
        workers,
        seed: sp.seed ?? "random",
        symmetry: sp.symmetry,
        // Memetic warm-start: seed first worker with best graph from prior attempt
        initialGraph: memeticSeed ?? undefined,
        // Tabu hashes: prevents all workers from re-entering Z3-certified sterile basins
        tabuHashes: saTabuHashes.length > 0 ? saTabuHashes : undefined,
        // Micro-SAT Patch: always-on Z3 surgery for sterile basins at E ≤ 13.
        // Previously gated on micro_sat.enabled in the ARCHITECT's search config,
        // but since MicroSAT only fires at the glass floor it is always safe.
        // ARCHITECT can still override via micro_sat.threshold if it wants a
        // tighter or looser threshold.
        microSatThreshold: (sp as any).micro_sat?.threshold ?? 13,


        onProgress: (worker: number, iter: number, energy: number, best: number, temp: number) => {
          // Scale report interval: single-worker runs at 10M intervals same as multi-worker
          const reportEvery = Math.max(10_000_000, Math.floor(iters / 50));
          if (iter % reportEvery !== 0) return;
          const pct = ((iter / iters) * 100).toFixed(1);
          const wLabel = (sp.workers ?? 1) > 1 ? `W${worker} ` : "";
          console.log(`   ${wLabel}[${pct}%] iter=${iter.toLocaleString()} E=${energy} best=${best} T=${temp.toFixed(4)}`);
          // Throttled publish — at most once per 30s
          const now = Date.now();
          if (gist && now - lastPublishMs > 30_000) {
            lastPublishMs = now;
            publish({
              theorem: config.theorem_name,
              iteration: iter,
              status: 'proving',
              tacticState: `Best E=${best} (W${worker}) · ${pct}% through budget`,
              thinking: `SA searching K_${sp.vertices} for R(${sp.r},${sp.s}) witness (attempt ${attempt})`,
              tactics: [],
            });
          }
        },
      });

      const result = orchResult.best;

      // Track global best graph across all pivot attempts for memetic warm-start
      if (!memeticSeed || result.bestEnergy < (memeticSeedEnergy ?? Infinity)) {
        memeticSeed = result.bestAdj;
        memeticSeedEnergy = result.bestEnergy;
        // Persist to disk: survives kills, reboots, cross-machine moves
        const n = result.bestAdj.n;
        const edges: [number, number][] = [];
        for (let u = 0; u < n; u++)
          for (let v = u + 1; v < n; v++)
            if (result.bestAdj.hasEdge(u, v)) edges.push([u, v]);
        await Bun.write(seedPath, JSON.stringify({ energy: memeticSeedEnergy, n, edges }));
        console.log(`   🧬 Memetic seed updated: E=${memeticSeedEnergy} → saved to disk (${edges.length} edges)`);
      }
      console.log(`\n   SA complete: best E=${result.bestEnergy}, ${result.ips.toLocaleString()} IPS`);
      if (orchResult.workersRan > 1) {
        console.log(`   Workers: ${orchResult.workersRan} ran, best from worker ${orchResult.bestWorkerIndex}`);
      }
      addEvent(`SA complete: best E=${result.bestEnergy} after ${result.iterations.toLocaleString()} iters`);

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
          addEvent(`✅ PROVED: R(${sp.r},${sp.s}) ≥ ${sp.vertices + 1} — Lean verified in ${elapsed.toFixed(1)}s`, 'success');
          publish({
            theorem: config.theorem_name,
            iteration: result.iterations,
            status: 'solved',
            tacticState: `R(${sp.r},${sp.s}) ≥ ${sp.vertices + 1} — Lean 4 kernel verified`,
            thinking: `Proof complete in ${elapsed.toFixed(1)}s`,
            tactics: [],
          });
          return;
        } else {
          console.log(`\n❌ Lean verification failed: ${stderr.slice(0, 200)}`);
          console.log(`   Falling back to tactic search...\n`);
          addEvent(`Lean verification failed — falling back`, 'error');
          break;
        }
      }

      // ── LNS Finisher: attempt Z3 repair on glass floor ──
      // Try top-J candidates within K energy of the global best.
      // Workers explore different basins — a structurally diverse pool
      // may succeed on E=14 where E=13 is irrecoverably entangled.
      if (!result.witness) {
        const lnsThreshold = (config.search_config as any).lns_energy_threshold ?? 20;
        const lnsJ = (config.search_config as any).lns_candidate_j ?? 3;
        const lnsK = (config.search_config as any).lns_candidate_k ?? 4;

        if (result.bestEnergy > 0 && result.bestEnergy <= lnsThreshold) {
          const z3Available = await isZ3Available();
          if (z3Available) {
            // Build candidate pool: all worker results within K energy of best, sorted asc
            const globalBest = result.bestEnergy;
            const candidates = orchResult.allResults
              .filter(r => r.bestEnergy > 0 && r.bestEnergy <= globalBest + lnsK)
              .sort((a, b) => a.bestEnergy - b.bestEnergy)
              .slice(0, lnsJ);

            console.log(`\n🔬 LNS Finisher — global best E=${globalBest}, trying ${candidates.length} candidate(s) (J=${lnsJ}, K=${lnsK}):`);
            candidates.forEach((c, i) => console.log(`   #${i + 1}: E=${c.bestEnergy}`));

            let lnsSat = false;
            for (let ci = 0; ci < candidates.length; ci++) {
              const candidate = candidates[ci]!;
              console.log(`\n   🔬 Candidate #${ci + 1} (E=${candidate.bestEnergy}):`);
              addEvent(`LNS candidate #${ci + 1}: E=${candidate.bestEnergy}`, 'info');

              const lnsResult = await runLNS(
                candidate.bestAdj, sp.vertices, sp.r, sp.s,
                { extraFreePercent: 0.05, timeoutMs: 90_000 }
              );

              if (lnsResult.status === 'sat') {
                console.log(`   ✅ LNS SAT on candidate #${ci + 1} — Z3 repaired ${lnsResult.freeEdgeCount} edges in ${lnsResult.solveTimeMs}ms`);
                addEvent(`LNS SAT (#${ci + 1}): Z3 repaired ${lnsResult.freeEdgeCount} edges in ${lnsResult.solveTimeMs}ms`, 'success');
                result.witness = lnsResult.adj;
                result.bestEnergy = 0;
                lnsSat = true;
                break;
              } else if (lnsResult.status === 'unsat') {
                console.log(`   ❌ LNS UNSAT (#${ci + 1}): ${lnsResult.clue}`);
                addEvent(`LNS UNSAT (#${ci + 1}): E=${candidate.bestEnergy} basin irrecoverable`, 'error');
                // ── Capture Zobrist hash of this glass floor ─────────────────
                // Compute at the moment of failure so the ARCHITECT can inject
                // this exact hash into tabuHashes on the next SA run.
                let failedHash: string | undefined;
                try {
                  const glassHasher = new ZobristHasher(sp.vertices);
                  failedHash = glassHasher.computeInitial(candidate.bestAdj).toString();
                  console.log(`   🔑 Glass floor hash: ${failedHash}`);
                } catch { /* non-fatal — journal entry still written without hash */ }
                // ─────────────────────────────────────────────────────────────
                await journal.addEntry({
                  type: 'failure_mode',
                  claim: `LNS could not repair E=${candidate.bestEnergy} basin for R(${sp.r},${sp.s}) on K_${sp.vertices}`,
                  evidence: `${lnsResult.clue}; ${lnsResult.freeEdgeCount} free edges tried`,
                  target_goal: targetGoal,
                  ...(failedHash !== undefined ? { zobristHash: failedHash } : {}),
                });
              } else {
                console.log(`   ⚠️  LNS ${lnsResult.status} (#${ci + 1}) — skipping to next candidate`);
              }
            }

            if (!lnsSat) {
              console.log(`\n   📓 All ${candidates.length} LNS candidates exhausted — failure modes recorded.`);
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
      const journalEntries = await journal.getEntriesForGoal(targetGoal);
      const journalContext = distillJournalForPrompt(journalEntries);
      const augmentedDigest = journalContext ? journalContext + "\n" + digestText : digestText;

      // Prune schema: strip symmetry/seed options that journal has proven impossible
      const prunedSchema = buildPrunedPivotSchema(journalEntries);

      console.log(`\n   🏛️  Asking ARCHITECT for search pivot...\n`);

      const architectClient = new ArchitectClient({
        apiKey,
        model: "gemini-2.5-flash",
      });

      // ── ALL attempts: ask ARCHITECT to emit a ProofDAG ──
      // requestSearchPivot is used ONLY as a catch fallback when formulateDAG
      // throws an unrecoverable JSON/Zod error after 3 retries, NOT based on
      // attempt number. The ARCHITECT is in control from Attempt 1.
      let dagAttempted = false;
      {
        try {
          // Discover available SKILLs
          let availableSkills: string[] = [];
          try {
            const skillsRoot = join(workspaceBase, "..", ".agents", "skills");
            const entries = await readdir(skillsRoot, { withFileTypes: true });
            availableSkills = entries
              .filter((e) => e.isDirectory())
              .map((e) => e.name);
          } catch { /* skills dir may not exist yet */ }

          const allJournalEntries = await journal.getEntriesForGoal(targetGoal);
          const dag = await architectClient.formulateDAG(
            augmentedDigest,
            targetGoal,
            availableSkills,
            allJournalEntries,
            journal,
            wilesMode,    // --wiles: force Wiles Mode (Conceptual Scatter) from iteration 0
          );


          console.log(`   🗺️  ARCHITECT emitted ProofDAG (${dag.nodes.length} nodes):`);
          dag.nodes.forEach((n) =>
            console.log(`      [${n.kind}] ${n.id}: ${n.label}`)
          );

          // ── Wire DAGExecutor node handlers ──────────────────────────────
          const arxivDb = new VectorDatabase(DB_PATH, TABLE_ARXIV);
          await arxivDb.initialize();
          const mathlibDb = new VectorDatabase(DB_PATH, TABLE_MATHLIB);
          await mathlibDb.initialize();
          const embedder = new LocalEmbedder();
          const ollamaLive = await embedder.isAvailable();

          const executor = new DAGExecutor(dag, {
            // ── literature: vector-search arxiv_papers ────────────────────
            literature: async (node) => {
              const cfg = node.config as { query?: string; k?: number };
              const query = cfg.query ?? targetGoal;
              const k = cfg.k ?? 5;
              if (!ollamaLive) {
                return `[Literature context for "${query}" — Ollama unavailable, skipping vector search]`;
              }
              const queryVec = await embedder.embed(query);
              if (queryVec.length === 0) {
                return `[Literature context for "${query}" — embedding failed]`;
              }
              const hits = await arxivDb.search(queryVec, k);
              if (hits.length === 0) return `[No literature found for "${query}"]`;
              return (
                `Found literature for "${query}":\n` +
                hits.map((h) => `  - ${h.theoremSignature}\n    ${h.successfulTactic}`).join("\n")
              );
            },

            // ── mathlib_query: vector-search mathlib_premises ─────────────
            mathlib_query: async (node) => {
              const cfg = node.config as { query?: string; k?: number };
              const query = cfg.query ?? targetGoal;
              const k = cfg.k ?? 5;
              if (!ollamaLive) {
                return `[Mathlib context for "${query}" — Ollama unavailable, skipping vector search]`;
              }
              const queryVec = await embedder.embed(query);
              if (queryVec.length === 0) {
                return `[Mathlib context for "${query}" — embedding failed]`;
              }
              const hits = await mathlibDb.searchMathlib(queryVec, k);
              if (hits.length === 0) return `[No mathlib premises found for "${query}"]`;
              return (
                `Relevant Lean 4 lemmas for "${query}":\n` +
                hits.map((h) => `  - ${h.theoremSignature}`).join("\n")
              );
            },

            // ── skill_apply: read SKILL.md and inject its content ─────────
            skill_apply: async (node) => {
              const cfg = node.config as { skillPath?: string };
              const skillPath = cfg.skillPath ?? "";
              try {
                const skillFile = Bun.file(skillPath);
                if (await skillFile.exists()) {
                  const content = await skillFile.text();
                  return { skillContent: content };
                }
              } catch { /* skill not found */ }
              return { skillContent: `[SKILL not found: ${skillPath}]` };
            },

            // ── aggregate: pick the result with lowest energy ─────────────
            aggregate: async (node, results) => {
              const cfg = node.config as { strategy?: string; sourceNodes?: string[] };
              const sources = cfg.sourceNodes ?? [];
              let best: { bestEnergy: number } | null = null;
              for (const src of sources) {
                const r = results.get(src) as { bestEnergy?: number } | undefined;
                if (r?.bestEnergy !== undefined) {
                  if (!best || r.bestEnergy < best.bestEnergy) {
                    best = r as { bestEnergy: number };
                  }
                }
              }
              return best ?? { note: "no results to aggregate" };
            },

            // ── algebraic_graph_construction: VM-sandbox J edge rule → AdjacencyMatrix ──
            // The ARCHITECT (in Wiles Mode) emits this node kind to test an
            // algebraic symmetry (Cayley/Paley graph) without SA. The builder:
            //   1. Compiles edge_rule_js in a vm.Script sandbox (only Math exposed)
            //   2. Verifies via ramseyEnergy
            //   3. Journals SAT/UNSAT and persists the candidate for memetic seeding
            algebraic_graph_construction: async (node) => {
              const parseResult = AlgebraicConstructionConfigSchema.safeParse(node.config);
              if (!parseResult.success) {
                throw new Error(
                  `[AlgebraicBuilder] Invalid config for node "${node.id}": ${parseResult.error.message}`,
                );
              }
              const algConfig = parseResult.data;
              // Fall back to run-level r/s if not specified in the node config
              const rawSc = config.search_config as any;
              const algR = algConfig.r ?? rawSc?.r ?? 4;
              const algS = algConfig.s ?? rawSc?.s ?? 6;
              const buildResult = await AlgebraicBuilder.buildAndVerify(
                algConfig,
                algR,
                algS,
                null,      // journal handled inline below via addEntry
                workspace,
              );
              // Journal the outcome
              await journal.addEntry({
                type: "observation",
                claim: buildResult.status === "witness"
                  ? `AlgebraicBuilder E=0 witness: ${algConfig.description}`
                  : `AlgebraicBuilder no witness: E=${buildResult.energy} for ${algConfig.description}`,
                evidence: `AlgebraicBuilder vm.compile + ramseyEnergy(${algR},${algS}) on N=${algConfig.vertices} in ${buildResult.compiledInMs}ms`,
                target_goal: config.theorem_name,
              });


              return buildResult;
            },

            // ── smt_constraint: Python script generating Z3 assertions ──
            smt_constraint: async (node: any) => {
              const parseResult = SmtWilesConfigSchema.safeParse(node.config);
              if (!parseResult.success) {
                throw new Error(
                  `[SmtWilesBuilder] Invalid config for node "${node.id}": ${parseResult.error.message}`,
                );
              }
              const smtConfig = parseResult.data;
              const rawSc = config.search_config as any;
              const smtR = smtConfig.r ?? rawSc?.r ?? 4;
              const smtS = smtConfig.s ?? rawSc?.s ?? 6;
              const buildResult = await SmtWilesBuilder.buildAndVerify(smtConfig, smtR, smtS);

              let notes = "";
              if (buildResult.status === "witness" && buildResult.adj) {
                await journal.addEntry({
                  type: "observation",
                  claim: `SMT Wiles Builder witness: E=0`,
                  evidence: `SMT Logic found SAT witness in ${buildResult.compiledInMs}ms`,
                  target_goal: config.theorem_name,
                });
                notes = `Witness found! E=0`;
              } else if (buildResult.status === "unsat") {
                notes = `UNSAT (No satisfying graph for these constraints)`;
              } else if (buildResult.status === "timeout") {
                notes = `TIMEOUT (Z3 constraint explosion)`;
              } else {
                notes = `ERROR (Z3 Syntax/Runtime error in assertions)`;
              }

              console.log(
                `   ✅ Node \x1b[36m${node.id}\x1b[0m \x1b[90m(${node.kind})\x1b[0m \x1b[33m${buildResult.compiledInMs}ms\x1b[0m → ${notes}`,
              );

              return { status: buildResult.status, notes, witness: buildResult.adj };
            },

            // ── search / z3 / lean: context-aware stubs ─────────────────
            // These delegate to the outer SA loop but accept injected context
            // from upstream literature / mathlib_query nodes.
            search: async (node, results) => {
              const cfg = node.config as { contextFromNode?: string[] };
              const ctx = (cfg.contextFromNode ?? []).map((id) => results.get(id)).filter(Boolean);
              return { note: `search node "${node.id}" — handled by SA loop`, injectedContext: ctx };
            },
            z3: async (node, results) => {
              const cfg = node.config as { contextFromNode?: string[] };
              const ctx = (cfg.contextFromNode ?? []).map((id) => results.get(id)).filter(Boolean);
              return { note: `z3 node "${node.id}" — handled by LNS loop`, injectedContext: ctx };
            },
            lean: async (node, results) => {
              const cfg = node.config as { contextFromNode?: string[]; theoremSignature?: string };
              const contextParts: string[] = [];
              for (const srcId of cfg.contextFromNode ?? []) {
                const ctx = results.get(srcId);
                if (typeof ctx === "string") contextParts.push(ctx);
              }
              return {
                note: `lean node "${node.id}" — handled by tactic loop`,
                injectedContext: contextParts.join("\n\n"),
                theoremSignature: cfg.theoremSignature ?? "",
              };
            },
          });

          const dagResult = await executor.execute();
          console.log(`   🗺️  DAG complete: ${dagResult.succeeded.length} succeeded, ${dagResult.failed.length} failed, ${dagResult.blocked.length} blocked`);

          dagAttempted = true;
        } catch (dagErr: any) {
          console.warn(`   ⚠️ [DAG] formulateDAG failed: ${dagErr.message} — falling back to flat pivot`);
        }
      }

      // ── Flat pivot fallback (attempt 1, or if DAG failed) ──
      // Extract cumulative tabu hashes from journal so workers never re-enter
      // Z3-certified sterile basins regardless of which pivot path fired.
      const journalTabuHashes = await journal.getAllEntries().then(entries =>
        [...new Set(entries
          .filter(e => e.type === "failure_mode" && e.zobristHash)
          .map(e => e.zobristHash!))]
      );

      if (!dagAttempted) {
        const pivotedConfig = await callSafe(
          (previousError) => requestSearchPivot(apiKey, augmentedDigest, sp, prunedSchema, previousError, journalTabuHashes),
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
      } else {
        // DAG was executed — apply the flat pivot to advance the SA loop parameters
        // (DAG execution informs the ARCHITECT's next flat config decision)
        const pivotedConfig = await callSafe(
          (previousError) => requestSearchPivot(apiKey, augmentedDigest, sp, prunedSchema, previousError, journalTabuHashes),
          3,
          "ARCHITECT pivot (post-DAG)",
        );
        if (pivotedConfig) {
          sp = pivotedConfig;
          console.log(`   ✅ ARCHITECT pivoted (post-DAG):`);
          console.log(`      Vertices: ${sp.vertices}, R(${sp.r},${sp.s}), ${(sp.sa_iterations ?? 10_000_000).toLocaleString()} iters`);
        } else {
          console.log(`   ⚠️  Post-DAG pivot failed. Reusing previous config.`);
        }
      }
    }

    witnessFound = false; // If we get here, search loop ended without success
  }

  // ── Tactic Phase: LLM-driven proof search (for non-constructive proofs) ──
  let ollamaModel: string | undefined;
  try {
    const gc = await Bun.file(join(workspaceBase, "global_config/config.json")).json();
    ollamaModel = gc?.models?.tactician?.name;
  } catch {}
  const factory = new AgentFactory({ geminiApiKey: apiKey, ollamaModel });
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
  const workspaceBase = join(process.cwd(), "agent_workspace");

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

    config = await formulate(args.prompt!, apiKey, args.wiles);

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
  await executeRun(config, apiKey, args.wiles, args.maxPivots);

}


if (import.meta.main) {
  main().catch((err) => {
    console.error("💥 Perqed failed:", err);
    process.exit(1);
  });
}

