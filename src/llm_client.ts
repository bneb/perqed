/**
 * LocalAgent — LLM client with Zod validation and auto-correction.
 *
 * Bridges the gap between the file-system state (WorkspaceManager) and the
 * formal solver (SolverBridge) by communicating with a local inference server
 * (Ollama / vLLM) via standard REST API calls using Bun's native fetch.
 *
 * Key resilience feature: an auto-correction loop that catches malformed
 * LLM output (broken JSON, markdown wrappers, schema violations) and
 * feeds the exact error back to the model for self-correction.
 */

import { z } from "zod";
import { AgentResponseSchema, type AgentResponse } from "./schemas";

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

export interface LocalAgentConfig {
  /** Full URL to the inference server endpoint (e.g., http://localhost:11434/api/chat). */
  endpoint: string;
  /** Model name as registered in the inference server. */
  model: string;
  /** Sampling temperature (0.0–1.0). Lower = more deterministic. */
  temperature: number;
}

// ──────────────────────────────────────────────
// JSON Extraction
// ──────────────────────────────────────────────

/**
 * Strip markdown fences and extract raw JSON from LLM output.
 *
 * LLMs commonly wrap JSON in:
 *   ```json\n{...}\n```
 *   ```\n{...}\n```
 *   or just return raw JSON
 *
 * This function handles all three patterns.
 */
function extractJSON(raw: string): string {
  let cleaned = raw.trim();

  // Strip ```json ... ``` or ``` ... ``` fences
  const fencePattern = /^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const match = cleaned.match(fencePattern);
  if (match?.[1]) {
    cleaned = match[1].trim();
  }

  return cleaned;
}

/**
 * Build the schema description string that gets injected into the prompt,
 * telling the LLM exactly what JSON shape is expected.
 */
function buildSchemaInstruction(): string {
  return [
    "You must respond with ONLY valid JSON (no markdown, no prose) matching this exact schema:",
    "",
    "{",
    '  "thoughts": "<string: your mathematical reasoning>",',
    '  "action": "PROPOSE_TACTIC" | "GIVE_UP" | "SOLVED",',
    '  "code": "<string: Z3 Python code, required when action is PROPOSE_TACTIC>"',
    "}",
    "",
    "Do NOT wrap your response in ```json``` or any markdown. Return raw JSON only.",
  ].join("\n");
}

// ──────────────────────────────────────────────
// LocalAgent
// ──────────────────────────────────────────────

export class LocalAgent {
  private readonly config: LocalAgentConfig;

  constructor(config: LocalAgentConfig) {
    this.config = config;
  }

  /**
   * Send context to the local LLM and parse the response with Zod.
   *
   * @throws {z.ZodError} if the response doesn't match AgentResponseSchema.
   * @throws {SyntaxError} if the response is not valid JSON.
   */
  async generateMove(context: string): Promise<AgentResponse> {
    const systemPrompt = buildSchemaInstruction();

    const payload = {
      model: this.config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: context },
      ],
      stream: false,
      options: {
        temperature: this.config.temperature,
      },
    };

    const response = await fetch(this.config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `LLM server returned HTTP ${response.status}: ${await response.text()}`,
      );
    }

    const responseBody = await response.json() as {
      message?: { content?: string };
    };

    const rawContent = responseBody?.message?.content ?? "";

    // Extract and parse JSON
    const jsonString = extractJSON(rawContent);
    const parsed = JSON.parse(jsonString);

    // Validate with Zod — throws ZodError on schema violation
    return AgentResponseSchema.parse(parsed);
  }

  /**
   * Auto-correction wrapper around `generateMove`.
   *
   * When the LLM returns malformed JSON or fails Zod validation,
   * the exact error message is appended to the context and the model
   * is asked to self-correct. This loop repeats up to `maxRetries` times.
   *
   * @throws Error with message matching /after N retries/ when all retries are exhausted.
   */
  async generateMoveWithRetry(
    context: string,
    maxRetries: number = 3,
  ): Promise<AgentResponse> {
    let lastError: string = "";
    let enrichedContext = context;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.generateMove(enrichedContext);
      } catch (err) {
        lastError = formatError(err);

        if (attempt < maxRetries) {
          // Append error feedback to context for self-correction
          enrichedContext = [
            context,
            "",
            "---",
            "⚠️ YOUR PREVIOUS RESPONSE FAILED VALIDATION",
            `Error: ${lastError}`,
            "",
            "Please correct your formatting and respond with valid JSON only.",
            "Do NOT include markdown fences, prose, or any text outside the JSON object.",
          ].join("\n");
        }
      }
    }

    throw new Error(
      `LLM failed to produce valid output after ${maxRetries} retries. Last error: ${lastError}`,
    );
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Format any error into a descriptive string for LLM feedback.
 */
function formatError(err: unknown): string {
  if (err instanceof z.ZodError) {
    return (
      "Zod validation failed:\n" +
      err.issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n")
    );
  }
  if (err instanceof SyntaxError) {
    return `JSON parse error: ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
