/**
 * compiler.ts — CompilerAgent: LLM-driven C++ energy function synthesiser.
 *
 * Given a description of a combinatorial constraint, CompilerAgent asks Gemini
 * to emit raw C++ that implements an `calculate_energy(matrix, size)` function.
 *
 * A hardcoded fallback stub is returned when Gemini is unavailable or the
 * API key is missing — this keeps unit tests hermetic and the pipeline functional
 * even during cold-start without network access.
 */
import { STUB_CPP_RAMSEY } from "../search/dynamic_evaluator";

export interface CompilerAgentConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface CompilationRequest {
  /** Short description of the mathematical constraint, e.g. "R(4,6) Ramsey energy" */
  constraint: string;
  /** Number of vertices (matrix dimension) */
  n: number;
  /** Red clique size */
  r: number;
  /** Blue independent set size */
  s: number;
}

const COMPILER_SYSTEM_PROMPT = `You are an expert C++ performance engineer. Your task is to generate a fast, portable C++ energy function for a combinatorial graph problem.

Output ONLY raw C++ source code with no markdown fences. The function signature MUST be:
  extern "C" int32_t calculate_energy(const uint8_t* matrix, int32_t n);

where matrix is a flat n×n row-major adjacency matrix (0=no edge, 1=edge).
Return the total number of forbidden subgraphs (energy penalty). E=0 means a valid witness.
Use only standard C++ and <cstdint>. No AVX intrinsics unless explicitly requested.`;

export class CompilerAgent {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(config: CompilerAgentConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? "gemini-2.5-pro";
    this.baseUrl = config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  }

  /**
   * Generate a C++ energy evaluator for the given constraint.
   * Falls back to STUB_CPP_RAMSEY if Gemini is unreachable or the key is missing.
   */
  async generateEvaluator(req: CompilationRequest): Promise<string> {
    if (!this.apiKey || this.apiKey === "test") {
      return this._fallback(req);
    }
    try {
      return await this._callGemini(req);
    } catch (err) {
      console.warn(`[CompilerAgent] Gemini unavailable (${err}) — using fallback stub`);
      return this._fallback(req);
    }
  }

  private async _callGemini(req: CompilationRequest): Promise<string> {
    const userPrompt =
      `Generate a C++ calculate_energy function for the following constraint:\n` +
      `"${req.constraint}"\n` +
      `Parameters: n=${req.n} vertices, K_${req.r} red cliques forbidden, ` +
      `K_${req.s} blue independent sets forbidden.\n` +
      `Return only raw C++ source, no markdown.`;

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    const body = {
      system_instruction: { parts: [{ text: COMPILER_SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const json = (await res.json()) as any;
    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Strip any markdown fences the model might add despite instructions
    return text.replace(/^```(?:cpp|c\+\+)?\n?/m, "").replace(/```\s*$/m, "").trim();
  }

  /** Returns the hardcoded Ramsey fallback — correct for R(4,6) problems */
  private _fallback(_req: CompilationRequest): string {
    return STUB_CPP_RAMSEY;
  }
}
