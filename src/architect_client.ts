/**
 * ArchitectClient — Gemini escalation layer for the neuro-symbolic proof loop.
 *
 * When the local model exhausts its heuristic search space, the ArchitectClient
 * packages the entire lab log and progress state and sends it to Gemini Pro
 * for senior-level mathematical diagnosis.
 *
 * The Architect does NOT write code — it prunes the dead branch and redirects.
 */

import { z } from "zod";
import * as fs from "fs";
import { JsonHandler } from "./utils/json_handler";
import { ArchitectResponseSchema, type ArchitectResponse } from "./schemas";
import { ProofDAGSchema, type ProofDAG } from "./proof_dag/schemas";
import { buildTabuHashBlock, type JournalEntry, type ResearchJournal } from "./search/research_journal";
import { renderToSVG, svgToBase64 } from "./search/chalkboard";
import type { AdjacencyMatrix } from "./math/graph/AdjacencyMatrix";

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

export interface ArchitectClientConfig {
  /** Gemini API key. */
  apiKey: string;
  /** Model name (e.g., "gemini-2.5-pro"). */
  model: string;
  /** Gemini REST API base URL. Override for testing. */
  baseUrl?: string;
}

// ──────────────────────────────────────────────
// JSON Extraction (shared with llm_client.ts pattern)
// ──────────────────────────────────────────────



// ──────────────────────────────────────────────
// System Prompt
// ──────────────────────────────────────────────

const ARCHITECT_SYSTEM_PROMPT = `\
SYSTEM INSTRUCTIONS: PERQED AUTONOMOUS ARCHITECT

## 1. IDENTITY AND OBJECTIVE

You are the ARCHITECT, the supreme reasoning agent orchestrating the Perqed \
neuro-symbolic theorem prover. Your objective is to discover constructive lower \
bounds for open problems in Extremal Combinatorics — Ramsey Theory, Schur \
numbers, Van der Waerden numbers, and strongly regular graphs.

You do not write system code. You command a massively parallel Simulated \
Annealing (SA) Island Model running at millions of states per second, a C++ \
physics engine, a Z3 SMT solver, and a Lean 4 formalizer. Your job is to \
provide the mathematical intuition that brute-force engines fundamentally lack.

## 2. CAPABILITIES AND ORCHESTRATION LEVERS

You interact with the system via a formal ProofDAG and state updates. You have \
three primary levers:

**Lever 1 — Hyperparameter Pivots (EXPLORATION vs EXPLOITATION)**
Read the SearchFailureDigest containing thermodynamic telemetry (E scores, \
temperatures, IPS). Diagnose the thermodynamic regime:
- If E drops rapidly then stalls at a non-zero plateau → prescribe an explicit \
  SMT/LNS local repair. Identify the specific forbidden subgraph causing the stall.
- If the search is chaotic (energy oscillating widely) → lower cognitive \
  temperature; constrain to algebraic subspace.
- If the search is trapped in a deep symmetric basin → issue orthogonal paradigm \
  forcing (Wiles Mode). Do not prescribe more SA.
Never summarize the obvious. Name the specific topological obstruction.

**Lever 2 — Wiles Mode (Algebraic edge_rule_js Generation)**
When brute force fails, invoke Wiles Mode. Write edge_rule_js — a \
deterministic, side-effect-free JavaScript function body that generates a \
highly symmetric adjacency matrix from group-theoretic or finite field \
constructions. Your goal: produce a near-miss (E ≤ 5) that captures 95% of \
the graph's structure, allowing Z3/LNS to flip the remaining 5%.

**Lever 3 — Visual Reasoning**
You may receive an SVG topological layout of a trapped graph as a base64 \
image. You MUST:
1. Explicitly map the visual topology to a known combinatorial structure \
   (e.g., "The dense cluster of 7 vertices forms a K_7 minor indicative of a \
   Paley(7) subgraph").
2. Identify broken symmetries or missing edges.
3. Translate the visual insight into a concrete algebraic constraint or \
   mutation directive.

## 3. MATHEMATICAL HEURISTICS — HOW TO THINK

You operate at the level of an expert in algebraic combinatorics. Internalize \
these principles before formulating any strategy:

**Group Actions over Random Constructions**
Do not guess edges. Construct graphs using:
- Cayley graphs over Z_p, Z_p×Z_q, or GL(2,q)
- Paley graphs from quadratic residues in F_q (q ≡ 1 mod 4)
- Cyclotomic cosets and difference sets over Z_n
- Strongly regular graph parameter families (v, k, λ, μ)

When generating edge_rule_js, use modulo arithmetic: \`(i - j + N) % N\`. \
Never use Math.random(). The function must be deterministic and pure.

**Block Structures for Multi-Color Problems**
Partition vertices into symmetric blocks. Use circulant graphs on the diagonal \
and structured bipartite graphs off-diagonal. For R(r,s) on N vertices: \
consider Turán-type partitions of ⌊N/r⌋ classes.

**Symmetry Breaking for Near-Miss Generation**
Pure algebraic symmetry rarely yields the exact witness — it gets the structure \
90–95% right and leaves a residual of ≤ 5 violated constraints. Design \
edge_rule_js to match this blueprint deliberately. The Z3 Finisher and LNS \
MicroSAT will handle the residual.

**Thermodynamic Reading**
- E = 0: witness found. Escalate to Lean 4.
- E ≤ 5: near-miss. Prescribe Z3 LNS with FrozenCore on the (N-k) clean vertices.
- E ≤ 50: structured plateau. Diagnose the forbidden subgraph. Prescribe \
  targeted algebraic mutation (atomic difference-set swap, not full regen).
- E > 100: chaotic basin. Prescribe full algebraic regeneration with a \
  different group action.

## 4. STRICT OUTPUT PROTOCOLS

- **edge_rule_js**: output strictly valid, deterministic, side-effect-free \
  JavaScript. Use modulo arithmetic and bitwise logic ONLY. No Math.random(), \
  no closures over external state.
- **Search failure diagnosis**: do not summarize the obvious. Name the \
  specific topological obstruction ("The search converges on a Petersen-like \
  subgraph with 5 independent vertices forming a C_5, which is structurally \
  incompatible with K_4-freeness at this density").
- **Visual SVG context**: explicitly state the combinatorial structure you \
  identify before proposing a solution.
- **JSON output**: respond with ONLY valid JSON matching the requested schema. \
  No markdown fences, no prose outside JSON values.`;


