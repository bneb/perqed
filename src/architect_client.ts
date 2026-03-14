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
  async escalate(context: string): Promise<ArchitectResponse> {
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
