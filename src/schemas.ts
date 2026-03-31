/**
 * Zod Schemas — Strict contracts for LLM output validation.
 *
 * v2.0 "Council Edition":
 *   - TacticSchema: per-tactic informal sketch + confidence score + code
 *   - AgentAction: FALSIFY_FIRST | PROPOSE_TACTICS | GIVE_UP | SOLVED
 *   - AgentResponseSchema: supports batched tactics array (Dean) with
 *     confidence scoring (Hassabis) and falsification phase (Tao)
 */

import { z } from "zod";

// ──────────────────────────────────────────────
// Tactic Schema (Hassabis's Value Function)
// ──────────────────────────────────────────────

/**
 * Each individual tactic proposed by the local LLM.
 * The confidence_score acts as the "Value" function from MCTS,
 * letting the orchestrator prioritize the most promising approach.
 */
export const TacticSchema = z.object({
  informal_sketch: z.string().describe(
    "Natural language explanation of this specific mathematical approach.",
  ),
  confidence_score: z.number().min(0).max(1).describe(
    "Estimated probability this tactic leads to 'unsat' (0.0 = no chance, 1.0 = certain).",
  ),
  code: z.string().describe(
    "Complete, standalone Z3 Python script.",
  ),
});

export type Tactic = z.infer<typeof TacticSchema>;

// ──────────────────────────────────────────────
// Local Agent Response (Council Edition)
// ──────────────────────────────────────────────

/**
 * Action vocabulary:
 *   - FALSIFY_FIRST: Tao's mandate. Run a bounded counterexample search
 *     before attempting a rigorous proof. Uses `code` field.
 *   - PROPOSE_TACTICS: Dean's mandate. Submit 1–5 tactics for parallel
 *     execution via Promise.all. Uses `tactics` array.
 *   - GIVE_UP: Escalate to Architect immediately.
 *   - SOLVED: Declare the problem solved.
 */
export const AgentAction = z.enum([
  "FALSIFY_FIRST",
  "PROPOSE_TACTICS",
  "GIVE_UP",
  "SOLVED",
]);

export const AgentResponseSchema = z.object({
  thoughts: z.string().describe(
    "High-level OODA loop analysis: proof sketch → translation strategy → contradiction → execution plan.",
  ),
  action: AgentAction.describe("The agent's chosen action."),
  code: z.string().optional().describe(
    "Z3 Python code — required for FALSIFY_FIRST and SOLVED actions.",
  ),
  tactics: z.array(TacticSchema).max(5).optional().describe(
    "Array of 1–5 independent tactics for parallel execution — required for PROPOSE_TACTICS.",
  ),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// ──────────────────────────────────────────────
// Lean Tactic Schema (Sprint 6: Formalist)
// ──────────────────────────────────────────────

/**
 * A Lean 4 tactic proposed by the Formalist agent.
 * Unlike Z3 TacticSchema (which holds full Python scripts),
 * this holds a single Lean tactic string (e.g., "omega", "intro n").
 */
export const LeanTacticSchema = z.object({
  tactic: z.string().describe(
    "A single Lean 4 tactic (e.g., 'omega', 'intro n', 'simp [Nat.add_comm]').",
  ),
  informal_sketch: z.string().describe(
    "Natural language explanation of this tactic's mathematical reasoning.",
  ),
  confidence_score: z.number().min(0).max(1).describe(
    "Estimated probability this tactic advances the proof (0.0 = no chance, 1.0 = certain).",
  ),
});

export type LeanTactic = z.infer<typeof LeanTacticSchema>;

// ──────────────────────────────────────────────
// Formalist Response (Sprint 6: Lean-as-DSL)
// ──────────────────────────────────────────────

/**
 * Action vocabulary for the Formalist agent (Lean prover):
 *   - PROPOSE_LEAN_TACTICS: Submit 1–5 Lean tactics for parallel verification
 *   - SEARCH_LEMMA: Ask to search Mathlib for relevant theorems (exact?/apply?)
 *   - GIVE_UP: Escalate to Architect immediately
 *   - SOLVED: Declare the proof complete
 */
export const FormalistAction = z.enum([
  "PROPOSE_LEAN_TACTICS",
  "SEARCH_LEMMA",
  "GIVE_UP",
  "SOLVED",
]);

export const FormalistResponseSchema = z.object({
  thoughts: z.string().describe(
    "OODA analysis of the current Lean tactic state.",
  ),
  action: FormalistAction.describe("The Formalist's chosen action."),
  lean_tactics: z.array(LeanTacticSchema).max(5).optional().describe(
    "Array of 1–5 Lean tactics for parallel verification — required for PROPOSE_LEAN_TACTICS.",
  ),
  search_query: z.string().optional().describe(
    "Natural language or Lean name query for Mathlib search — required for SEARCH_LEMMA.",
  ),
});

export type FormalistResponse = z.infer<typeof FormalistResponseSchema>;

// ──────────────────────────────────────────────
// Architect Response (Gemini — called on escalation)
// ──────────────────────────────────────────────

/**
 * The Architect (Gemini) returns this schema when consulted.
 * It does NOT write code — it prunes the search tree and redirects.
 */
export const ArchitectResponseSchema = z.object({
  analysis: z.string().describe(
    "Brief explanation of why the local model's recent attempts are failing mathematically.",
  ),
  steps_to_backtrack: z.number().int().min(0).describe(
    "How many verified steps to delete from current_progress.md to escape the dead end.",
  ),
  new_directive: z.string().describe(
    "Strict, high-level instruction for the LocalAgent on what mathematical approach to try next.",
  ),
});

export type ArchitectResponse = z.infer<typeof ArchitectResponseSchema>;