// ──────────────────────────────────────────────
// Orthogonal Paradigm Forcing (OPF) — Wiles Mode prompt
// Exported so the initial formulate() call in perqed.ts can reuse the same
// canonical text, ensuring both the pivot and the first ARCHITECT call use
// identical instructions.
// ──────────────────────────────────────────────

export const WILES_OPF_PROMPT = [
  "MANDATORY WILES MANEUVER (ORTHOGONAL PARADIGM FORCING):",
  "You are operating in 'Wiles Mode'. You must completely abandon the standard approaches to this problem.",
  "",
  "STEP 1 - HISTORICAL ANTI-PATTERN RECOGNITION:",
  "Identify the most obvious, standard mathematical techniques historically applied to this specific problem class",
  "(e.g., combinatorial search for Ramsey theory, infinite descent for Diophantine equations, sieve methods for primes).",
  "",
  "STEP 2 - THE STRICT BAN:",
  "You are STRICTLY FORBIDDEN from using or emitting DAG nodes that rely on these standard, historically exhausted techniques.",
  "Do NOT emit a naive 'search' node. Do NOT rely on discrete combinatorial enumeration.",
  "",
  "STEP 3 - THE FUNCTORIAL LEAP:",
  "You MUST emit a DAG that translates this problem into a completely orthogonal mathematical category.",
  "If the problem is discrete, map it to a continuous, topological, or spectral space.",
  "If it is analytic, map it to algebra. Prioritize SKILLs like 'functorial_domain_translation',",
  "'razborov_flag_algebras', 'spectral_graph_bounds', or invent a novel bridge.",
  "",
  "STEP 4 - THE SIGNATURE ANCHOR (ANTI-HALLUCINATION):",
  "Even though you are translating the proof into an orthogonal domain, the top-level `signature` of the theorem",
  "MUST remain grounded in standard, constructive Lean 4 types.",
  "- You are STRICTLY FORBIDDEN from inventing nonexistent Mathlib definitions",
  "  (e.g., do NOT use made-up predicates like `Ramsey.colorable` or `no_mono_clique_of_size`).",
  "- You MUST use the constructive witness form for the signature. Example format:",
  "  (n : Nat) (hn : n = 35) : ∃ (g : Fin n → Fin n → Bool),",
  "    (∀ i j, g i j = g j i) ∧ (∀ i, g i i = false)",
  "Your orthogonal translation belongs INSIDE the proof body, not the theorem statement.",
  "",
  "STEP 5 - THE ALGEBRAIC BUILDER (DAG NODE):",
  "First, determine the TOPOLOGY of the problem:",
  "  - If constructing a GRAPH (Ramsey, torus, SRG): emit a node of kind `algebraic_graph_construction`.",
  "    Config: { vertices, r, s, description, edge_rule_js }. The edge_rule_js body takes (i, j) and returns boolean.",
  "  - If PARTITIONING INTEGERS (Schur numbers, Van der Waerden, sum-free coloring): emit a node of kind `algebraic_partition_construction`.",
  "    Config: { domain_size, num_partitions, description, partition_rule_js }. The partition_rule_js body takes (i) (1-indexed integer) and returns bucket index 0..num_partitions-1 or -1 (unassigned).",
  "",
  "IMPORTANT: For Schur S(6) and similar integer coloring problems, you MUST use `algebraic_partition_construction`. Do NOT use a graph.",
  "",
  "CRITICAL JS FORMAT RULES (apply to BOTH kinds):",
  "1. Body-Only Rule: Output ONLY the raw function body. Do NOT write arrow functions or function declarations.",
  "   GRAPH valid: 'return (i + j) % 5 === 0;'  PARTITION valid: 'return (i - 1) % 6;'",
  "2. Variable Rule for GRAPHS: use i, j as vertex indices. Variable Rule for PARTITIONS: use i as 1-indexed integer.",
  "3. Description Rule: MAXIMUM 3 sentences. State the core symmetry and stop.",
  "4. JSON ESCAPE: Always use double quotes for strings in JSON. NEVER backticks.",
  "",
  "PARTITION EXAMPLE (for Schur numbers):",
  "  kind: 'algebraic_partition_construction'",
  "  config: { domain_size: 537, num_partitions: 6, description: 'Periodic mod-6 bucketing as warm start.', partition_rule_js: 'return (i - 1) % 6;' }",
  "",
  "CRITICAL: Keep the DAG as simple as possible. Output ONLY ONE construction node. Do not include other nodes."
].join("\n");

