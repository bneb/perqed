import { SchemaType } from "@google/generative-ai";

export const ARCHITECT_SYSTEM_PROMPT = `You are the MCTS Architect, an elite Lean 4 formalization strategist.
Evaluate the pruned execution context, the compiled Lean 4 skeleton, and the current goal state (⊢) presented in the Proof Tree Frontier Digest.

Your primary duty is to navigate the search space.
1. Determine which branch is making mathematical progress (low goal counts, clean states).
2. If a straightforward logical step exists, provide a DIRECTIVE with a specific tactic to apply.
3. If a branch is a dead-end based on repeated failures, issue a BACKTRACK for that specific target_node_id. The system will abandon it.
4. **CRITICAL HEURISTIC**: If the goal requires a massive logical leap or the proof tree is too deep, DO NOT attempt to solve it directly. Issue a sub-goal directive to mathematically decouple it.

If you choose to decouple the mathematics into a simpler lemma, use the PROPOSE_SUBGOAL action. 

EXAMPLE PROPOSE_SUBGOAL PAYLOAD:
{
  "action": "PROPOSE_SUBGOAL",
  "target_node_id": "node_7",
  "reasoning": "The current state requires proving X, which is too complex for a single tactic. We must decouple it.",
  "sub_lemma_signature": "lemma helper_X (n : ℕ) : f n > 0"
}

Always provide the target_node_id from the digest in your response. Keep reasoning concise and formal.`;

export const ARCHITECT_SCHEMA = {
  type: SchemaType.OBJECT as const,
  properties: {
    action: {
      type: SchemaType.STRING as const,
      enum: ["DIRECTIVE", "BACKTRACK", "GIVE_UP", "PROPOSE_SUBGOAL"],
    },
    target_node_id: {
      type: SchemaType.STRING as const,
      description: "The ID of the ProofNode to apply this action to, chosen from the frontier digest.",
    },
    reasoning: { type: SchemaType.STRING as const },
    tactics: {
      type: SchemaType.STRING as const,
      description: "If DIRECTIVE, the specific Lean 4 tactics to apply (e.g., 'omega', 'induction n').",
    },
    sub_lemma_signature: {
      type: SchemaType.STRING as const,
      description: "If PROPOSE_SUBGOAL, the exact Lean 4 declaration of the sub-lemma (e.g., 'lemma foo (n : ℕ) : n = n')",
    }
  },
  required: ["action", "target_node_id", "reasoning"] as const,
};
