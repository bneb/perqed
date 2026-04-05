import { getAgencyRegistry } from "../agency";

/**
 * LeanPRMScorer evaluates a Lean 4 tactic state transition and assigns a
 * probability score [0.0, 1.0] representing the likelihood that this branch
 * will lead to a PROOF_COMPLETE state.
 *
 * This acts as the Value Network for the FormalVerification MCTS engine.
 * It uses a fast/lightweight local LLM via Ollama to ensure the UCT
 * engine can rapidly evaluate branch expansions without hitting rate limits.
 */
export class LeanPRMScorer {
  private endpoint: string;
  private model: string;

  constructor() {
    // Defaults to the fast local model unless configured otherwise
    const provider = getAgencyRegistry().resolveProvider("formalization", true);
    this.endpoint = provider.endpoint ?? "http://localhost:11434";
    this.model = provider.model;
  }

  /**
   * Scores a transition from `beforeState` to `afterState` using `tactic`.
   * Returns a float between 0.0 and 1.0.
   */
  async scoreTransition(
    beforeState: string,
    tactic: string,
    afterState: string
  ): Promise<number> {
    // 1. Heuristic bypasses (so we don't query the LLM needlessly)
    if (afterState.includes("no goals")) {
      return 1.0; // Terminal win
    }
    if (afterState.includes("error:")) {
      return 0.0; // Terminal loss / syntax error
    }
    if (afterState === beforeState) {
      return 0.1; // Tactic achieved nothing (e.g. `simp` did nothing)
    }

    const prompt = `You are a Process Reward Model for the Lean 4 theorem prover.
Your job is to evaluate a single tactic step and estimate the probability (0.0 to 1.0) that it leads to a complete proof.

Current Goal:
${beforeState}

Tactic Applied:
\`${tactic}\`

New Goal:
${afterState}

Based on the simplification or structure of the new goal, rate the progress. 
Output ONLY a single float between 0.0 and 1.0.`;

    try {
      const response = await fetch(`${this.endpoint}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 10,
          },
        }),
      });

      if (!response.ok) return 0.5;

      const body = await response.json() as { response?: string };
      const raw = body.response?.trim() || "0.5";
      
      // Parse float from raw string (in case the model hallucinates surrounding text)
      const match = raw.match(/([0-1]?\.\d+)|([0-1]\.0*)|([0-1])/);
      if (match) {
        const val = parseFloat(match[0]);
        return isNaN(val) ? 0.5 : Math.max(0, Math.min(1, val));
      }

      return 0.5;
    } catch (e) {
      // Graceful fallback to uniform score if LLM request fails
      return 0.5;
    }
  }
}
