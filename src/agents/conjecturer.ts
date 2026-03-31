/**
 * ConjecturerAgent — Gemini-Powered Mathematical Hypothesis Generator
 *
 * Consumes recent arXiv literature context (and optionally an EvidenceReport
 * from the Explorer) to generate novel, syntactically valid Lean 4 theorem
 * signatures via structured JSON output from Gemini.
 */

import { GoogleGenAI, Type, type Schema } from "@google/genai";
import type { EvidenceReport } from "./research_types";

export interface Conjecture {
  name: string;
  signature: string;
  description: string;
}

export class ConjecturerAgent {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Generates novel Lean 4 theorem signatures based on literature context.
   *
   * @param literatureContext  - arXiv abstract chunks from the vector DB
   * @param evidence           - Optional EvidenceReport from the Explorer agent.
   *                            When provided, the empirical synthesis and anomalies
   *                            are injected into the prompt so conjectures are grounded
   *                            in actual computational findings.
   * @returns Array of structured conjectures
   */
  async generateConjectures(
    literatureContext: string,
    evidence?: EvidenceReport,
  ): Promise<Conjecture[]> {
    const schema: Schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description:
              "A concise, valid Lean 4 theorem name (e.g., bipartite_edge_bound).",
          },
          signature: {
            type: Type.STRING,
            description:
              "The exact Lean 4 theorem signature (e.g., theorem bipartite_edge_bound (G : Graph) : ...)",
          },
          description: {
            type: Type.STRING,
            description:
              "Academic English explanation of why this theorem is novel and interesting.",
          },
        },
        required: ["name", "signature", "description"],
      },
    };

    // Build the evidence section only when provided
    let evidenceSection = "";
    if (evidence) {
      evidenceSection = `\n\n## Empirical Investigation Results\n\n` +
        `**Synthesis:** ${evidence.synthesis}\n\n` +
        `**Domains with detected signal:** ${evidence.anomalies.join(", ") || "none"}\n\n` +
        `**Domains falsified:** ${evidence.kills.join(", ") || "none"}\n\n` +
        `Ground your conjectures in these empirical findings. Prefer theorems that explain or generalize the detected signals.`;
    }

    const prompt =
      `You are an elite mathematical researcher. Review the following recent excerpts from arXiv:\n\n` +
      `${literatureContext}${evidenceSection}\n\n` +
      `Synthesize these concepts. Formulate 5 completely novel, unproven, but highly plausible Lean 4 theorems ` +
      `inspired by this research. They must be syntactically valid Lean 4 and mathematically non-trivial.`;

    const response = await this.ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        systemInstruction:
          "You are the Conjecturer. Your output must be strict JSON matching the schema.",
        temperature: 0.9,
      },
    });

    if (!response.text) {
      throw new Error("Conjecturer failed to generate text.");
    }

    return JSON.parse(response.text) as Conjecture[];
  }
}
