/**
 * FormalistAgent — Ollama-facing LLM client for Lean 4 tactic generation.
 *
 * Handles DeepSeek-R1's <think>...</think> reasoning phase:
 *   1. Sends context to Ollama via /api/chat
 *   2. Strips <think> tags from raw output
 *   3. Strips markdown fences
 *   4. Validates JSON against FormalistResponseSchema
 *   5. Auto-correction retry loop on parse failures
 *
 * The thinking content is captured separately for lab_log telemetry.
 */

import { z } from "zod";
import { FormalistResponseSchema, type FormalistResponse } from "../schemas";

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

export interface FormalistConfig {
  /** Ollama API endpoint base. Default: http://localhost:11434 */
  endpoint: string;
  /** Model name. Default: deepseek-prover-v2:7b-q8 */
  model: string;
  /** Sampling temperature (0.0–1.0). */
  temperature: number;
  /** System prompt content. */
  systemPrompt: string;
  /** API mode: 'chat' for /api/chat (R1), 'completion' for /api/generate (prover). */
  mode: "chat" | "completion";
  /** Max tokens to generate. */
  numPredict: number;
  /** Ollama context window size. Default: undefined (Ollama default 4096). */
  numCtx?: number;
}

const DEFAULT_CONFIG: FormalistConfig = {
  endpoint: "http://localhost:11434",
  model: "deepseek-prover-v2:7b-q8",
  temperature: 0.6,
  systemPrompt: "",
  mode: "chat",
  numPredict: 4096,
};

// ──────────────────────────────────────────────
// Think-Tag Extraction
// ──────────────────────────────────────────────

/**
 * Extract the content inside <think>...</think> tags.
 * Returns empty string if no think block is found.
 */
function extractThinkContent(raw: string): string {
  const match = raw.match(/<think>([\s\S]*?)<\/think>/);
  return match?.[1]?.trim() ?? "";
}

/**
 * Strip <think>...</think> blocks and markdown fences from LLM output.
 * If the result is not JSON, auto-wrap bare tactics into FormalistResponse JSON.
 * Returns clean JSON string ready for parsing.
 */
