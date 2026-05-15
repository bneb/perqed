/**
 * GeminiAgent — Cloud specialist using the @google/generative-ai SDK.
 *
 * Uses structured JSON output (responseMimeType + responseSchema) to
 * guarantee valid responses without post-hoc parsing.
 *
 * Three model tiers:
 *   Tier 1: gemini-2.5-flash              — Free / base reasoning
 *   Tier 2: gemini-3.1-flash-lite-preview — Paid flash fallback
 *   Tier 3: gemini-3.1-pro-preview        — Advanced reasoning
 */

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { AgentRole } from "../types";
import { repairJSON } from "../util/json_repair";

// ──────────────────────────────────────────────
// Model Tiers
// ──────────────────────────────────────────────

export type GeminiModelTier =
  | "gemini-2.5-flash"
  | "gemini-3.1-flash-lite-preview"
  | "gemini-3.1-flash"
  | "gemini-3.1-pro-preview";

// ──────────────────────────────────────────────
// Response Schemas (for structured output)
// ──────────────────────────────────────────────

import { ARCHITECT_SCHEMA, ARCHITECT_SYSTEM_PROMPT } from "./architect";



// ──────────────────────────────────────────────
// GeminiAgent
// ──────────────────────────────────────────────

export class GeminiAgent {
  public readonly role: AgentRole;
  public readonly modelTier: GeminiModelTier;
  private readonly model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;

  constructor(role: AgentRole, modelTier: GeminiModelTier, apiKey: string) {
    if (role === "PROVER") {
      throw new Error("GeminiAgent cannot be used for PROVER — use local FormalistAgent.");
    }

    this.role = role;
    this.modelTier = modelTier;

    const genAI = new GoogleGenerativeAI(apiKey);

    const systemInstruction = ARCHITECT_SYSTEM_PROMPT;
    const responseSchema = ARCHITECT_SCHEMA;

    this.model = genAI.getGenerativeModel({
      model: modelTier,
      systemInstruction,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: responseSchema as any,  // SDK types require optional `format` on enum; runtime accepts this fine
      },
    });
  }

  /**
   * Generate a move from the Gemini model.
   *
   * @param contextWindow - Full proof state context
   * @param retries - Number of retry attempts on failure (default: 3)
   * @returns Parsed JSON response matching the role's schema
   */
  async generateMove(contextWindow: string, retries: number = 3): Promise<any> {
    let lastError = "";
    const BASE_DELAY_MS = 1000;
    const MAX_DELAY_MS = 30_000;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.model.generateContent(contextWindow);
        const text = result.response.text();

        console.log(`   🌐 [GeminiAgent:${this.role}] ${this.modelTier} → ${text.length} chars`);
        console.log(`   🌐 [GeminiAgent:${this.role}] preview: ${text.slice(0, 200)}`);

        // Try clean parse first, then structural repair
        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = repairJSON(text);
          if (parsed) {
            console.log(`   🔧 [GeminiAgent:${this.role}] JSON repaired from truncated response`);
          } else {
            throw new Error(`JSON unparseable even after repair: ${text.slice(0, 100)}`);
          }
        }
        return parsed;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.log(`   ⚠️ [GeminiAgent:${this.role}] attempt ${attempt}/${retries} failed: ${lastError}`);

        if (attempt < retries) {
          // Exponential backoff with ±25% jitter
          const base = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_DELAY_MS);
          const jitter = base * 0.25 * (Math.random() * 2 - 1); // ±25%
          const delay = Math.round(base + jitter);
          console.log(`   ⏳ [GeminiAgent:${this.role}] backing off ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Return a safe fallback instead of crashing
    if (this.role === "ARCHITECT") {
      console.log(`   🏛️ [GeminiAgent:ARCHITECT] All ${retries} attempts failed. Using fallback.`);
      return {
        action: "DIRECTIVE",
        reasoning: `Gemini ${this.modelTier} failed after ${retries} attempts: ${lastError}`,
        sub_goals: ["Try omega for linear arithmetic", "Try induction for structural proofs"],
      };
    }


  }
}
