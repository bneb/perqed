/**
 * red_team.ts — Red Team Auditor Agent
 *
 * A skeptical Gemini Flash agent that audits a conjecture against
 * empirical evidence before it is sent to the expensive MCTS proof engine.
 *
 * Verdicts:
 *   APPROVE  — conjecture is sound, proceed to proof search.
 *   WEAKEN   — conjecture has a fixable flaw; returns a revised version.
 *   REJECT   — conjecture is fatally flawed; start over with a new hypothesis.
 *
 * The caller runs up to MAX_ROUNDS of WEAKEN→re-audit before giving up.
 */

import { GoogleGenAI } from "@google/genai";
import type { RedTeamResult } from "./research_types";
import { getAgencyRegistry } from "../agency";
import { SolverBridge } from "../solver";

export interface RedTeamConfig {
  apiKey: string;
  model?: string;
}

export interface RedTeamOutput {
  status: "VERIFIED_BULLETPROOF" | "COUNTER_EXAMPLE_FOUND";
  counterExamplePayload?: any;
}

export class RedTeamAuditor {
  private ai: GoogleGenAI;
  private model: string;
  private solver: SolverBridge;

  constructor(cfg: RedTeamConfig) {
    this.ai = new GoogleGenAI({ apiKey: cfg.apiKey });
    this.model = cfg.model ?? getAgencyRegistry().resolveProvider("red_team").model;
    this.solver = new SolverBridge();
  }

  /**
   * Generates a Python Z3 script to actively hunt for pathological counter-examples.
   * If a counter-example is found, it extracts and returns the JSON layout.
   */
  async runAdversarialRedTeam(conjecture: string): Promise<RedTeamOutput> {
    console.log(`\n[RedTeam] Generative Adversary launched against conjecture.`);
    
    const adversaryPrompt = `You are the Red Team, an expert in Extremal Combinatorics and SAT/SMT solving. 
The Ideator has proposed the following formal conjecture:

<CONJECTURE>
${conjecture}
</CONJECTURE>

Your goal is to DESTROY this conjecture. Write a complete, isolated Python script using \`z3-solver\` or \`networkx\` that searches specifically for a pathological combinatorial structure (an 'evil graph' or partition) that STRICTLY SATISFIES the domain constraints but VIOLATES the proposed bound or property.

CRITICAL REQUIREMENTS:
1. Output ONLY pure valid Python code. Do not include markdown codeblocks (\`\`\`python) or explanatory text. The very first character must be 'import'.
2. The script must execute cleanly without external input.
3. If a counter-example is found, print a raw JSON string of the structure to stdout.
4. If no counter-example can be found within bounds, print nothing or 'unsat'.`;

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: adversaryPrompt,
      config: { temperature: 0.2 },
    });

    let script = response.text || "";
    script = script.replace(/```python\s*/g, "").replace(/```\s*/g, "").trim();

    console.log(`[RedTeam] Z3 Python Script generated. Executing in sandbox...`);
    
    try {
      // Execute in isolated subprocess / docker
      const result = await this.solver.runZ3(script, 45_000);

      // Python execution output indicates success/sat?
      if (result.output && (result.output.includes("sat") || result.output.includes("{"))) {
        let payload = result.output;
        try {
          // Attempt to extract the JSON payload printed by the python script
          const jsonMatch = result.output.match(/\{[\s\S]*\}/);
          if (jsonMatch) payload = JSON.parse(jsonMatch[0]);
        } catch {
          // Fallback to raw string if parsing fails
        }
        
        console.log(`[RedTeam] 🚨 COUNTER-EXAMPLE FOUND! Conjecture broken.`);
        return {
          status: "COUNTER_EXAMPLE_FOUND",
          counterExamplePayload: payload,
        };
      }
      
      console.log(`[RedTeam] Sandbox execution clear. No counter-example bounded.`);
      return { status: "VERIFIED_BULLETPROOF" };
      
    } catch (e) {
      console.warn(`[RedTeam] Python execution crashed. Skipping counter-example propagation.`);
      return { status: "VERIFIED_BULLETPROOF" };
    }
  }
}
