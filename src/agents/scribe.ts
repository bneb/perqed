/**
 * ScribeAgent — Formal-to-LaTeX Academic Paper Translator
 *
 * Takes a winning ProofTree path (sequence of tactics and states)
 * and translates it into a rigorous AMS-LaTeX document using Gemini.
 */

import { GoogleGenAI } from "@google/genai";
import type { ProofNode } from "../tree";

export class ScribeAgent {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Translates a formal Lean 4 proof trace into an AMS-LaTeX paper.
   *
   * @param theoremSignature - Full theorem declaration
   * @param winningPath - Ordered Root→Leaf path from ProofTree
   * @returns Raw LaTeX string (compilable amsart document)
   */
  async draftPaper(
    theoremSignature: string,
    winningPath: ProofNode[],
  ): Promise<string> {
    // Format the trace for the LLM
    let traceContext = `Theorem: ${theoremSignature}\n\nFormal Lean 4 Trace:\n`;
    winningPath.forEach((node, i) => {
      traceContext += `Step ${i}:\n`;
      if (node.tacticApplied) {
        traceContext += `  Tactic Applied: \`${node.tacticApplied}\`\n`;
      }
      traceContext += `  Resulting State:\n  ${node.leanState}\n\n`;
    });

    const prompt = `You are an elite research mathematician. I have a formal, machine-verified proof of a theorem written in Lean 4.

Your task is to translate this formal trace into a rigorous, human-readable mathematical proof.

Requirements:
1. Output MUST be valid LaTeX code.
2. Use the \\documentclass{amsart} template.
3. Include a Title, Author (Perqed AI), Abstract, and the formal Theorem environment.
4. Write the Proof environment narratively. Explain *why* the tactics work in informal math terms (e.g., translate 'induction n' into 'We proceed by induction on $n$.').
5. Output ONLY the raw LaTeX string. Do not use markdown code blocks (\`\`\`latex). Just the raw code.

Here is the formal trace:

${traceContext}`;

    const response = await this.ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        systemInstruction:
          "You are the Scribe. You output raw, compilable AMS-LaTeX code and absolutely nothing else.",
        temperature: 0.2,
      },
    });

    if (!response.text) {
      throw new Error("Scribe failed to generate LaTeX.");
    }

    // Clean up markdown code fences if the LLM ignored our instructions
    return response.text
      .replace(/^```latex\n/g, "")
      .replace(/^```\n/g, "")
      .replace(/```$/g, "")
      .trim();
  }
}
