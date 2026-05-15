import { getAgencyRegistry } from "../agency";

/**
 * A basic LRU Cache for structural PRM evaluations.
 */
class LRUCache<K, V> {
  private map = new Map<K, V>();
  
  constructor(private capacity: number) {}

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const val = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  set(key: K, value: V) {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      this.map.delete(this.map.keys().next().value!);
    }
  }
  
  has(key: K): boolean {
    return this.map.has(key);
  }
}

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
  private scoreCache = new LRUCache<string, number>(1000);

  constructor() {
    // Defaults to the fast local model unless configured otherwise
    const provider = getAgencyRegistry().resolveProvider("formalization", true);
    this.endpoint = provider.endpoint ?? "http://localhost:11434";
    this.model = provider.model;
  }

  /**
   * Zobrist-style topological skeletonization of a Lean state.
   * Strips specific variable names while keeping the logical structure intact.
   */
  private skeletonize(state: string): string {
    // Strip specific variable names, keeping the topological skeleton
    // e.g., "n m : Nat \n ⊢ n + m = m + n" -> "?VAR ?VAR : Nat \n ⊢ ?VAR + ?VAR = ?VAR + ?VAR"
    
    // First, find lines that declare variables: "a b c : Type"
    let skeleton = state.replace(/^([a-zA-Z0-9_ ]+)(?=:)/gm, (match) => {
        return match.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, "?VAR");
    });
    
    // Also naive replacement of isolated generic variables on the RHS if requested
    return skeleton.replace(/\s+/g, " ").trim();
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
      // Semantic Error Classification
      const errLower = afterState.toLowerCase();
      
      // 1. Tactic/Logic Failure or Fundamental Type Mismatch (Invalid path)
      if (
        errLower.includes("tactic 'exact' failed") ||
        errLower.includes("unsolved goals") ||
        errLower.includes("type mismatch") ||
        errLower.includes("does not match expected type")
      ) {
        return 0.0; 
      }
      
      // 2. Typeclass Resolution Failure (Requires Librarian / missing instance)
      if (errLower.includes("failed to synthesize instance")) {
        return 0.2; 
      } 
      
      // 3. Syntax/Parsing Error (Mild penalty, just a typo)
      if (
        errLower.includes("expected") || 
        errLower.includes("unexpected") || 
        errLower.includes("unknown identifier") || 
        errLower.includes("invalid")
      ) {
        return 0.4; 
      }
      
      // Unknown error
      return 0.0;
    }
    if (afterState === beforeState) {
      return 0.1; // Tactic achieved nothing (e.g. `simp` did nothing)
    }

    // 2. Structural Caching
    const skeleton = this.skeletonize(afterState);
    if (this.scoreCache.has(skeleton)) {
      return this.scoreCache.get(skeleton)!;
    }

    // 3. Advanced Structural Heuristics
    const beforeGoals = (beforeState.match(/⊢/g) || []).length;
    const afterGoals = (afterState.match(/⊢/g) || []).length;
    
    // If we reduced the number of open subgoals, that is a strong mathematical win
    if (afterGoals < beforeGoals) {
      this.scoreCache.set(skeleton, 0.85);
      return 0.85; 
    }
    
    // If the number of goals remains the same, but the state size dropped significantly, it's a good simplification
    if (afterGoals === beforeGoals && afterState.length < beforeState.length * 0.8) {
      this.scoreCache.set(skeleton, 0.75);
      return 0.75; 
    }

    // If new hypotheses were cleanly introduced
    const beforeLines = beforeState.split("\n").length;
    const afterLines = afterState.split("\n").length;
    if (afterLines > beforeLines && (tactic.trim().startsWith("have") || tactic.trim().startsWith("intro"))) {
      this.scoreCache.set(skeleton, 0.65);
      return 0.65; 
    }

    // Tao's Critique: Reward "creative expansion" tactics even if they increase state size
    const isCreativeExpansion = /^(apply|generalize|rw\s*<-|set|let)\b/.test(tactic.trim());
    if (isCreativeExpansion && afterState.length >= beforeState.length) {
      // It grew the state, but it's a known structural pivot. Reward slightly above baseline.
      this.scoreCache.set(skeleton, 0.60);
      return 0.60;
    }

    // 4. Fallback to LLM for complex state transitions

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

    let finalScore = 0.5;

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

      if (response.ok) {
        const body = await response.json() as { response?: string };
        const raw = body.response?.trim() || "0.5";
        
        const match = raw.match(/([0-1]?\.\d+)|([0-1]\.0*)|([0-1])/);
        if (match) {
          const val = parseFloat(match[0]);
          if (!isNaN(val)) {
            finalScore = Math.max(0, Math.min(1, val));
          }
        }
      }
    } catch (e) {
      // Graceful fallback to uniform score if LLM request fails
    }
    
    this.scoreCache.set(skeleton, finalScore);
    return finalScore;
  }
}