function sanitizeR1Output(raw: string): string {
  // 1. Strip all <think>...</think> blocks (handles multi-line content)
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  // 2. Strip ```json ... ``` or ``` ... ``` or ```lean ... ``` markdown fences
  const fencePattern = /^```(?:json|lean)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const fenceMatch = cleaned.match(fencePattern);
  if (fenceMatch?.[1]) {
    cleaned = fenceMatch[1].trim();
  }

  // 3. If it doesn't look like JSON, treat it as bare Lean tactic(s)
  if (cleaned && !cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    // Split on newlines for multi-tactic output
    const tactics = cleaned
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("--") && !l.startsWith("#"));

    if (tactics.length > 0) {
      const wrapped = {
        thoughts: "Auto-wrapped bare tactic output",
        action: "PROPOSE_LEAN_TACTICS",
        lean_tactics: tactics.slice(0, 5).map((t, i) => ({
          tactic: t,
          informal_sketch: "auto-wrapped",
          confidence_score: Math.round((0.8 - i * 0.1) * 100) / 100,
        })),
      };
      cleaned = JSON.stringify(wrapped);
    }
  }

  return cleaned;
}

// ──────────────────────────────────────────────
// FormalistAgent
// ──────────────────────────────────────────────

export class FormalistAgent {
  private readonly config: FormalistConfig;

  /** Last captured thinking content (for telemetry). */
  public lastThinking: string = "";

  constructor(config: Partial<FormalistConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Extract thinking content from R1 output (public for telemetry).
   */
  extractThinking(raw: string): string {
    return extractThinkContent(raw);
  }

  /**
   * Send context to Ollama and parse the response with Zod.
   * Handles DeepSeek-R1's <think> tags transparently.
   *
   * @param context - The context window string (built by WorkspaceManager)
   * @param retries - Max number of auto-correction retries
   * @throws Error with message matching /after N attempts/ when all retries exhausted
   */
  async generateMove(
    context: string,
    retries: number = 3,
  ): Promise<FormalistResponse> {
    let enrichedContext = context;
    let lastError: string = "";

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const rawContent = await this.callOllama(enrichedContext);

        // Capture thinking for telemetry
        this.lastThinking = extractThinkContent(rawContent);

        // Sanitize: strip <think> tags and markdown fences, auto-wrap bare tactics
        const cleanJson = sanitizeR1Output(rawContent);

        // Guard: empty response (model returned only <think> tags or whitespace)
        if (!cleanJson || cleanJson.trim() === "") {
          throw new Error("Empty tactic generated — model produced no usable output");
        }

        // Parse JSON and validate against Zod schema
        const parsed = JSON.parse(cleanJson);
        return FormalistResponseSchema.parse(parsed);
      } catch (err) {
        lastError = formatError(err);

        if (attempt < retries) {
          // Inject error feedback for auto-correction
          enrichedContext = [
            context,
            "",
            "[SYSTEM ERROR]: Your previous output failed JSON/Zod validation.",
            `Error: ${lastError}`,
            "",
            "Ensure your final output after the <think> block is strictly valid JSON",
            "matching the schema. No conversational text outside the JSON object.",
          ].join("\n");
        }
      }
    }

    throw new Error(
      `LLM failed to produce valid output after ${retries} attempts. Last error: ${lastError}`,
    );
  }

  /**
   * Route to the appropriate Ollama API based on mode.
   */
  private async callOllama(context: string): Promise<string> {
    if (this.config.mode === "completion") {
      return this.callCompletion(context);
    }
    return this.callChat(context);
  }

  /**
   * Chat mode: /api/chat with system prompt (for R1 reasoning models).
   * Handles Ollama 0.18.0+ separate thinking field.
   */
  private async callChat(context: string): Promise<string> {
    const payload = {
      model: this.config.model,
      messages: [
        ...(this.config.systemPrompt
          ? [{ role: "system", content: this.config.systemPrompt }]
          : []),
        { role: "user", content: context },
      ],
      stream: false,
      keep_alive: "10m",
      options: {
        temperature: this.config.temperature,
        num_predict: this.config.numPredict,
        ...(this.config.numCtx ? { num_ctx: this.config.numCtx } : {}),
      },
    };

    const response = await fetch(`${this.config.endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama returned HTTP ${response.status}: ${await response.text()}`,
      );
    }

    const body = (await response.json()) as {
      message?: { content?: string; thinking?: string };
    };

    // Ollama 0.18.0+ puts R1 reasoning in a separate `thinking` field
    const thinking = body?.message?.thinking ?? "";
    const content = body?.message?.content ?? "";

    // Debug telemetry
    console.log(`   🔍 [FormalistAgent] thinking: ${thinking.length} chars, content: ${content.length} chars`);
    if (content) {
      console.log(`   🔍 [FormalistAgent] content preview: ${content.slice(0, 200)}`);
    } else {
      console.log(`   🔍 [FormalistAgent] content is EMPTY — all tokens went to thinking`);
      if (thinking) {
        console.log(`   🔍 [FormalistAgent] thinking preview: ${thinking.slice(0, 200)}`);
      }
    }

    if (thinking) {
      this.lastThinking = thinking;
    }

    if (content) {
      return content;
    }

    // Fallback: check if thinking contains an actual JSON object (model confusion —
    // sometimes R1 puts the JSON response inside the thinking block)
    if (thinking) {
      // Look for a JSON object in the thinking text
      const jsonMatch = thinking.match(/(\{[\s\S]*"action"[\s\S]*\})/);
      if (jsonMatch?.[1]) {
        try {
          JSON.parse(jsonMatch[1]); // Validate it's real JSON
          return jsonMatch[1];
        } catch {
          // Not valid JSON, fall through
        }
      }
    }

    // Content is truly empty — throw to trigger retry loop
    throw new Error("Empty content — model produced only thinking, no usable output");
  }

  /**
   * Completion mode: /api/generate for prover models.
   * Sends raw Lean 4 context — no markdown fences, strict stop sequences.
   */
  private async callCompletion(context: string): Promise<string> {
    const payload = {
      model: this.config.model,
      prompt: context,
      stream: false,
      options: {
        temperature: this.config.temperature,
        num_predict: this.config.numPredict,
        stop: [
          "\n\n",       // Stop at paragraph break
          "/-",         // Stop at Lean comment open
          "```",        // Stop at markdown fence
          "</pre>",     // Stop at HTML hallucination
          "⊢",          // Stop at goal state marker
          "|-",         // Stop at ASCII goal marker
          "\ntheorem",  // Stop if it starts a new theorem
          "\nexample",  // Stop if it starts an example
        ],
      },
    };

    const response = await fetch(`${this.config.endpoint}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama returned HTTP ${response.status}: ${await response.text()}`,
      );
    }

    const body = (await response.json()) as { response?: string };
    let content = body?.response?.trim() ?? "";

    // Sanitize: strip any remaining markdown fences or HTML artifacts
    content = content
      .replace(/^```(?:lean4?)?\n?/, "")
      .replace(/```$/, "")
      .replace(/<[^>]+>/g, "")    // Strip any HTML tags
      .replace(/^<[;,]>/, "")     // Strip garbled prefix artifacts
      .trim();

    console.log(`   🔍 [FormalistAgent:completion] response: ${content.length} chars`);
    console.log(`   🔍 [FormalistAgent:completion] preview: ${content.slice(0, 200)}`);

    return content;
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

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
