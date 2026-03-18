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

const ARCHITECT_SYSTEM_PROMPT = `You are a senior mathematician and proof architect. A junior agent has been attempting to formalize mathematical proofs using Z3 and Lean 4 but has gotten stuck in an unproductive loop.

Your job is to:
1. DIAGNOSE why the recent attempts are mathematically failing.
2. DECIDE how many verified steps to undo (backtrack) to escape the dead end.
3. PROVIDE a clear, high-level directive for a new mathematical approach.

You must respond with ONLY valid JSON (no markdown, no prose) matching this exact schema:

{
  "analysis": "<string: why the recent attempts are failing>",
  "steps_to_backtrack": <integer: how many verified steps to delete, 0 if current state is fine>,
  "new_directive": "<string: high-level instruction for the next approach>"
}

Do NOT wrap your response in \`\`\`json\`\`\` or any markdown. Return raw JSON only.`;

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
  "To execute your Functorial Leap, you MUST emit a ProofDAG containing a node of kind `algebraic_graph_construction`.",
  "This node configures a high-performance VM sandbox that will compile and verify your mathematical pattern.",
  "Set the config with `vertices`, `r`, `s`, `description`, and a Javascript rule `edge_rule_js`.",
  "",
  "CRITICAL JS FORMAT RULES:",
  "1. The Variables Rule: Your edge_rule_js will be compiled into a function with the signature function(i, j). You MUST use i and j as your vertex indices. Do not use x, y, u, or v. Do not try to redefine the function signature.",
  "2. The Body-Only Rule: Do NOT write an arrow function (i, j) => {...} or a function declaration function is_adjacent(...). Output ONLY the raw logic body. VALID: \"return (i + j) % 5 === 0;\" INVALID: \"const rule = (i, j) => { return (i + j) % 5 === 0; }\"",
  "3. The Description Rule: Keep your \"description\" field to a MAXIMUM of 3 sentences. DO NOT write mathematical proofs. DO NOT write long explanations. State the core symmetry and stop. Your focus must be on the \"edge_rule_js\".",
  "4. CRITICAL JSON ESCAPE: Since you are emitting JSON, you MUST use double quotes for the edge_rule_js string. NEVER use backticks (`).",
  "",
  "CRITICAL: Keep the DAG as simple as possible. Output ONLY ONE node (`algebraic_graph_construction`). Do not include any other nodes."
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
  "  → Emit a JSON object with keys: \"vertices\" (number), \"description\" (string), \"edge_rule_js\" (string)",
  "  → The edge_rule_js is a function body taking (i, j) returning boolean (true = edge present).",
  "",
  "If the problem involves PARTITIONING A SET OF INTEGERS (e.g. Schur numbers, Van der Waerden, sum-free sets):",
  "  → Emit a JSON object with keys: \"domain_size\" (number), \"num_partitions\" (number), \"description\" (string), \"partition_rule_js\" (string)",
  "  → The partition_rule_js is a function body taking (i) where i is 1-indexed integer, returning a bucket index [0, num_partitions-1] or -1 (unassigned).",
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
      `      "kind": "search" | "z3" | "lean" | "literature" | "skill_apply" | "aggregate" | "mathlib_query" | "algebraic_graph_construction",\n` +
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
    cognitiveMode: "EXPLORATION" | "EXPLOITATION" = "EXPLORATION"
  ): Promise<any> {
    const url = `${this.baseUrl}/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    const exploitationPrompt = cognitiveMode === "EXPLOITATION"
      ? "\n\nSYSTEM STATE: EXPLOITATION MODE. You are sitting on a massive mathematical breakthrough (E < 300). DO NOT invent a new paradigm. Retrieve the `edge_rule_js` of your absolute best attempt from the Empirical Findings. Perform an ATOMIC MUTATION on that exact rule (e.g., swap one integer in the difference set). Keep the vertex size constant."
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

    const payload = {
      system_instruction: {
        parts: [{ text: directSystemPrompt }],
      },
      contents: [{ parts: [{ text: "Emit the AlgebraicConstructionConfig JSON object now." }] }],
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
    cognitiveMode: "EXPLOITATION" | "EXPLORATION" = "EXPLORATION"
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

Or you can immediately attempt another \`algebraic_graph_construction\` node.

CRITICAL JS FORMAT RULES (for algebraic_graph_construction):
1. The Variables Rule: Your edge_rule_js will be compiled into a function with the signature function(i, j). You MUST use i and j as your vertex indices. Do not use x, y, u, or v.
2. The Body-Only Rule: Do NOT write an arrow function (i, j) => {...} or a function declaration. Output ONLY the raw logic body. VALID: "return (i + j) % 5 === 0;"
3. The Description Rule: CRITICAL: To prevent system timeouts, your "description" field MUST NOT exceed 2 sentences. Explain your atomic mutation or new paradigm instantly and proceed to the code.

Output ONLY a JSON object matching this schema describing the NEW nodes to append:
{
  "id": "replan_xyz",
  "goal": "${currentDag.goal.replace(/"/g, '\\"')}",
  "nodes": [
    {
      "id": "<string>",
      "kind": "calculate_degrees_of_freedom" | "query_known_graphs" | "algebraic_graph_construction",
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
