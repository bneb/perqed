import { Type, type Schema } from "@google/genai";
import { PerqedLLM } from "../agency/llm_client";
import type { HeuristicProgram } from "./program_database";
import { getAgencyRegistry } from "../agency";

export interface CrossoverConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
}

export class FunSearchCrossover {
  private ai: PerqedLLM;
  private model: string;
  private temperature: number;

  constructor(config: CrossoverConfig) {
    this.ai = new PerqedLLM({ apiKey: config.apiKey });
    this.model = config.model ?? getAgencyRegistry().resolveProvider("reasoning").model;
    this.temperature = config.temperature ?? 0.7; // Higher temp for divergent evolution
  }

  /**
   * Evaluates two parent algorithms and synthesizes a novel offspring
   * using FunSearch sub-component mutation strategies.
   */
  public async mutate(
    parentA: HeuristicProgram,
    parentB: HeuristicProgram,
    domain: string
  ): Promise<string> {
    const prompt = `You are a FunSearch-style Evolutionary AI designed to generate novel combinatorial heuristics.

DOMAIN TARGET: ${domain}

You are provided with two high-scoring parent heuristics written in Python. 
Your goal is to perform an AST cross-over/mutation:
1. Analyze what algorithmic structure makes each parent successful.
2. Fuse their properties into a single, novel offspring script.
3. If they are very similar, mutate a critical sub-function (like the scoring heuristic or neighbor-generation step) to introduce completely novel exploration behavior.
4. DO NOT just concatenate them. You must output ONE cohesive script.
5. The script must be self-contained and print out the numerical performance size as "SCORE: <integer>" at the end of its output, so the scoring engine can rank it.
6. The script must run in a WASI python runtime. Use only sympy/numpy/math.

${domain.includes("Erdos265_Full_Resolution") ? `MCTS BRANCHING DIRECTIVE:
The target is Erdos265_Full_Resolution. You must allocate the proof search into two branches:
- Branch A (Constructive Break): Synthesize an Ahmes vector perturbation to hunt for a combinatorial witness violating the 2^n barrier.
- Branch B (Analytic Ceiling): Synthesize a Lean 4 sub-lemma utilizing lattice_rounding_2d to bound the rate of convergence.` : ""}

PARENT A (Score: ${parentA.score}):
\`\`\`python
${parentA.code}
\`\`\`

PARENT B (Score: ${parentB.score}):
\`\`\`python
${parentB.code}
\`\`\`

OUTPUT INSTRUCTION: Output strict JSON with exactly one key "code" containing the raw python offspring string.`;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        code: { type: Type.STRING },
      },
      required: ["code"],
    };

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: this.temperature,
      },
    });

    if (!response.text) {
      throw new Error("FunSearch AST mutation failed: empty response");
    }

    try {
      const parsed = JSON.parse(response.text);
      return parsed.code;
    } catch (e: any) {
      throw new Error(`FunSearch crossover JSON parse failed: ${e.message}`);
    }
  }
}
