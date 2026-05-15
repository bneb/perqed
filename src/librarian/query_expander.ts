import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAgencyRegistry } from "../agency";

/**
 * QueryExpander — Generates targeted literature search queries using an LLM.
 *
 * This ensures the Librarian's background seeding is grounded in the current
 * problem domain rather than relying on hardcoded defaults.
 */
export class QueryExpander {
  private readonly model: any;

  constructor(apiKey: string) {
    const registry = getAgencyRegistry();
    // Resolve L1_micro or standard tier for quick keyword expansion
    const provider = registry.resolveProvider("chat");
    const genAI = new GoogleGenerativeAI(apiKey);
    
    this.model = genAI.getGenerativeModel({
      model: provider.model, // e.g. gemini-2.5-flash from agency.json
      systemInstruction: "You are a research librarian for a mathematics AI. Given a mathematical problem statement, generate exactly 5 precise arXiv search queries (3-6 words each) that would help find relevant background papers, lemmas, or related problems. Output only the queries, one per line, no numbering, no preamble.",
    });
  }

  /**
   * Generates 5 search queries based on the provided mathematical prompt.
   * Fallback to common combinatorial queries if LLM fails.
   */
  async expand(prompt: string): Promise<string[]> {
    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text().trim();
      const queries = text.split("\n")
        .map((q: string) => q.replace(/^[-\d.]+\s*/, "").trim()) // strip numbering or bullets
        .filter((q: string) => q.length > 0)
        .slice(0, 5);

      if (queries.length > 0) return queries;
    } catch (err: any) {
      console.warn(`[QueryExpander] LLM generation failed: ${err.message}. Falling back to defaults.`);
    }

    // Conservative fallbacks if LLM is unavailable
    return [
      "Ramsey theory lower bound",
      "infinite series rationality",
      "constructive existence proof",
      "combinatorial optimization simulated annealing",
      "formalized mathematics Lean 4 mathlib"
    ];
  }
}
