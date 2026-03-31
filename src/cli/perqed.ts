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
import { extractCommonSubgraph, describeObstruction } from "../search/obstruction_detector";

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
  /** Run the Auto-Curriculum Daemon (autonomous research loop). */
  daemon: boolean;
}

export function parseArgs(argv: string[] = process.argv.slice(2)): CliArgs {
  const args = argv;
  const promptArg = args.find((a) => a.startsWith("--prompt="));
  const promptFileArg = args.find((a) => a.startsWith("--prompt_file="));
  const configArg = args.find((a) => a.startsWith("--config="));
  const maxPivotsArg = args.find((a) => a.startsWith("--max-pivots="));
  const noconfirm = args.includes("--noconfirm");
  const wiles = args.includes("--wiles");
  const daemon = args.includes("--daemon");

  const maxPivots = maxPivotsArg ? parseInt(maxPivotsArg.replace("--max-pivots=", ""), 10) : 5;

  // --daemon bypasses the prompt/config requirement
  if (!daemon && !promptArg && !promptFileArg && !configArg) {
    console.error("Usage:");
    console.error("  perqed --prompt=\"<problem description>\"");
    console.error("  perqed --prompt_file=<path/to/prompt.txt>");
    console.error("  perqed --config=<path/to/run_config.json>");
    console.error("  perqed --prompt=\"...\" --noconfirm");
    console.error("  perqed --prompt=\"...\" --wiles   # Force Wiles Mode (Conceptual Scatter)");
    console.error("  perqed --prompt=\"...\" --max-pivots=1000");
    console.error("  perqed --daemon                  # Auto-Curriculum: autonomous research loop");
    process.exit(1);
  }

  let finalPrompt = promptArg?.replace("--prompt=", "");
  if (!finalPrompt && promptFileArg) {
    const fs = require("node:fs");
    const filePath = promptFileArg.replace("--prompt_file=", "");
    try {
      finalPrompt = fs.readFileSync(filePath, "utf-8").trim();
    } catch (e: any) {
      console.error(`❌ Failed to read prompt file ${filePath}: ${e.message}`);
      process.exit(1);
    }
  }

  return {
    prompt: finalPrompt,
    configPath: configArg?.replace("--config=", ""),
    noconfirm,
    wiles,
    maxPivots,
    daemon,
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
  /** The C++ penalty function backend to load. Optional — defaults based on problem_class when omitted. */
  evaluator_type?: "RAMSEY_CLIQUES" | "SRG_PARAMETERS" | "MATRIX_ORTHOGONALITY";
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
      description: "Structured search configuration. Set problem_class to indicate the search strategy.",
      properties: {
        problem_class: {
          type: SchemaType.STRING as const,
          enum: ["ramsey_coloring", "schur_partition", "vdw_partition", "unknown"],
        },
        domain_size: { type: SchemaType.NUMBER as const, description: "Number of integers (Schur) or vertices (Ramsey)" },
        num_colors: { type: SchemaType.NUMBER as const },
        num_partitions: { type: SchemaType.NUMBER as const, description: "Number of color classes for Schur/partition problems" },
        vdw_length: { type: SchemaType.NUMBER as const, description: "Length of the forbidden arithmetic progression, 'k'." },
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
    evaluator_type: {
      type: SchemaType.STRING as const,
      enum: ["RAMSEY_CLIQUES", "SRG_PARAMETERS", "MATRIX_ORTHOGONALITY"],
      description: "The targeted C++ heuristic evaluator algorithm to spin up for score validation.",
    },
  },
  required: [
    "run_name", "problem_description", "theorem_name",
    "max_iterations", "objective_md", "domain_skills_md",
    "search_config"
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
  // Run SA for any known constructive problem class
  return pc === "ramsey_coloring" || pc === "schur_partition" || pc === "vdw_partition";
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

If the problem requires constructing a witness (∃ in the theorem signature), you must populate search_config with the correct problem_class.

### Ramsey lower bounds R(r,s) ≥ n (construct a 2-coloring of K_{n-1})
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
Example — R(4,6) ≥ 36:
\`\`\`json
{ "problem_class": "ramsey_coloring", "domain_size": 35, "num_colors": 2, "r": 4, "s": 6, "symmetry": "circulant" }
\`\`\`
**IMPORTANT**: When \`symmetry: circulant\` is used, Z3 SMT is attempted first (~5-30s). If UNSAT, retries unconstrained.

### Schur number lower bounds S(r) ≥ N (find an r-coloring of {1..N} with no monochromatic x+y=z)
\`\`\`json
{
  "problem_class": "schur_partition",
  "domain_size": <N>,
  "num_partitions": <r>
}
\`\`\`
Example — S(6) ≥ 537:
\`\`\`json
{ "problem_class": "schur_partition", "domain_size": 537, "num_partitions": 6 }
\`\`\`
The SA engine will search for a partition_rule_js (a JS function body \`return (i-1) % 6;\` style) that yields zero monochromatic x+y=z violations.

### Van der Waerden lower bounds W(r, k) > N (find an r-coloring of {1..N} with no monochromatic k-term AP)
\`\`\`json
{
  "problem_class": "vdw_partition",
  "domain_size": <N>,
  "num_partitions": <r>,
  "vdw_length": <k>
}
\`\`\`
Example — W(5,3) ≥ 171:
\`\`\`json
{ "problem_class": "vdw_partition", "domain_size": 171, "num_partitions": 5, "vdw_length": 3 }
\`\`\`

### Problems that do NOT require a constructive witness
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
- Simulated Annealing search engine (partition-level, ~500K IPS per core)
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

  // ── SkillLibrary: inject relevant skill context into the formulation prompt ──
  let skillContext = "";
  try {
    const { SkillLibrary } = await import("../skills/skill_library");
    const skillsRoot = join(process.cwd(), ".agents", "skills");
    const skillLib = await SkillLibrary.loadAll(skillsRoot);
    if (skillLib.size() > 0) {
      skillContext = "\n\n" + skillLib.getSummaryBlock(prompt, 3);
      console.log(`📎 SkillLibrary: injecting ${Math.min(3, skillLib.size())} relevant skills into formulation`);
    }
  } catch {
    // Skills dir absent or parse error — proceed without skills
  }

  // ── Librarian: inject relevant literature context (vector search + offline fallback) ──
  let libraryContext = "";
  try {
    const { LocalEmbedder } = await import("../embeddings/embedder");
    const { VectorDatabase } = await import("../embeddings/vector_store");
    const { extractSearchQuery, keywordLiteratureFallback, formatLibraryMatch } =
      await import("../librarian/librarian_utils");

    // Bug 4: normalise the raw prompt before embedding — strips code blocks,
    // JSON, markdown structure so the embedding reflects math semantics only.
    const searchQuery = extractSearchQuery(prompt);

    // Bug 1: use the same absolute DB path as the seeder in executeRun().
    // Use process.cwd() instead of import.meta.dir to avoid read-only $bunfs
    // errors when running as a compiled standalone binary.
    const canonicalDbPath = join(process.cwd(), "data", "perqed.lancedb");
    const embedder = new LocalEmbedder();
    const db = new VectorDatabase(canonicalDbPath);
    await db.initialize();

    const queryVector = await embedder.embed(searchQuery);
    if (queryVector.length > 0) {
      const matches = await db.search(queryVector, 5);
      if (matches.length > 0) {
        // Bug 2: type-aware rendering — [Paper] for ARXIV, [Lemma] for MATHLIB
        libraryContext = "\n\n## Relevant Literature (from vector DB)\n\n";
        matches.forEach((m, i) => {
          libraryContext += formatLibraryMatch(m, i + 1) + "\n\n";
        });
        console.log(`📚 Librarian found ${matches.length} relevant premises`);
      }
    }

    // Bug 5: if vector search is unavailable or returns nothing, fall back to
    // the curated offline corpus in seed_literature.json — no Ollama required.
    if (!libraryContext) {
      libraryContext = keywordLiteratureFallback(searchQuery);
      if (libraryContext) {
        console.log("📚 Librarian: using offline keyword fallback (Ollama unavailable or DB empty)");
      }
    }
  } catch {
    // Ollama or LanceDB not available — proceed without library context
  }

  const doFormulate = async (previousError?: string) => {
    let p = buildFormulationPreamble(wilesMode) + "## The User's Problem Description\n\n" + prompt + skillContext + libraryContext;

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

  console.log("   ⠼ [Autoformalizer] Translating informal objective into type-safe Lean 4 signature...");
  const { AutoformalizerAgent } = await import("../agents/autoformalizer");
  const { LeanBridge } = await import("../lean_bridge");
  try {
    const auto = new AutoformalizerAgent({ leanBridge: new LeanBridge(), apiKey });
    config.theorem_signature = await auto.formalize(config.objective_md);
    console.log("   ✅ [Autoformalizer] Translation complete.");
  } catch (err: any) {
    const pc = config.search_config?.problem_class;
    if (pc === "vdw_partition" || pc === "schur_partition") {
      console.log(`   ⚠️ [Autoformalizer] Failed to formalize partition arithmetic for ${pc}. Using dummy signature to allow search to proceed.`);
      config.theorem_signature = `∃ (partition : Fin ${(config.search_config as any).domain_size ?? 1} → Fin ${(config.search_config as any).num_partitions ?? 1}), True := by sorry`;
    } else {
      console.error("\n❌ Autoformalization failed: " + err.message);
      throw err;
    }
  }

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
  // Augment the ARCHITECT-generated domain_skills_md with SkillLibrary content
  // so the prover MCTS agent sees full proof-technique guidance.
  let enrichedDomainSkills = config.domain_skills_md;
  try {
    const { SkillLibrary } = await import("../skills/skill_library");
    const skillsRoot = join(process.cwd(), ".agents", "skills");
    const skillLib = await SkillLibrary.loadAll(skillsRoot);
    if (skillLib.size() > 0) {
      const contextText = `${config.problem_description} ${config.theorem_signature}`;
      enrichedDomainSkills += "\n\n" + skillLib.getSummaryBlock(contextText, 3);
    }
  } catch { /* proceed with ARCHITECT-only skills */ }
  await Bun.write(skillsPath, enrichedDomainSkills);

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

  // ── Background Library Seeding (non-blocking) ──────────────────────────────
  // Bug 1: canonical process.cwd()-derived path so formulate() and
  // executeRun() share the same LanceDB directory regardless of CWD.
  // Bug 3: needsSeeding() replaces the count()<10 + magic-999-sentinel check.
  const DB_PATH = join(process.cwd(), "data", "perqed.lancedb");
  void (async () => {
    try {
      const librarian = new ArxivLibrarian({
        queries: DOMAIN_SEED_QUERIES,
        maxPerQuery: 15,
        dbPath: DB_PATH,
      });
      if (await librarian.needsSeeding()) {
        console.log("📚 [Librarian] DB sparse or stale — seeding domain papers in background...");
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
  const sc = config.search_config as any;
  const targetGoal = (sc?.problem_class === "schur_partition" || sc?.problem_class === "vdw_partition")
    ? (sc.problem_class === "vdw_partition" ? `W(${sc?.num_partitions ?? "?"}, ${sc?.vdw_length ?? "?"}) >= ${sc?.domain_size ?? "?"}` : `S(${sc?.num_partitions ?? "?"}) >= ${sc?.domain_size ?? "?"}`)
    : `R(${sc?.r ?? "?"},${sc?.s ?? "?"}) >= ${(sc?.domain_size ?? 0) + 1}`;

  let searchPhase: SearchPhase | null = null;
  let witnessFound = false;

  // ── Wiles Mode Intercept: Evaluate DAG upfront ──
  // Also fires for schur_partition/vdw_partition — the algebraic partition loop is the correct
  // search strategy for Schur/Van der Waerden regardless of the --wiles flag.
  const isPartitionProblem = config.search_config?.problem_class === "schur_partition" || config.search_config?.problem_class === "vdw_partition";
  if (wilesMode || isPartitionProblem) {
    if (wilesMode) {
      console.log(`\n🧮 [Wiles] SA bypass active — intercepting for Algebraic Builder DAG`);
    } else {
      console.log(`\n🔢 [Partition] Search routing to algebraic_partition_construction DAG loop`);
    }

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
        const cognitiveMode = await journal.getCognitiveTemperature(targetGoal);

        // ── FunSearch: Boot the Program Database ──
        const { ProgramDatabase } = await import("../search/program_database");
        const programDb = new ProgramDatabase(join(workspaceBase, "program_database.jsonl"));

        // ── TheoremGraph: load persistent obstruction tracker ──
        const { TheoremGraph } = await import("../proof_dag/theorem_graph");
        const theoremGraph = new TheoremGraph(join(workspaceBase, "theorem_graph.jsonl"));
        const knownObstructions = theoremGraph.toHyperbolicPromptString(500);
        if (knownObstructions) {
          console.log(`   🗺️  [TheoremGraph] ${theoremGraph.getObstructions().length} known obstruction(s) loaded`);
        }
        const fewShotBlock = programDb.formatFewShot(5);
        if (fewShotBlock) {
          console.log(`   🧬 [FunSearch] Injecting ${programDb.topKDiverse(5).length} best programs from prior runs`);
        }

        // ── Fast-path: For Schur partitions iteration 1, use the Gaussian norm seed directly ──
        // The ARCHITECT consistently ignores prompt-recommended seeds and generates weak rules.
        // Hardcode (i²+1) % 13 % 6 (E=420) as the forced first attempt.
        let builderConfig: any;
        let initNodeKind: string;
        let lastEvaluatedAdj: AdjacencyMatrix | null = memeticSeed;

        if (config.search_config?.problem_class === "schur_partition" && wilesAttempts === 1) {
          console.log(`\n   🎯 [FastPath] Using modular seed → SA 10M iters (reliably reaches E≈6) for S(6)`);
          const { AlgebraicPartitionConfigSchema } = await import("../proof_dag/algebraic_partition_config");
          
          builderConfig = AlgebraicPartitionConfigSchema.parse({
            domain_size: config.search_config?.domain_size ?? 537,
            num_partitions: config.search_config?.num_partitions ?? 6,
            partition_rule_js: `return (i - 1) % ${config.search_config?.num_partitions ?? 6};`,
            description: "Simple modular seed (i-1)%r",
          });
          builderConfig.energy_target = "schur";
          initNodeKind = "algebraic_partition_construction";
          console.log(`   🗺️  Hardcoded Partition Rule for ${builderConfig.domain_size} integers, ${builderConfig.num_partitions} partitions.`);
        } else {
          console.log(`\n   🏛️  Asking ARCHITECT to formulate Algebraic Rule directly...`);
          const { AlgebraicConstructionConfigSchema } = await import("../proof_dag/algebraic_construction_config");
        
          // Target 1: Track the last graph actually evaluated by the AlgebraicBuilder.

          builderConfig = await callSafe(
            () => architectClient.formulateAlgebraicRule(
              targetGoal,
              // Enrich journal with known structural obstructions from TheoremGraph
              knownObstructions ? `${journalSummaryText}\n\n${knownObstructions}` : journalSummaryText,
              cognitiveMode,
              lastEvaluatedAdj ?? undefined,  // Target 1: show ARCHITECT what its rule produced
              config.run_name,                 // Phase 4: runName → scratch/stuck_state.svg path
              fewShotBlock || undefined,       // Phase 12: FunSearch few-shot injection
            ),
            1,
            "ARCHITECT formulateAlgebraicRule (Wiles)"
          );

          if (!builderConfig) throw new Error("formulateAlgebraicRule failed to return a valid config.");

          // Branch on problem class to select the right schema and node kind
          if (isPartitionProblem) {
            const { AlgebraicPartitionConfigSchema } = await import("../proof_dag/algebraic_partition_config");
            builderConfig = AlgebraicPartitionConfigSchema.parse(builderConfig);
            if (config.search_config?.problem_class === "vdw_partition") {
              builderConfig.energy_target = "vdw";
              builderConfig.ap_length = (config.search_config as any).vdw_length ?? 3;
            } else {
              builderConfig.energy_target = "schur";
            }
            initNodeKind = "algebraic_partition_construction";
            console.log(`   🗺️  ARCHITECT emitted Partition Rule for ${builderConfig.domain_size} integers, ${builderConfig.num_partitions} partitions.`);
          } else {
            builderConfig = AlgebraicConstructionConfigSchema.parse(builderConfig);
            initNodeKind = "algebraic_graph_construction";
            console.log(`   🗺️  ARCHITECT emitted Algebraic Rule for ${builderConfig.vertices} vertices.`);
          }
        }

        const dagNodes: any[] = [{
          id: "init_alg",
          kind: initNodeKind,
          dependsOn: [],
          config: builderConfig
        }];

        // For Schur/VdW: gracefully cascade from the Architect's algebraic rule directly into parallel SA local-search
        if (isPartitionProblem) {
          dagNodes.push({
            id: "sa_from_seed",
            kind: "partition_sa_search",
            dependsOn: ["init_alg"],
            config: {
              ...builderConfig,
              warm_start_from_node: "init_alg",
              description: "SA local-search cascading from algebraic decomposition",
              sa_iterations: 10_000_000,
            }
          });
        }

        const currentDag: any = {
          id: `wiles_run_${wilesAttempts}`,
          goal: targetGoal,
          nodes: dagNodes,
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
                // Target 1: update lastEvaluatedAdj so next Vision prompt shows this graph
                lastEvaluatedAdj = buildResult.adj;
                // If Algebraic Build produced a better graph than the current memetic seed, adopt it
                if (!memeticSeed || buildResult.energy < (memeticSeedEnergy ?? Infinity)) {
                  memeticSeed = buildResult.adj;
                  memeticSeedEnergy = buildResult.energy;
                }
              }
              return buildResult;
            },
            algebraic_partition_construction: async (node) => {
              console.log(`   ⚙️  Compiling Partition Rule for node ${node.id}...`);
              const partConfig = node.config as any;
              let partResult;
              try {
                partResult = await AlgebraicBuilder.buildAndVerifyPartition(partConfig, safeJournal, workspace as any);
              } catch (e: any) {
                console.log(`\n   💥 [PartitionBuilder] Rule compilation failed: ${e.message}`);
                await journal.addEntry({
                  type: "failure_mode",
                  claim: `PartitionBuilder Error: ${e.message}`,
                  target_goal: targetGoal,
                  evidence: "buildAndVerifyPartition",
                });
                return { energy: NaN, status: "violations", note: e.message };
              }

              // Phase 12: Record evaluation into FunSearch Program Database
              if (partConfig.partition_rule_js && typeof partResult.energy === "number") {
                programDb.record({
                  rule_js: partConfig.partition_rule_js,
                  energy: partResult.energy,
                  description: partConfig.description ?? "unknown",
                  domain_size: partConfig.domain_size,
                  num_partitions: partConfig.num_partitions,
                });
              }

              // Track best partition energy for P2 circuit breaker
              if (typeof partResult.energy === "number" && !isNaN(partResult.energy)) {
                const prev = (globalThis as any).__perqed_best_partition_energy ?? Infinity;
                (globalThis as any).__perqed_best_partition_energy = Math.min(prev, partResult.energy);
              }

              if (partResult.energy === 0) {
                console.log(`   ✅ Partition Construction SAT! Witness found.`);
                witnessFound = true;
                const witnessPath = join(workspace.paths.scratch, "partition_witness.json");
                const colorClasses: number[][] = Array.from({ length: partConfig.num_partitions }, () => []);
                for (let i = 1; i <= partConfig.domain_size; i++) {
                  const b = partResult.partition[i];
                  if (b !== undefined && b >= 0) colorClasses[b]!.push(i);
                }
                await Bun.write(witnessPath, JSON.stringify({
                  domain_size: partConfig.domain_size,
                  num_partitions: partConfig.num_partitions,
                  description: partResult.description,
                  color_classes: colorClasses,
                }, null, 2));
                console.log(`\n📄 Partition witness written: ${witnessPath}`);
              } else {
                console.log(`   ❌ Partition Construction ${node.id} failed (E=${partResult.energy}). Journaling for replan...`);
                await journal.addEntry({
                  type: "observation",
                  claim: `PartitionBuilder UNSAT: E=${partResult.energy} for ${partResult.description}. Algebraic rule insufficient — escalate to partition_sa_search.`,
                  evidence: `buildAndVerifyPartition on {1..${partConfig.domain_size}} with ${partConfig.num_partitions} classes. Rule: ${partConfig.partition_rule_js?.slice(0, 60)}`,
                  target_goal: targetGoal,
                });
              }
              return partResult;
            },

            // ── partition_sa_search: Metropolis SA optimizer for sum-free partitions ──
            // Warm-starts from a prior algebraic_partition_construction result if available.
            partition_sa_search: async (node, dagResults) => {
              const cfg = node.config as any;
              const domainSize: number = cfg.domain_size ?? (config.search_config as any)?.domain_size ?? 537;
              const numPartitions: number = cfg.num_partitions ?? (config.search_config as any)?.num_partitions ?? 6;
              const saIterations: number = cfg.sa_iterations ?? 5_000_000;
              const energyTarget = cfg.energy_target ?? (config.search_config as any)?.energy_target ?? "schur";
              const apLength = cfg.ap_length ?? (config.search_config as any)?.vdw_length;
              const description: string = cfg.description ?? `SA partition search {1..${domainSize}}, ${numPartitions} classes`;

              // Pull warm-start partition from a prior node's result
              let warmStart: Int8Array | undefined;
              if (cfg.warm_start_from_node) {
                const priorResult = dagResults?.get(cfg.warm_start_from_node) as any;
                if (priorResult?.partition instanceof Int8Array) {
                  warmStart = priorResult.partition;
                  console.log(`   🌡️  Warm-starting SA from node '${cfg.warm_start_from_node}' (E=${priorResult.energy})`);
                }
              }

              console.log(`   ⚡ Partition SA: {1..${domainSize}}, ${numPartitions} classes, Target='${energyTarget}' — parallel workers...`);
              const { runParallelSA, buildDiverseWorkerConfigs } = await import("../search/parallel_sa_coordinator");
              const N_WORKERS = 4;
              let baseConfig: any = { domain_size: domainSize, num_partitions: numPartitions, sa_iterations: Math.floor(saIterations / N_WORKERS) };
              if (energyTarget === "vdw") {
                baseConfig.energy_target = "vdw";
                baseConfig.ap_length = apLength;
              }
              const workerConfigs = buildDiverseWorkerConfigs(
                N_WORKERS,
                baseConfig,
                // inject warm start into first worker if available
              ).map((cfg, idx) => idx === 0 && warmStart ? { ...cfg, warmStart, seed_strategy: "modular" as const } : cfg);
              const parallelResult = await runParallelSA({ workerConfigs });
              const saResult = { ...parallelResult.best };
              console.log(`   ⚡ [ParallelSA] ${N_WORKERS} workers done in ${(parallelResult.wallTimeMs/1000).toFixed(1)}s. Best E=${saResult.energy} (strategies: ${workerConfigs.map(c=>c.seed_strategy??'modular').join(',')})`);
              // Absorb any secondary results from parallel workers into the journal for future warm starts
              for (const r of parallelResult.allResults) {
                if (r.energy < saResult.energy) {
                  console.log(`   🔀 [ParallelSA] Secondary worker found better E=${r.energy}`);
                }
              }

              console.log(`   Partition SA finished: E=${saResult.energy} after ${saResult.iterations.toLocaleString()} iters`);

              // Track best partition energy for P2 circuit breaker
              if (typeof saResult.energy === "number") {
                const prev = (globalThis as any).__perqed_best_partition_energy ?? Infinity;
                (globalThis as any).__perqed_best_partition_energy = Math.min(prev, saResult.energy);
              }

              // Always persist best SA partition (even E>0) for cross-run warm-starts
              const saBestPath = join(workspace.paths.scratch, "partition_sa_best.json");
              const saColorClasses: number[][] = Array.from({ length: numPartitions }, () => []);
              for (let i = 1; i <= domainSize; i++) {
                const b = saResult.partition[i];
                if (b !== undefined && b >= 0) saColorClasses[b]!.push(i);
              }
              await Bun.write(saBestPath, JSON.stringify({
                domain_size: domainSize,
                num_partitions: numPartitions,
                energy: saResult.energy,
                description,
                color_classes: saColorClasses,
                partition_array: Array.from(saResult.partition),
              }, null, 2));
              console.log(`   💾 SA best partition saved to ${saBestPath}`);

              // ── Targeted Local Search: if E is small (1-20), try exhaustive reassignment ──
              if (saResult.energy > 0 && saResult.energy <= 20) {
                console.log(`   🔬 [LocalSearch] E=${saResult.energy} is near-zero. Attempting targeted exhaustive search...`);
                const { computeSumFreeEnergy } = await import("../math/optim/SumFreeEnergy");

                // Find the violating triples
                const p = saResult.partition;
                const violatingElements = new Set<number>();
                for (let x = 1; x <= domainSize; x++) {
                  for (let y = x; y <= domainSize; y++) {
                    const z = x + y;
                    if (z > domainSize) break;
                    if (p[x] === p[y] && p[y] === p[z]) {
                      violatingElements.add(x);
                      violatingElements.add(y);
                      violatingElements.add(z);
                    }
                  }
                }

                const elems = [...violatingElements].sort((a, b) => a - b);
                console.log(`   🔬 [LocalSearch] ${elems.length} elements involved in ${saResult.energy} violations: [${elems.slice(0, 20).join(", ")}${elems.length > 20 ? "..." : ""}]`);

                // For small element counts, try all possible reassignments
                if (elems.length <= 18) {
                  const totalCombinations = Math.pow(numPartitions, elems.length);
                  console.log(`   🔬 [LocalSearch] Exhaustive search: ${elems.length} elements × ${numPartitions} colors = ${totalCombinations.toLocaleString()} combinations`);

                  const candidate = new Int8Array(p);
                  let solved = false;

                  for (let combo = 0; combo < totalCombinations; combo++) {
                    // Encode combo as base-numPartitions digits
                    let tmp = combo;
                    for (let e = 0; e < elems.length; e++) {
                      candidate[elems[e]!] = tmp % numPartitions;
                      tmp = Math.floor(tmp / numPartitions);
                    }

                    const e = computeSumFreeEnergy(candidate, domainSize, numPartitions);
                    if (e === 0) {
                      console.log(`   ✅ [LocalSearch] SOLVED! Combination ${combo.toLocaleString()} → E=0`);
                      saResult.partition = new Int8Array(candidate);
                      saResult.energy = 0;
                      saResult.status = "witness";
                      solved = true;
                      break;
                    }

                    if (combo % 1_000_000 === 0 && combo > 0) {
                      console.log(`   🔬 [LocalSearch] Progress: ${(combo / totalCombinations * 100).toFixed(1)}%...`);
                    }
                  }

                  if (!solved) {
                    console.log(`   ❌ [LocalSearch] Exhaustive search complete — no E=0 found. The violated elements may require broader reassignment.`);
                  }
                } else {
                  console.log(`   ⚠️ [LocalSearch] Too many elements (${elems.length}) for exhaustive search. Skipping.`);
                }
              }

              // ── Spherical Riemannian GD: non-Euclidean continuous relaxation ──
              if (saResult.energy > 0 && saResult.energy <= 50) {
                console.log(`   📐 [Spherical] S^(K-1) Riemannian GD from E=${saResult.energy}...`);
                try {
                  const { runSphericalGradientDescent } = await import("../search/spherical_relaxation");
                  const { hardPartition: sphPartition, finalSphereEnergy } =
                    await runSphericalGradientDescent(saResult.partition, domainSize, numPartitions, 10_000, 0.01);
                  const { computeSumFreeEnergy: cSFE } = await import("../math/optim/SumFreeEnergy");
                  const sphDiscreteE = cSFE(sphPartition, domainSize, numPartitions);
                  console.log(`   📊 [Spherical] Projected E=${sphDiscreteE} (sphere E=${finalSphereEnergy.toFixed(3)})`);
                  if (sphDiscreteE < saResult.energy) {
                    console.log(`   ✨ [Spherical] Improved: E=${saResult.energy} → ${sphDiscreteE}`);
                    saResult.partition = sphPartition;
                    saResult.energy = sphDiscreteE;
                    if (saResult.energy === 0) saResult.status = "witness";
                  }
                } catch (e: any) {
                  console.log(`   ⚠️ [Spherical] Failed (non-fatal): ${e.message}`);
                }
              }

              // ── Bridge Learner: self-evolving manifold geometry pass ──────────────
              // Shares /tmp/bridge_experiences.jsonl with sa_loop.ts — experiences
              // from both pipelines improve the same TinyMLP reward model.
              if (saResult.energy > 0 && saResult.energy <= 50) {
                try {
                  const { BridgeLearner } = await import("../search/bridge_learner");
                  // Singleton: reuse across DAG nodes in the same run
                  if (!(globalThis as any).__perqedBridgeLearner) {
                    (globalThis as any).__perqedBridgeLearner = new BridgeLearner("/tmp/bridge_experiences.jsonl");
                  }
                  const bl: InstanceType<typeof BridgeLearner> = (globalThis as any).__perqedBridgeLearner;
                  const candidates = bl.propose().slice(0, 2);
                  for (const cand of candidates) {
                    const result = await bl.evaluate(cand, saResult.partition, domainSize, numPartitions, 300);
                    bl.updateRewardModel(cand, result);
                    if (result.discreteEAfter < saResult.energy) {
                      console.log(`   🔬 [Bridge:${cand.manifold}] E ${result.discreteEBefore} → ${result.discreteEAfter} (−${result.discreteEBefore - result.discreteEAfter})`);
                      // Decode to the best hard partition found by this manifold
                      const enc = cand.encode(saResult.partition, domainSize, numPartitions);
                      saResult.partition = cand.decode(enc, domainSize);
                      saResult.energy = result.discreteEAfter;
                      if (saResult.energy === 0) { saResult.status = "witness"; break; }
                    }
                  }
                } catch (e: any) {
                  // Non-fatal: bridge learner failure should never block Z3
                  console.log(`   💤 [Bridge] Skipped (non-fatal): ${e.message?.slice(0, 80)}`);
                }
              }

              // ── Z3 SMT Repair: if SDP didn't solve, try Z3 with wider repair window ──
              if (saResult.energy > 0 && saResult.energy <= 50) {
                console.log(`   🔧 [Z3Repair] Attempting Z3 SMT repair from E=${saResult.energy}...`);
                try {
                  const { runZ3Repair } = await import("../search/z3_partition_repair");
                  const solver = new (await import("../solver")).SolverBridge();
                  const z3Result = await runZ3Repair(saResult.partition, domainSize, numPartitions, solver);

                  if (z3Result.solved && z3Result.partition) {
                    console.log(`   ✅ [Z3Repair] Z3 found a valid repair! E=0 witness.`);
                    saResult.partition = z3Result.partition;
                    saResult.energy = 0;
                    saResult.status = "witness";
                  } else {
                    console.log(`   ❌ [Z3Repair] Z3 could not repair. Recording obstruction...`);
                    theoremGraph.addNode({
                      kind: "OBSTRUCTION",
                      label: `Z3 UNSAT on ${domainSize}-element partition at E=${saResult.energy}`,
                      energy: saResult.energy,
                      evidence: `${z3Result.z3Output.slice(0, 200)}`,
                    });
                  }
                } catch (e: any) {
                  console.log(`   ⚠️ [Z3Repair] Z3 execution failed: ${e.message}`);
                }
              }

              if (saResult.energy === 0) {
                console.log(`   ✅ Partition SA found E=0 witness!`);
                witnessFound = true;
                const witnessPath = join(workspace.paths.scratch, "partition_witness.json");
                const colorClasses: number[][] = Array.from({ length: numPartitions }, () => []);
                for (let i = 1; i <= domainSize; i++) {
                  const b = saResult.partition[i];
                  if (b !== undefined && b >= 0) colorClasses[b]!.push(i);
                }
                await Bun.write(witnessPath, JSON.stringify({ domain_size: domainSize, num_partitions: numPartitions, description, color_classes: colorClasses }, null, 2));
                console.log(`\n📄 Partition SA witness written: ${witnessPath}`);
                await journal.addEntry({ type: "observation", claim: `PartitionSA SAT: E=0 witness found for {1..${domainSize}} with ${numPartitions} classes.`, evidence: `SA ran ${saIterations.toLocaleString()} iters`, target_goal: targetGoal });
              } else {
                console.log(`   ❌ Partition SA no witness (E=${saResult.energy}). Journaling...`);
                await journal.addEntry({ type: "observation", claim: `PartitionSA UNSAT: best E=${saResult.energy} after ${saIterations.toLocaleString()} iters. Try more iterations or a different warm start.`, evidence: description, target_goal: targetGoal });
              }
              return saResult;
            },
          });

          await executor.execute();

          if (witnessFound) break;

          console.log(`   📝 DAG cycle finished without witness. Invoking Replanner...`);
          const currentJournalsText = await journal.getSummary(targetGoal);
          const cognitiveMode = await journal.getCognitiveTemperature(targetGoal);

          // Discover available SKILLs so the Wiles ARCHITECT can apply them in replanDAG
          let wilesAvailableSkills: string[] = [];
          try {
            const { readdir } = await import("node:fs/promises");
            const skillsRoot = join(workspaceBase, "..", ".agents", "skills");
            const entries = await readdir(skillsRoot, { withFileTypes: true });
            wilesAvailableSkills = entries.filter((e) => e.isDirectory()).map((e) => e.name);
          } catch { /* skills dir absent */ }

          // Enrich with hierarchy-ordered TheoremGraph obstructions (Poincaré ball ordering)
          const graphObstructions = theoremGraph.toHyperbolicPromptString(500);
          const enrichedJournalText = graphObstructions
            ? `${currentJournalsText}\n\n${graphObstructions}`
            : currentJournalsText;

          let appendedDag: any;
          appendedDag = await callSafe(
            () => architectClient.replanDAG(currentDag, enrichedJournalText, cognitiveMode, wilesAvailableSkills),
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

    // Target 3: Wiles→SA Fallback
    // If Wiles Mode exhausted all attempts without a witness, log the transition
    // and fall through to let the standard SA Island Model take over.
    // The best memeticSeed produced by Wiles becomes the warm-start for SA workers.
    if (!witnessFound) {
      console.log("\n🔁 [Wiles] Orthogonal Paradigm Forcing exhausted all attempts.");
      
      if (config.search_config?.problem_class === "ramsey_coloring") {
        console.log("   Falling back to SA Island Model with memetic seed as warm-start...");
        await journal.addEntry({
          type: "observation",
          claim: "Wiles Mode Orthogonal Forcing exhausted. Falling back to SA Island Model.",
          evidence: `${MAX_ARCHITECT_PIVOTS} outer × 3 inner attempts consumed without E=0 witness.`,
          target_goal: targetGoal,
        }).catch(() => {});
      }
    }
  }

  // Target 3: needsSearch now also fires when wilesMode is exhausted (witnessFound = false)
  // Previously "!wilesMode" hard-blocked SA after Wiles. Now SA runs as fallback.
  const needsSearch = !witnessFound && shouldRunSearchPhase(config.search_config, false);

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
    } else if (config.search_config?.problem_class !== "schur_partition" && config.search_config?.problem_class !== "vdw_partition") {
      // algebraic paradigms handle their own inline SA loops — not a warning
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

      // Target 4: Pre-warm JIT C++ evaluator in background.
      // CompilerAgent synthesizes an AVX-512 energy function; EvaluatorRouter
      // caches the compiled FFI handle for reuse by the surrogate funnel.
      // Fire-and-forget — compilation failure silently falls back to TS evaluator.
      void (async () => {
        try {
          const { CompilerAgent } = await import("../agents/compiler");
          const { EvaluatorRouter } = await import("../search/evaluator_router");
          const compilerAgent = new CompilerAgent({ apiKey });
          const r = sp.r ?? 4;
          const s = sp.s ?? 6;
          const n = sp.vertices ?? 35;
          const cppSource = await compilerAgent.generateEvaluator({
            constraint: `R(${r},${s}) Ramsey energy: count K_${r} red cliques and K_${s} blue independent sets`,
            n,
            r,
            s,
          });
          if (cppSource) {
            const { AdjacencyMatrix } = await import("../math/graph/AdjacencyMatrix");
            const router = EvaluatorRouter.getInstance(config.run_name);
            // Warmup call on a trivial 2-vertex graph to trigger compile and cache
            await router.evaluate(new AdjacencyMatrix(2), {
              evaluator_type: "JIT_CPP",
              r,
              s,
              cppSource,
            });
            console.log(`   ⚡ [JIT] C++ evaluator compiled and cached for run=${config.run_name}`);
          }
        } catch {
          // Compilation failed or clang++ unavailable — TS fallback active
        }
      })();

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

      // ── Phase 8: Obstruction Detector — post-SA near-miss analysis ─────────
      // Mathematical axiom: if ≥3 independent workers converge on E∈[1,2],
      // the shared topological substructure is the common edge set ─ an
      // 80%-threshold intersection. This is a heuristic fingerprint of the
      // glass floor obstruction, not a formal proof.
      // We filter E>0 to exclude exact witnesses, and E≤2 for tightest near-misses.
      void (async () => {
        try {
          const nearMisses = orchResult.allResults
            .filter(r => r.bestEnergy > 0 && r.bestEnergy <= 2 && r.bestAdj)
            .map(r => r.bestAdj!);

          if (nearMisses.length >= 3) {
            console.log(`\n🔍 [ObstructionDetector] ${nearMisses.length} workers stalled at E≤2 — extracting glass-floor fingerprint...`);
            const obs = extractCommonSubgraph(nearMisses);
            const desc = describeObstruction(obs);

            // Count invariant edges (AdjacencyMatrix has no .edgeCount property)
            let obstructionEdgeCount = 0;
            for (let i = 0; i < obs.n; i++)
              for (let j = i + 1; j < obs.n; j++)
                if (obs.hasEdge(i, j)) obstructionEdgeCount++;

            if (obstructionEdgeCount > 0) {
              console.log(`🔍 [ObstructionDetector] Glass floor identified: ${desc}`);
              // Fire-and-forget: journal write must never block the next pivot
              journal.addEntry({
                type: "observation",
                claim: `Structural obstruction detected: ${desc}`,
                evidence: `Identified across ${nearMisses.length} parallel SA workers stalling at E ≤ 2.`,
                target_goal: targetGoal,
              }).catch(e => console.error("[ObstructionDetector] Failed to write to journal:", e));
            }
          }
        } catch {
          // Obstruction detection is non-critical — never crash the main loop
        }
      })();

      // ── P3 + T2: Surrogate Funnel + Exact Energy Guard ────────────────────
      // If the PyTorch surrogate server is running, run the best graph through
      // the neighborhood funnel to find a lower-energy candidate before Z3.
      // Target 2: NEVER trust the surrogate's prediction for state updates.
      // Always verify the funnel's best candidate with the exact TS energy function.
      if (result.bestEnergy > 0 && result.bestAdj) {
        void (async () => {
          try {
            const { SurrogateClient } = await import("../search/surrogate_client");
            const { optimizeThroughFunnel } = await import("../search/neighborhood_funnel");
            const { EvaluatorRouter } = await import("../search/evaluator_router");
            const surrogate = new SurrogateClient();
            const healthy = await surrogate.checkHealth();
            if (healthy) {
              console.log(`   🧠 [Surrogate] Server healthy — running neighborhood funnel on E=${result.bestEnergy} graph...`);
              const funnelResult = await optimizeThroughFunnel(result.bestAdj, surrogate);
              // Target 2: compute EXACT ground-truth energy — reject surrogate hallucinations
              const router = EvaluatorRouter.getInstance(config.run_name);
              // Use the config's evaluator_type if set; for Ramsey-class problems default
              // to RAMSEY_CLIQUES. For non-Ramsey problems (Schur, partition) skip the
              // surrogate exact-energy guard — the funnel is Ramsey-specific anyway.
              const evalType = config.evaluator_type ?? (
                (config.search_config as any)?.problem_class === "ramsey_coloring"
                  ? "RAMSEY_CLIQUES"
                  : null
              );
              if (!evalType) {
                console.log("   🧠 [Surrogate] Skipping exact-energy guard (non-Ramsey problem class).");
                return;
              }
              const exactEnergy = await router.evaluate(funnelResult.bestMatrix, {
                evaluator_type: evalType as any,
                r: (config.search_config as any)?.r ?? 4,
                s: (config.search_config as any)?.s ?? 6,
              });
              if (exactEnergy < result.bestEnergy) {
                console.log(`   🧠 [Surrogate] Funnel verified: surrogate predicted E=${funnelResult.predictedEnergy}, exact E=${exactEnergy} (was ${result.bestEnergy}) — adopting.`);
                if (!memeticSeed || exactEnergy < (memeticSeedEnergy ?? Infinity)) {
                  memeticSeed = funnelResult.bestMatrix;
                  memeticSeedEnergy = exactEnergy;
                }
              } else {
                console.log(`   🧠 [Surrogate] Funnel rejected: surrogate predicted E=${funnelResult.predictedEnergy}, exact E=${exactEnergy} ≥ current E=${result.bestEnergy} — discarded.`);
              }
            }
          } catch {
            // Surrogate server unavailable or funnel error — proceed without
          }
        })();
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

            // ── lean_skeleton: sorry-stub structural decomposition (Phase 7 P1) ──
            // Axiomatic invariant: a sorry-laden skeleton is "valid" iff Lean
            // accepts the overall type structure (no hard errors) but defers the
            // proofs of individual lemmas to sorry.
            // Handler:
            //   1. Runs verifyStructuralSkeleton — exits 0 + hasSorry, no "error:"
            //   2. If valid: spawns one `tactic` DAGNode per sorry goal, injecting
            //      each into currentDag so the executor picks them up next iteration
            //   3. If invalid: throws — marks node as failed, ARCHITECT must replan
            lean_skeleton: async (node) => {
              const leanCode = (node.config as any).leanCode as string | undefined;
              if (!leanCode) {
                throw new Error(`[LeanSkeleton] node "${node.id}" missing config.leanCode`);
              }

              console.log(`   🦴 [LeanSkeleton] Verifying structural skeleton for node "${node.id}"...`);
              const skeletonResult = await lean.verifyStructuralSkeleton(leanCode);

              if (!skeletonResult.valid) {
                throw new Error(
                  `[LeanSkeleton] Structural skeleton for "${node.id}" failed Lean type-checking. ` +
                  `Skeleton must compile with only sorry warnings, not hard errors.`
                );
              }

              console.log(
                `   🦴 [LeanSkeleton] Skeleton valid. Decomposing into ` +
                `${skeletonResult.sorryGoals.length} subgoal(s): ${skeletonResult.sorryGoals.join(", ")}`
              );

              // Dynamically expand the DAG: one tactic node per sorry stub
              for (const goal of skeletonResult.sorryGoals) {
                const subNodeId = `skel_tactic_${node.id}_${goal}`;
                if (!dag.nodes.find((n: any) => n.id === subNodeId)) {
                  dag.nodes.push({
                    id: subNodeId,
                    kind: "lean" as const,
                    label: `Resolve sorry stub: ${goal}`,
                    dependsOn: [node.id],
                    config: {
                      target_goal: goal,
                      parentSkeleton: node.id,
                      leanCode,
                    },
                    status: "pending" as const,
                  });
                }
              }

              // Journal the structural decomposition
              await journal.addEntry({
                type: "observation",
                claim: `Lean skeleton "${node.id}" valid — decomposed into ${skeletonResult.sorryGoals.length} sub-lemmas`,
                evidence: `sorry goals: ${skeletonResult.sorryGoals.join(", ")}`,
                target_goal: config.theorem_name,
              });

              return {
                valid: true,
                sorryGoals: skeletonResult.sorryGoals,
                spawnedNodes: skeletonResult.sorryGoals.map(g => `skel_tactic_${node.id}_${g}`),
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

  // ── P2 Circuit Breaker: Skip MCTS for computational-only problem classes ──
  // If the problem class is purely computational (e.g. schur_partition) and
  // the SA/algebraic search didn't find E=0, the LLM cannot synthesize the
  // witness via Lean tactics. Short-circuit immediately.
  const { shouldSkipMCTSForCombinatorialSearch } = await import("../search/witness_detector");
  const problemClass = config.search_config?.problem_class ?? "unknown";
  // bestPartitionEnergy is set by the Wiles/SA loop above; default to Infinity if never set
  const bestE = (globalThis as any).__perqed_best_partition_energy ?? Infinity;
  if (shouldSkipMCTSForCombinatorialSearch({ problem_class: problemClass, bestEnergy: bestE })) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("\n══════════════════════════════════════════════");
    console.log(`  ❌ COMPUTATIONAL SEARCH EXHAUSTED after ${elapsed}s`);
    console.log(`  Problem class "${problemClass}" requires a computational witness (E=0).`);
    console.log(`  Best energy achieved: E=${bestE}. MCTS tactic search is not applicable.`);
    console.log(`  Lab log: ${workspace.paths.labLog}`);
    console.log("══════════════════════════════════════════════");
    return;
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
    objective: config.objective_md,
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
// Geodesic Audit — Hyperbolic Bridge Proof Status
// ──────────────────────────────────────────────

/**
 * `perqed geodesic-audit`
 *
 * Runs `lake build GoldbachGeodesic` in src/lean/ and parses the output
 * to emit a per-theorem sorry count and open-frontier report.
 *
 * Requires: `lake` (Lean 4 build tool) installed and on PATH.
 */
async function runGeodesicAudit(): Promise<void> {
  const { spawnSync } = await import("node:child_process");
  const { readFileSync } = await import("node:fs");
  const leanDir = join(process.cwd(), "src", "lean");
  const leanFile = join(leanDir, "GoldbachGeodesic.lean");

  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║  🔭 PERQED — Geodesic Audit (Hyperbolic Bridge)   ║");
  console.log("╚═══════════════════════════════════════════════════╝\n");

  // ── Check prerequisites ──────────────────────────────────────────────────
  const lakeCheck = spawnSync("which", ["lake"], { encoding: "utf-8" });
  if (lakeCheck.status !== 0) {
    console.error("❌ `lake` not found. Install Lean 4 via elan: https://leanprover.github.io/lean4/doc/setup.html");
    process.exit(1);
  }

  // ── Parse sorry count from GoldbachGeodesic.lean directly ────────────────
  // This gives an instant static analysis even without lake build.
  let sorryCount = 0;
  const theoremSorries: Record<string, number> = {};
  let currentTheorem = "<top-level>";

  try {
    const source = readFileSync(leanFile, "utf-8");
    const lines = source.split("\n");
    for (const line of lines) {
      const thmMatch = line.match(/^(?:theorem|def|noncomputable def)\s+(\w+)/);
      if (thmMatch) currentTheorem = thmMatch[1]!;
      if (line.includes("exact sorry") || line.trim() === "sorry") {
        sorryCount++;
        theoremSorries[currentTheorem] = (theoremSorries[currentTheorem] ?? 0) + 1;
      }
    }
  } catch (e: any) {
    console.error(`❌ Could not read ${leanFile}: ${e.message}`);
    process.exit(1);
  }

  // ── Static Sorry Report ──────────────────────────────────────────────────
  console.log("📊 Static Analysis (sorry count per theorem):\n");

  const OPEN_FRONTIER = "geodesic_to_additive_bridge";
  const rows = Object.entries(theoremSorries).map(([name, count]) => ({
    name,
    count,
    marker: name === OPEN_FRONTIER ? " ⭐ OPEN FRONTIER" : "",
  }));

  // Sort: open frontier last, then by count desc
  rows.sort((a, b) => {
    if (a.name === OPEN_FRONTIER) return 1;
    if (b.name === OPEN_FRONTIER) return -1;
    return b.count - a.count;
  });

  const maxNameLen = Math.max(...rows.map(r => r.name.length), 20);
  console.log(`  ${"Theorem".padEnd(maxNameLen)}  sorry  Status`);
  console.log(`  ${"─".repeat(maxNameLen)}  ─────  ──────────────────`);
  for (const { name, count, marker } of rows) {
    const status = name === OPEN_FRONTIER
      ? "🚧 Open mathematical problem"
      : count === 0 ? "✅ Clean" : "⏳ Stub (sorry)";
    console.log(`  ${name.padEnd(maxNameLen)}  ${String(count).padStart(5)}  ${status}${marker}`);
  }

  console.log(`\n  Total sorry stubs: ${sorryCount}`);
  console.log(`  Type errors:       0  (static parse — run lake build to confirm)\n`);

  // ── Dependency graph ─────────────────────────────────────────────────────
  console.log("📐 Dependency Graph (what blocks what):\n");
  console.log("  spectralGap (def)");
  console.log("    └── prime_geodesic_theorem");
  console.log("          └── spectral_gap_error_improvement");
  console.log("                └── prime_geodesic_pair_count_lower_bound");
  console.log("                      └── prime_geodesic_pairs_exist");
  console.log("                            └── geodesic_to_additive_bridge  ⭐");
  console.log("                                  └── [Goldbach Conjecture]\n");

  // ── Attempt lake build ───────────────────────────────────────────────────
  console.log("🔨 Attempting `lake build GoldbachGeodesic` in src/lean/ ...\n");
  const result = spawnSync("lake", ["build", "GoldbachGeodesic"], {
    cwd: leanDir,
    encoding: "utf-8",
    timeout: 300_000, // 5 min — Mathlib first build is slow
  });

  if (result.status === 0) {
    console.log("✅ Lean build succeeded — no type errors.\n");
  } else {
    console.log("⚠️  Lake build output:");
    if (result.stdout) console.log(result.stdout.slice(0, 2000));
    if (result.stderr) console.log(result.stderr.slice(0, 2000));
    console.log("\n💡 If Mathlib has not been fetched yet, run: cd src/lean && lake exe cache get");
  }

  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║  Audit complete. Fill sorry stubs to make progress ║");
  console.log("╚═══════════════════════════════════════════════════╝\n");
}

// ──────────────────────────────────────────────
// Main — Single Flow
// ──────────────────────────────────────────────

async function main() {
  // Subcommand dispatch — check before GEMINI_API_KEY validation
  const subcommand = process.argv[2];
  if (subcommand === "geodesic-audit") {
    await runGeodesicAudit();
    return;
  }

  const args = parseArgs();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY not set. Export it or add to .env");
    process.exit(1);
  }

  // ── Phase 5: Auto-Curriculum Daemon ──────────────────────────────────────
  if (args.daemon) {
    const { AutoCurriculumDaemon } = await import("../librarian/auto_curriculum");
    const daemon = new AutoCurriculumDaemon({
      apiKey,
      verifiedLibDir: join(process.cwd(), "verified_lib"),
    });
    console.log("🤖 [perqed] --daemon flag detected — launching Auto-Curriculum Daemon");
    console.log("   Press Ctrl+C to stop.\n");
    await daemon.run();
    return;
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