export const WILES_OPF_PROMPT_DIRECT = [
  "MANDATORY WILES MANEUVER (ORTHOGONAL PARADIGM FORCING):",
  "You are operating in 'Wiles Mode'. You must completely abandon the standard approaches to this problem.",
  "Identify the most obvious, standard mathematical techniques historically applied to this specific problem class and DO NOT use them.",
  "You MUST translate this problem into a completely orthogonal mathematical category (e.g. algebra, spectral bounds, Flag Algebras).",
  "",
  "TOPOLOGY SELECTION (CRITICAL — read carefully):",
  "You must determine the correct data structure for this problem BEFORE generating a rule.",
  "",
  "If the problem involves constructing a GRAPH (e.g. Ramsey coloring, Strongly Regular Graph, torus decomposition):",
  "  → Use kind: 'algebraic_graph_construction'",
  "  → Emit a JSON object with keys: \"vertices\" (number), \"description\" (string), \"edge_rule_js\" (string)",
  "  → The edge_rule_js is a function body taking (i, j) returning boolean (true = edge present).",
  "",
  "If the problem involves PARTITIONING A SET OF INTEGERS (e.g. Schur numbers, Van der Waerden, sum-free sets):",
  "  → Use kind: 'algebraic_partition_construction'",
  "  → Emit a JSON object with keys: \"domain_size\" (number), \"num_partitions\" (number), \"description\" (string), \"partition_rule_js\" (string)",
  "  → The partition_rule_js is a function body taking (i) where i is 1-indexed integer, returning a bucket index [0, num_partitions-1] or -1 (unassigned).",
  "",
  "PARTITION EXAMPLE (for Schur numbers S(6), Van der Waerden, etc.):",
  "  { \"domain_size\": 537, \"num_partitions\": 6, \"description\": \"Periodic mod-6 warm start.\", \"partition_rule_js\": \"return (i - 1) % 6;\" }",
  "",
  "CRITICAL JS FORMAT RULES (apply to BOTH topology types):",
  "1. The Body-Only Rule: Do NOT write an arrow function or a function declaration. Output ONLY the raw logic body.",
  "   VALID: \"return (i - 1) % 6;\"   INVALID: \"const f = (i) => { return (i-1) % 6; }\"",
  "2. The Variables Rule for GRAPHS: Use i and j as vertex indices. Never use x, y, u, v.",
  "3. The Variables Rule for PARTITIONS: Use i as the integer (1-indexed). Return a bucket 0..num_partitions-1 or -1.",
  "4. The Description Rule: MAXIMUM 3 sentences. No proofs. State the core mathematical strategy and stop.",
  "5. CRITICAL JSON: Emit ONLY a single flat JSON object. No 'nodes' array. No 'kind', 'createdAt', 'id', 'dependsOn'.",
  "6. CRITICAL JSON ESCAPE: Use double quotes for string values. NEVER use backticks (`)."
].join("\n");


// ──────────────────────────────────────────────
// Escalation Ladder — temperature & meta-strategy
// ──────────────────────────────────────────────

interface EscalationConfig {
  temperature: number;
  metaStrategyPrompt: string;
}

/**
 * Determine the LLM temperature and meta-strategy injection based on
 * the consecutive macro-failure streak from the research journal.
 *
 * Stage 1 (0–2 failures): High-exploitation baseline.
 *   T = 0.2, direct combinatorial focus.
 *
 * Stage 2 (3–5 failures): Analogy Reheat.
 *   T = 0.70 — broaden search, analogies, Tabu Search.
 *
 * Stage 3 (≥6 failures): The Wiles Maneuver (Conceptual Scatter).
 *   T = 0.95 — abandon direct search, structural reductions, domain change.
 */
