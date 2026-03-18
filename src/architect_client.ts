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
import { ArchitectResponseSchema, type ArchitectResponse } from "./schemas";
import { ProofDAGSchema, type ProofDAG } from "./proof_dag/schemas";
import { buildTabuHashBlock, type JournalEntry } from "./search/research_journal";

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

function extractJSON(raw: string): string {
  let cleaned = raw.trim();
  const fencePattern = /^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const match = cleaned.match(fencePattern);
  if (match?.[1]) {
    cleaned = match[1].trim();
  }
  return cleaned;
}

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
        });

        if (!response.ok) {
          throw new Error(
            `Gemini API returned HTTP ${response.status}: ${await response.text()}`,
          );
        }

        const body = (await response.json()) as GeminiApiResponse;

        const rawText = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (!rawText) {
          throw new Error("Gemini returned an empty response.");
        }

        // Strip markdown fences and parse
        const jsonString = extractJSON(rawText);
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
   * @param context         - Journal / digest context (past attempts)
   * @param goal            - Mathematical goal, e.g. "R(4,6) >= 36"
   * @param availableSkills - List of available SKILL names for "skill_apply" nodes
   * @throws on malformed response or schema validation failure (caller falls back)
   */
  async formulateDAG(
    context: string,
    goal: string,
    availableSkills: string[] = [],
    journalEntries: JournalEntry[] = [],
  ): Promise<ProofDAG> {
    const url = `${this.baseUrl}/${this.config.model}:generateContent?key=${this.config.apiKey}`;

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
      `      "kind": "search" | "z3" | "lean" | "literature" | "skill_apply" | "aggregate" | "mathlib_query",\n` +
      `      "label": "human readable description",\n` +
      `      "dependsOn": ["list", "of", "node", "ids"],\n` +
      `      "config": {\n` +
      `        // For search nodes: { vertices, r, s, iterations, workers,\n` +
      `        //   tabuHashes?: string[]  <-- MUST be decimal strings, e.g. ["14819238491823"],\n` +
      `        //   tabuPenaltyTemperature?: number }\n` +
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
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
    };

    let lastError = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(`Gemini HTTP ${response.status}: ${await response.text()}`);
        }
        const body = (await response.json()) as GeminiApiResponse;
        const rawText = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (!rawText) throw new Error("Empty Gemini response");

        const jsonString = extractJSON(rawText);
        const parsed = JSON.parse(jsonString);
        return ProofDAGSchema.parse(parsed);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`   ⚠️ [Architect.formulateDAG] attempt ${attempt}/3: ${lastError}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }

    throw new Error(`formulateDAG failed after 3 attempts: ${lastError}`);
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
