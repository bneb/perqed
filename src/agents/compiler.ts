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
import { getAgencyRegistry } from "../agency";

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
  /**
   * Output language for the generated evaluator.
   *
   * - "cpp" (default): standalone C++ source with `extern "C" int32_t calculate_energy(...)`
   * - "javascript": raw function body for `edge_rule_js` — takes (i, j: number) and returns boolean.
   *   Body only, no arrow syntax, no function keyword. Example: `return (i - j + N) % N < 10;`
   */
  targetLanguage?: "cpp" | "javascript";
}

const COMPILER_SYSTEM_PROMPT_CPP = `You are an expert C++ performance engineer. Your task is to generate a fast, portable C++ energy function for a combinatorial graph problem.

Output ONLY raw C++ source code with no markdown fences. The function signature MUST be:
  extern "C" int32_t calculate_energy(const uint8_t* matrix, int32_t n);

where matrix is a flat n×n row-major adjacency matrix (0=no edge, 1=edge).
Return the total number of forbidden subgraphs (energy penalty). E=0 means a valid witness.
Use only standard C++ and <cstdint>. No AVX intrinsics unless explicitly requested.`;

/**
 * System prompt for the JavaScript edge_rule_js generator.
 * Used by Phase 7 P2: dual-model formulation where the ARCHITECT outputs a
 * mathematical spec and CompilerAgent translates it to executable JS.
 */
const COMPILER_SYSTEM_PROMPT_JS = `You are an algebraic combinatorics programming specialist. \
Your task is to translate a mathematical graph construction description into a JavaScript function body.

Output ONLY the raw function body — no arrow syntax, no function keyword, no markdown fences.
The body takes two integer variables (i, j) already in scope, representing vertex indices 0..N-1.
Return true if there should be an edge between vertices i and j, false otherwise.

Requirements:
- Use only modulo arithmetic and bitwise logic. No Math.random().
- The function must be deterministic and side-effect-free.
- Use the variable N if you need the vertex count (it will be in scope at runtime).

Example output: return ((i - j + N) % N) < 10;`;

/**
 * Fallback edge_rule_js stub for JavaScript target.
 * Produces a circulant graph with a connection set of the first 10 residues.
 * This is a valid warm-start for R(4,6) searches on 35 vertices.
 */
export const STUB_JS_RAMSEY = `const d = ((i - j) % N + N) % N; return d > 0 && d <= Math.floor(N / 3.5);`;

export class CompilerAgent {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(config: CompilerAgentConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? getAgencyRegistry().resolveProvider("compilation").model;
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
    const isJs = req.targetLanguage === "javascript";
    const systemPrompt = isJs ? COMPILER_SYSTEM_PROMPT_JS : COMPILER_SYSTEM_PROMPT_CPP;

    const userPrompt = isJs
      ? `Translate this mathematical graph construction to a JavaScript edge_rule_js body:\n` +
        `"${req.constraint}"\n` +
        `Parameters: N=${req.n} vertices, targeting R(${req.r},${req.s}).\n` +
        `Output only the raw function body (return statement, no function keyword).`
      : `Generate a C++ calculate_energy function for the following constraint:\n` +
        `"${req.constraint}"\n` +
        `Parameters: n=${req.n} vertices, K_${req.r} red cliques forbidden, ` +
        `K_${req.s} blue independent sets forbidden.\n` +
        `Return only raw C++ source, no markdown.`;

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
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

    // Strip any markdown fences
    return text.replace(/^```(?:cpp|c\+\+|js|javascript)?\n?/m, "").replace(/```\s*$/m, "").trim();
  }

  /** Returns the hardcoded fallback for the requested target language */
  private _fallback(req: CompilationRequest): string {
    return req.targetLanguage === "javascript" ? STUB_JS_RAMSEY : STUB_CPP_RAMSEY;
  }
}