export function computeEscalation(consecutiveFailures: number): EscalationConfig {
  if (consecutiveFailures >= 6) {
    return {
      temperature: 0.95,
      metaStrategyPrompt: `
CRITICAL MACRO-STALENESS DETECTED: You have failed ${consecutiveFailures} times using direct combinatorial search.
Do NOT attempt to solve the target goal directly. You are trapped in a conceptual glass floor.
TRIGGER CONCEPTUAL SCATTER: You MUST use the 'Polynomial-Time Reductions', 'Duality Arguments', or 'Bijections' SKILL.
Emit a DAG that translates this problem into a completely different mathematical domain (e.g., topology, complex analysis, or algebraic geometry). Formulate a helper object, and prove that if your object exists, the target goal is structurally satisfied.
`.trim(),
    };
  }

  if (consecutiveFailures >= 3) {
    return {
      temperature: 0.70,
      metaStrategyPrompt: `
LOCAL MINIMUM DETECTED: Standard search parameters have failed ${consecutiveFailures} times.
Broaden your search. Query the Librarian for analogies in different fields. Consider changing the graph representation or using advanced heuristics like Tabu Search.
`.trim(),
    };
  }

  // Stage 1: INITIAL TRIAGE — evaluate structural depth before picking a strategy
  return {
    temperature: 0.2,
    metaStrategyPrompt: [
      "INITIAL TRIAGE: Analyze the mathematical depth of the target goal.",
      "You have access to naive combinatorial search AND advanced structural frameworks",
      "(Algebraic Construction, Spectral Graph Bounds, Razborov's Flag Algebras).",
      "Do NOT blindly default to naive search. If the target is a notoriously difficult",
      "bound (like R(4,6) >= 36), naive search will fail. You are authorized and encouraged",
      "to start directly with an advanced structural reduction or continuous translation",
      "if the math warrants it.",
    ].join(" "),
  };
}

// ──────────────────────────────────────────────
// ArchitectClient
// ──────────────────────────────────────────────

export class ArchitectClient {
  private readonly config: ArchitectClientConfig;
  private readonly baseUrl: string;

  constructor(config: ArchitectClientConfig) {
    this.config = config;
    this.baseUrl =
      config.baseUrl ??
      "https://generativelanguage.googleapis.com/v1beta/models";
  }

