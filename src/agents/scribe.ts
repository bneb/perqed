/**
 * ScribeAgent — Formal-to-LaTeX Academic Paper Translator
 *
 * Takes a winning ProofTree path (sequence of tactics and states)
 * and translates it into a rigorous AMS-LaTeX document using Gemini.
 */

import { GoogleGenAI } from "@google/genai";
import type { ProofNode } from "../tree";
import type { ResearchPlan, EvidenceReport, RedTeamResult } from "./research_types";

export class ScribeAgent {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Translates a complete autonomous research run into an AMS-LaTeX paper.
   */
  async draftResearchPaper(
    data: {
      plan: ResearchPlan;
      evidence: EvidenceReport;
      approvedConjecture: { signature: string; description: string } | null;
      redTeamHistory: RedTeamResult[];
      proofStatus: "PROVED" | "FAILED" | "SKIPPED";
      winningPath?: ProofNode[];
    }
  ): Promise<string> {
    const { plan, evidence, approvedConjecture, redTeamHistory, proofStatus, winningPath } = data;

    let proofSection = "";
    if (proofStatus === "PROVED" && winningPath) {
      proofSection = `We have a formal, machine-verified proof of the conjecture written in Lean 4.
Here is the formal trace:\n\n`;
      winningPath.forEach((node, i) => {
        proofSection += `Step ${i}:\n`;
        if (node.tacticApplied) proofSection += `  Tactic: \`${node.tacticApplied}\`\n`;
        proofSection += `  State:\n  ${node.leanState}\n\n`;
      });
    } else {
      proofSection = `The conjecture currently remains an open problem. Formal verification failed or was skipped.`;
    }

    const prompt = `You are an elite research mathematician and the "Perqed" AI Orchestrator.
You have just completed an autonomous research loop. Your task is to write a rigorous, human-readable academic paper summarizing your findings.

Requirements:
1. Output MUST be valid LaTeX code.
2. Use the \\documentclass{amsart} template.
3. Include a Title, Author (Perqed Autonomous Engine), Abstract, Introduction, Empirical Evidence, and Conclusion.
4. If there is an approved conjecture, format it in a formal Theorem environment.
5. If there is a formal trace provided, write the Proof narratively. Explain *why* the formal tactics work in informal math terms. If there is no trace, state the theorem remains an open conjecture.
6. Output ONLY the raw LaTeX string. Do not use markdown code blocks (\`\`\`latex). Just the raw code.

Here is the data from the autonomous run:

## Seed Paper
Title: ${plan.seed_paper.title}
arXiv ID: ${plan.seed_paper.arxivId}
Abstract: ${plan.seed_paper.abstract}

## Extension Hypothesis
${plan.extension_hypothesis}

## Empirical Investigation
Domains Probed: ${plan.domains_to_probe.join(", ")}
Anomalies: ${evidence.anomalies.join(", ") || "none"}
Kills: ${evidence.kills.join(", ") || "none"}
Synthesis: ${evidence.synthesis}

## Final Approved Conjecture (after ${redTeamHistory.length} red team rounds)
${approvedConjecture ? `Signature:\n${approvedConjecture.signature}\n\nDescription:\n${approvedConjecture.description}` : "None approved."}

## Formal Proof Status
Status: ${proofStatus}
${proofSection}`;

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