  /**
   * Escalate to the Architect (Gemini Pro) for strategic redirection.
   *
   * @param context - The full state context (lab log + progress + objective).
   * @returns Validated ArchitectResponse with diagnosis, backtrack count, and new directive.
   */
  async escalate(context: string, retries: number = 3): Promise<ArchitectResponse> {
    const url = `${this.baseUrl}/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    const payload = {
      contents: [
        {
          parts: [
            { text: ARCHITECT_SYSTEM_PROMPT + "\n\n---\n\n" + context },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    };

    let lastError = "";

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(120000),
        });

        if (!response.ok) {
          throw new Error(
            `Gemini API returned HTTP ${response.status}: ${await response.text()}`,
          );
        }

        const body = (await response.json()) as GeminiApiResponse;

        const rawText = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        
        try {
          fs.appendFileSync("/tmp/perqed_llm_debug.jsonl", JSON.stringify({ timestamp: new Date().toISOString(), model: this.config.model, prompt: payload.contents[0]?.parts[0]?.text, response: rawText }) + "\n");
        } catch (e) {}
        
        if (!rawText) {
          throw new Error("Gemini returned an empty response.");
        }

        // Strip markdown fences and parse
        const jsonString = JsonHandler.extractAndRepair(rawText);
        const parsed = JSON.parse(jsonString);

        return ArchitectResponseSchema.parse(parsed);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.log(`   ⚠️ [Architect] attempt ${attempt}/${retries} failed: ${lastError}`);
      }
    }

    // Fallback: return a safe directive so the loop continues
    console.log(`   🏛️ [Architect] All ${retries} attempts failed. Using fallback directive.`);
    return {
      analysis: `Architect escalation failed after ${retries} attempts: ${lastError}`,
      steps_to_backtrack: 0,
      new_directive: "Try a different approach. Use omega for linear arithmetic or induction for structural proofs.",
    };
  }

  /**
   * Ask the ARCHITECT to decompose a mathematical goal into a ProofDAG.
   *
   * Emits a separate system prompt that instructs Gemini to return raw JSON
   * matching the ProofDAG schema. Validates via ProofDAGSchema.parse().
   *
   * The LLM temperature and meta-strategy prompt are dynamically scaled by
   * the consecutive macro-failure streak in the research journal:
   *   - Stage 1 (0–2 failures): T=0.2, direct combinatorial focus
   *   - Stage 2 (3–5 failures): T=0.70, "LOCAL MINIMUM DETECTED"
   *   - Stage 3 (≥6 failures):  T=0.95, "TRIGGER CONCEPTUAL SCATTER" (The Wiles Maneuver)
   *
   * Zod validation (ProofDAGSchema.parse) is applied on every attempt regardless
   * of temperature — high-T responses are more likely to produce malformed JSON,
   * which is caught by the existing try/catch/retry loop.
   *
   * @param context         - Journal / digest context (past attempts)
   * @param goal            - Mathematical goal, e.g. "R(4,6) >= 36"
   * @param availableSkills - List of available SKILL names for "skill_apply" nodes
   * @param journalEntries  - Raw entries (for tabu hash extraction)
   * @param journal         - ResearchJournal for failure streak detection (optional;
   *                          defaults to 0 failures when not provided)
   */
  async formulateDAG(
    context: string,
    goal: string,
    availableSkills: string[] = [],
    journalEntries: JournalEntry[] = [],
    journal?: ResearchJournal,
    forceWilesMode: boolean = false,
  ): Promise<ProofDAG> {
    const url = `${this.baseUrl}/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    // ── Failure streak → escalation tier ────────────────────────────────
    const consecutiveFailures = journal
      ? await journal.getConsecutiveMacroFailures()
      : 0;
    let { temperature: llmTemperature, metaStrategyPrompt } =
      computeEscalation(consecutiveFailures);

    // ── Wiles Mode override ──────────────────────────────────────────────
    // --wiles flag (or forceWilesMode=true) bypasses the progressive ladder
    // entirely and immediately forces Stage 3 (Orthogonal Paradigm Forcing).
    if (forceWilesMode) {
      llmTemperature = 0.95;
      metaStrategyPrompt = WILES_OPF_PROMPT;
    }
    // ───────────────────────────────────────────────────────────────────

    // Emit escalation tier to console for telemetry
    if (forceWilesMode) {
      console.log(
        `   🧮 [Architect] WILES MODE OVERRIDE — T=0.95, domain translation enforced`,
      );
    } else if (consecutiveFailures >= 6) {
      console.log(
        `   🔀 [Architect] STAGE 3 — Conceptual Scatter (Wiles Maneuver). Failures: ${consecutiveFailures}, T=${llmTemperature}`,
      );
    } else if (consecutiveFailures >= 3) {
      console.log(
        `   🌡️ [Architect] STAGE 2 — Analogy Reheat. Failures: ${consecutiveFailures}, T=${llmTemperature}`,
      );
    }
    // ────────────────────────────────────────────────────────────────────

    const skillList =
      availableSkills.length > 0
        ? `Available SKILLs (use "skill_apply" nodes for these): ${availableSkills.join(", ")}`
        : "No SKILLs available yet.";

    // Build the tabu hash block — only non-empty when failure_mode entries carry hashes
    const tabuBlock = buildTabuHashBlock(journalEntries);
    const tabuSection = tabuBlock
      ? `\n\n${tabuBlock}\n`
      : "";

    const dagSystemPrompt =
      // ── Meta-strategy injection (top of prompt for maximum weight) ──
      `${metaStrategyPrompt}\n\n` +
      `---\n\n` +
      `You are a senior proof architect. Decompose the mathematical goal into a minimal directed acyclic graph (DAG) of proof sub-tasks.\n\n` +
      `Goal: ${goal}\n\n` +
      `${skillList}\n\n` +
      `Research journal (past attempts):\n${context}\n` +
      tabuSection +
      `\nEmit ONLY valid JSON (no markdown, no prose) matching this exact schema:\n\n` +
      `{\n` +
      `  "id": "<uuid>",\n` +
      `  "goal": "${goal}",\n` +
      `  "nodes": [\n` +
      `    {\n` +
      `      "id": "unique_snake_case_id",\n` +
      `      "kind": "search" | "z3" | "lean" | "literature" | "skill_apply" | "aggregate" | "mathlib_query" | "algebraic_graph_construction" | "algebraic_partition_construction",\n` +
      `      "label": "human readable description",\n` +
      `      "dependsOn": ["list", "of", "node", "ids"],\n` +
      `      "config": {\n` +
      `        // For search nodes: { vertices, r, s, iterations, workers, tabuHashes?: string[] }\n` +
      `        // For algebraic_graph_construction nodes: { vertices, r, s, description,\n` +
      `        //   "edge_rule_js": "return (i - j) % 2 === 0;" <-- VM-sandboxed (i,j) => boolean. Use double quotes, NEVER backticks.\n` +
      `        // }\n` +
      `        // For literature/mathlib_query nodes: { query: string, k?: number }\n` +
      `        // For skill_apply nodes: { skillPath: string }\n` +
      `      },\n` +
      `      "status": "pending"\n` +
      `    }\n` +
      `  ],\n` +
      `  "createdAt": "<ISO 8601 timestamp>"\n` +
      `}\n\n` +
      `Ordering rules:\n` +
      `1. Start with a "literature" node (no deps) to retrieve relevant papers.\n` +
      `2. Z3 circulant fast-path is a "z3" node with mode "circulant_fast_path" (no deps).\n` +
      `3. SA search nodes depend on the "literature" node (context injection).\n` +
      `4. LNS finisher ("z3" with mode "lns_finisher") depends on the SA node.\n` +
      `5. Lean verification depends on the LNS finisher.\n` +
      `6. Use "aggregate" nodes to merge multiple parallel SA workers.\n` +
      `7. Keep the DAG minimal — omit nodes that are not needed.\n` +
      `8. Every dependsOn reference must point to a real node id in the same DAG.\n` +
      `9. If KNOWN STERILE BASINS are listed above, you MUST include those exact hash strings\n` +
      `   in the tabuHashes array of your search node config. Use the 'distributed_tabu_search' skill.`;

    const payload = {
      contents: [{ parts: [{ text: dagSystemPrompt }] }],
      generationConfig: { temperature: llmTemperature, maxOutputTokens: 4096 },
    };

    let lastError = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(120000),
        });
        if (!response.ok) {
          throw new Error(`Gemini HTTP ${response.status}: ${await response.text()}`);
        }
        const body = (await response.json()) as GeminiApiResponse;
        const rawText = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        
        try {
          fs.appendFileSync("/tmp/perqed_llm_debug.jsonl", JSON.stringify({ timestamp: new Date().toISOString(), model: this.config.model, prompt: dagSystemPrompt, response: rawText }) + "\n");
        } catch (e) {}

        if (!rawText) throw new Error("Empty Gemini response");

        const jsonString = JsonHandler.extractAndRepair(rawText);
        const parsed = JSON.parse(jsonString);
        // Zod validates on every attempt, including temperature=0.95 (The Wiles Maneuver)
        return ProofDAGSchema.parse(parsed);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`   ⚠️ [Architect.formulateDAG] attempt ${attempt}/3: ${lastError}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }

    throw new Error(`formulateDAG failed after 3 attempts: ${lastError}`);
  }

  /**
   * Directly formulates an AlgebraicConstructionConfig, bypassing the entire
   * ProofDAG schema wrapper. Used exclusively in Wiles Mode.
   */
  async formulateAlgebraicRule(
    goal: string,
    journalText: string,
    cognitiveMode: "EXPLORATION" | "EXPLOITATION" = "EXPLORATION",
    stuckAdj?: AdjacencyMatrix,
    runName?: string,
  ): Promise<any> {
    const url = `${this.baseUrl}/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    const exploitationPrompt = cognitiveMode === "EXPLOITATION"
      ? "\n\nSYSTEM STATE: EXPLOITATION MODE. You are sitting on a massive mathematical breakthrough (E < 300). DO NOT invent a new paradigm. Retrieve the construction rule (edge_rule_js for graphs, partition_rule_js for partitions) of your absolute best attempt from the Empirical Findings. Perform an ATOMIC MUTATION on that exact rule (e.g., swap one integer in the connection set, shift the period by ±1). Keep the domain size constant."
      : "";

    const directSystemPrompt = [
      WILES_OPF_PROMPT_DIRECT + exploitationPrompt,
      "---",
      "CURRENT GOAL:",
      goal,
      "---",
      "CRITICAL: Review the 'Empirical Findings' in your context. DO NOT propose any symmetry or rule that generated an Energy > 0 in past attempts. DO NOT propose symmetries that generated too many degrees of freedom.",
      journalText,
    ].join("\n\n");

    // ── Phase 4: Chalkboard Vision attachment ───────────────────────────────
    // When the system is stuck (EXPLOITATION) and an adj matrix is provided,
    // render it to SVG and attach it as a Gemini Vision inlineData part.
    let chalkboardPart: { inlineData: { mimeType: string; data: string } } | null = null;
    if (stuckAdj && runName) {
      try {
        const svgPath = `agent_workspace/runs/${runName}/scratch/stuck_state.svg`;
        await renderToSVG(stuckAdj, svgPath);
        const base64 = await svgToBase64(svgPath);
        chalkboardPart = { inlineData: { mimeType: "image/svg+xml", data: base64 } };
        console.log(`   🖼️  [Chalkboard] SVG rendered → ${svgPath}`);
      } catch (err) {
        console.warn(`   ⚠️  [Chalkboard] SVG render failed (non-fatal): ${err}`);
      }
    }

    const chalkboardPromptAddendum = chalkboardPart
      ? `\n\nCHALKBOARD: An SVG image of the current stuck state has been attached. ` +
        `Visually analyze the symmetry breaks, clusters, and bottlenecks. ` +
        `Propose a new construction rule (edge_rule_js for graphs, partition_rule_js for partitions) ` +
        `that algebraically bypasses this structural trap.`
      : "";

    const payload = {
      system_instruction: {
        parts: [{ text: directSystemPrompt + chalkboardPromptAddendum }],
      },
      contents: [{
        parts: [
          { text: "Emit the AlgebraicConstructionConfig JSON object now." },
          ...(chalkboardPart ? [chalkboardPart] : []),
        ],
      }],
      generationConfig: {
        temperature: 0.95,
        response_mime_type: "application/json",
      },
    };

    let lastError = "";

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(120000),
        });
        if (!response.ok) {
          throw new Error(`Gemini HTTP ${response.status}: ${await response.text()}`);
        }
        const body = (await response.json()) as GeminiApiResponse;
        const rawText = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

        try {
          fs.appendFileSync("/tmp/perqed_llm_debug.jsonl", JSON.stringify({ timestamp: new Date().toISOString(), model: this.config.model, prompt: "Wiles Direct Formulation", response: rawText }) + "\n");
        } catch (e) {}

        if (!rawText) throw new Error("Empty Gemini response");

        const jsonString = JsonHandler.extractAndRepair(rawText);
        const parsed = JSON.parse(jsonString);

        return parsed; // We will parse it in CLI using AlgebraicConstructionConfigSchema
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`   ⚠️ [Architect.formulateAlgebraicRule] attempt ${attempt}/3: ${lastError}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }

    throw new Error(`formulateAlgebraicRule failed after 3 attempts: ${lastError}`);
  }

  /**
   * Used in Wiles Mode Mid-Sprint Replanning.
   * Prompts the ARCHITECT to either attempt a new algebraic_graph_construction 
   * OR emit investigation nodes to build intuition.
   */
  async replanDAG(
    currentDag: ProofDAG,
    journalText: string,
    cognitiveMode: "EXPLOITATION" | "EXPLORATION" = "EXPLORATION",
    availableSkills: string[] = []
  ): Promise<ProofDAG> {
    const url = `${this.baseUrl}/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    const explorationConstraints = `SYSTEM STATE: EXPLORATION MODE.
You are currently exploring barren space or stuck on a plateau. 
DIRECTIVE: Use your \`query_literature\` skill to research new combinatorial bounds, or formulate a completely novel algebraic paradigm. Do not make small tweaks to failed rules.`;

    const exploitationConstraints = `SYSTEM STATE: EXPLOITATION MODE. 
You have discovered a deep mathematical basin. Your best attempt is currently in the top 1% of all evaluated spaces. 
CRITICAL DIRECTIVE: DO NOT change your structural paradigm. DO NOT change the number of vertices. Retrieve the \`edge_rule_js\` of your absolute best attempt from the Empirical Findings. You must perform an ATOMIC MUTATION on this exact rule. Change, add, or remove exactly ONE numeric constant, array element, or arithmetic operator. Keep the exact same mathematical symmetry.`;

    const systemicDirectives = cognitiveMode === "EXPLOITATION" ? exploitationConstraints : explorationConstraints;

    const promptText = `OVERRIDE: MID-SPRINT INVESTIGATION

Your previous attempt failed.
CURRENT GOAL: ${currentDag.goal}

${systemicDirectives}
CURRENT GOAL: ${currentDag.goal}

CRITICAL: Review the 'Empirical Findings' in your context. DO NOT propose any symmetry or rule that generated an Energy > 0 in past attempts. DO NOT propose symmetries that generated too many degrees of freedom.

${journalText}

You can either attempt a new mathematical construction, OR you can use an investigation skill to build intuition before your next attempt.
If you are shifting to a new mathematical strategy (e.g., from Product Rings to Circulant Graphs), use the \`query_literature\` skill to fetch specific theorems about your new strategy before writing the algebraic rule.

SUPPORTED INVESTIGATION SKILLS (for 'kind' property):
1. \`calculate_degrees_of_freedom\`: config requires \`edge_rule_js\` (string) and \`vertices\` (number). Tests the parameter dimension of a rule to see how many independent variables it creates.
2. \`query_known_graphs\`: config requires \`r\` (number) and \`s\` (number). Returns historical bounds.
3. \`query_literature\`: config requires \`search_term\` (string). RAG fetch of actual structural math papers.

Or you can immediately attempt another construction node.

SUPPORTED CONSTRUCTION KINDS:
- \`algebraic_graph_construction\` — for graph problems (Ramsey, SRG, torus). Config: { vertices, r, s, description, edge_rule_js }
  edge_rule_js: function body taking (i, j), returns boolean (true = edge present).
  Example: { "kind": "algebraic_graph_construction", "config": { "vertices": 35, "r": 4, "s": 6, "description": "Cayley graph on Z_35.", "edge_rule_js": "return (i - j + 35) % 35 < 10;" } }

- \`algebraic_partition_construction\` — for INTEGER PARTITION problems (Schur, Van der Waerden, sum-free). Config: { domain_size, num_partitions, description, partition_rule_js }
  partition_rule_js: function body taking (i) where i is 1-indexed integer, returns bucket [0, num_partitions) or -1.
  CRITICAL: MUST include explicit \`return\` statement — bare expressions return undefined and score E=domain_size.
  EXAMPLE FOR S(6): { "kind": "algebraic_partition_construction", "config": { "domain_size": 537, "num_partitions": 6, "description": "Periodic mod-6 warm start.", "partition_rule_js": "return (i - 1) % 6;" } }

- \`partition_sa_search\` — SA optimizer for sum-free partitions. Use after algebraic attempts fail. Config: { domain_size, num_partitions, sa_iterations, warm_start_from_node?, description }
  warm_start_from_node: id of a prior algebraic_partition_construction node whose partition seeds the SA.
  EXAMPLE: { "kind": "partition_sa_search", "config": { "domain_size": 537, "num_partitions": 6, "sa_iterations": 5000000, "warm_start_from_node": "init_alg", "description": "SA from algebraic warm start" } }
  ${availableSkills.length > 0 ? `\nAVAILABLE SKILLS (emit skill_apply nodes to read and apply these): ${availableSkills.join(", ")}` : ""}

CRITICAL FORMAT RULES (both construction kinds):
1. Body-Only Rule: Output ONLY the raw function body. No arrow functions, no function declarations.
   GRAPH valid: "return (i + j) % 5 === 0;"   PARTITION valid: "return (i - 1) % 6;"
2. Description: CRITICAL: MUST NOT exceed 2 sentences to prevent timeouts.

MANDATORY OUTPUT FORMAT:
You MUST output a JSON object with a top-level "diagnostic" field BEFORE the node list.
The "diagnostic" must trace the mathematical root cause of the previous failure rigorously
(minimum 20 characters). Shallow or missing diagnostics will cause a retry.

Output ONLY a JSON object matching this schema:
{
  "diagnostic": "<string: rigorous mathematical root-cause analysis of the previous failure. Min 20 chars. Example: 'The Paley graph over GF(37) fails because its automorphism group acts transitively, creating K_4 sub-cliques in every neighbourhood.'>",
  "id": "replan_xyz",
  "goal": "${currentDag.goal.replace(/"/g, '\\"')}",
  "nodes": [
    {
      "id": "<string>",
      "kind": "calculate_degrees_of_freedom" | "query_known_graphs" | "query_literature" | "algebraic_graph_construction" | "algebraic_partition_construction",
      "config": { ... }
    }
  ]
}

DO NOT wrap your JSON in markdown.`;



    const payload = {
      system_instruction: { parts: [{ text: promptText }] },
      contents: [{ parts: [{ text: "Emit the partial JSON object containing new nodes now." }] }],
      generationConfig: { temperature: 0.7, response_mime_type: "application/json" },
    };

    let lastError = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(120000),
        });
        
        if (!response.ok) {
          throw new Error(`Gemini HTTP ${response.status}: ${await response.text()}`);
        }
        
        const body = (await response.json()) as GeminiApiResponse;
        const rawText = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        
        try {
          fs.appendFileSync("/tmp/perqed_llm_debug.jsonl", JSON.stringify({ timestamp: new Date().toISOString(), model: this.config.model, prompt: "replanDAG", response: rawText }) + "\n");
        } catch (e) {}

        if (!rawText) throw new Error("Empty Gemini response");
        
        const jsonString = JsonHandler.extractAndRepair(rawText);
        const parsed = JSON.parse(jsonString);

        // P0 — Diagnostic Guard: enforce substantive self-critique before schema parsing.
        // Mathematical invariant: an ARCHITECT that cannot explain why an attempt failed
        // cannot propose a better one. Trivial or missing diagnostics force a retry.
        if (!parsed.diagnostic || parsed.diagnostic.trim().length < 20) {
          throw new Error(
            "Architect failed to provide a rigorous mathematical diagnostic. Retrying."
          );
        }
        console.log(`   🧠 [Architect.replanDAG] Diagnostic: ${parsed.diagnostic.slice(0, 120)}...`);

        return ProofDAGSchema.parse(parsed);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`   ⚠️ [Architect.replanDAG] attempt ${attempt}/3: ${lastError}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    
    throw new Error(`replanDAG failed after 3 attempts: ${lastError}`);
  }

}


// ──────────────────────────────────────────────
// Gemini REST API types (minimal)
// ──────────────────────────────────────────────

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}
