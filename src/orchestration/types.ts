/**
 * orchestration/types.ts — Strictly Typed Context, Events & Actor Outputs
 *
 * Every mathematical artifact that flows through the research DAG is declared
 * here as an immutable, discriminated type. No `any`, no string-punning.
 *
 * These types are consumed by:
 *   - machine.ts  (the XState v5 state machine)
 *   - actors.ts   (fromPromise actor definitions)
 *   - runner.ts   (the public API)
 *   - tests/      (mock actor injection)
 */

import type { ResearchPlan, EvidenceReport, RedTeamResult } from "../agents/research_types";
import type { ProofTree } from "../tree";
import type { AttemptLog, AgentRole } from "../types";

// ──────────────────────────────────────────────
// Novelty Classification
// ──────────────────────────────────────────────

export type NoveltyClassification =
  | "NOVEL_DISCOVERY"
  | "KNOWN_THEOREM"
  | "UNCLASSIFIED";

// ──────────────────────────────────────────────
// Sandbox Signal Classification
// ──────────────────────────────────────────────

export type SandboxSignal =
  | "WITNESS_FOUND"
  | "PLATEAU_DETECTED"
  | "CLEAN_KILL";

// ──────────────────────────────────────────────
// Research Context (State Machine Context)
// ──────────────────────────────────────────────

export interface ResearchContext {
  /** The original user prompt. */
  prompt: string;
  /** API key for Gemini agents. */
  apiKey: string;
  /** Whether to bypass native_decide constraints for publishable targets. */
  publishableMode: boolean;
  /** Workspace root directory for output artifacts. */
  workspaceDir: string;
  /** Output directory for this specific run. */
  outputDir: string;
  /** Whether we are using the PhD level Cross Pollination engine. */
  crossPollinate: boolean;

  /** Literature references fetched by the Librarian. */
  literature: string[];
  /** The structured research plan from ideation. */
  plan: ResearchPlan | null;

  /** The current hypothesis under investigation. */
  hypothesis: string | null;
  /** Novelty classification of the current hypothesis. */
  noveltyClassification: NoveltyClassification;
  /** Number of ideation retries (max 3). */
  ideationRetries: number;
  /** Number of refinement retries (max 3). */
  refinementRetries: number;
  /** History of refinement steps. */
  refinementHistory: string[];
  /** Last validation error (passed back to ideation on hallucination). */
  lastValidationError: string | null;

  /** Evidence report from the empirical sandbox. */
  evidence: EvidenceReport | null;
  /** Sandbox classification signal. */
  sandboxSignal: SandboxSignal | null;
  /** Raw counter-example data from a CLEAN_KILL. */
  counterExample: unknown | null;
  /** Current SA energy level. */
  currentEnergy: number | null;

  /** Z3 SMT model (SAT result). */
  smtModel: string | null;

  /** Approved conjecture signature + description from empirical checks. */
  approvedConjecture: { signature: string; description: string } | null;
  /** History of Lakatosian counter-examples breaking earlier conjectures. */
  lakatosianHistory: { failedConjecture: string; killerEdgeCase: any }[];
  /** Full red team audit history (legacy). */
  redTeamHistory: RedTeamResult[];

  /** Lean AST (validated). */
  leanAst: unknown | null;
  /** Final Lean proof source. */
  leanProof: string | null;
  /** Number of proof/error-correction retries (max 3). */
  proofRetries: number;
  /** Last compiler error trace. */
  lastCompilerError: string | null;

  /** ── Proof Loop State (port from runDynamicLoop) ── */
  /** The MCTS proof tree for formal verification. */
  proofTree: ProofTree | null;
  /** Cumulative attempt logs for the AgentRouter. */
  attemptLogs: AttemptLog[];
  /** Last seen Lean tactic state (goal string). */
  lastTacticState: string;
  /** The currently selected specialist role. */
  currentAgentRole: AgentRole | null;
  /** Total global iterations in the proof loop. */
  globalIteration: number;
  /** Maximum global iterations (default 15). */
  maxGlobalIterations: number;

  /** Proof status at termination. */
  proofStatus: "PROVED" | "FAILED" | "SKIPPED" | null;
  /** Path to generated report. */
  reportPath: string | null;
}

// ──────────────────────────────────────────────
// Actor Output Types
// ──────────────────────────────────────────────

export interface IdeationOutput {
  classification: NoveltyClassification;
  hypothesis: string;
  plan: ResearchPlan;
  literature: string[];
}

export interface ValidationOutput {
  isValid: true;
  ast: unknown;
}

export interface SandboxOutput {
  signal: SandboxSignal;
  energy: number;
  evidence: EvidenceReport;
  data: unknown;
  /** Approved conjecture from RedTeam (only set on WITNESS_FOUND / CLEAN_KILL). */
  approvedConjecture: { signature: string; description: string } | null;
  redTeamHistory: RedTeamResult[];
}

export interface SMTOutput {
  status: "SAT" | "UNSAT";
  model: string | null;
}

export interface FalsificationOutput {
  proof: string;
  approvedConjecture: { signature: string; description: string };
  redTeamHistory: RedTeamResult[];
}

export interface RedTeamOutput {
  status: "VERIFIED_BULLETPROOF" | "COUNTER_EXAMPLE_FOUND";
  counterExamplePayload?: any;
}

export interface RefinementOutput {
  hypothesis: string;
  classification: NoveltyClassification;
  plan: ResearchPlan;
}

export interface LeanOutput {
  status: "PROOF_COMPLETE" | "COMPILER_ERROR";
  proof: string | null;
  error: string | null;
}

export interface ErrorCorrectionOutput {
  status: "FIXED" | "UNFIXABLE";
  proof: string | null;
}

export interface ScribeOutput {
  reportPath: string;
}

// ──────────────────────────────────────────────
// Research Events (Discriminated Union)
// ──────────────────────────────────────────────

/** Events are NOT sent manually — they are synthesized by actors via onDone/onError. */
export type ResearchEvent =
  | { type: "START"; prompt: string; apiKey: string; workspaceDir: string; outputDir: string; publishableMode: boolean; crossPollinate: boolean }
  | { type: "xstate.done.actor.ideation"; output: IdeationOutput }
  | { type: "xstate.done.actor.validation"; output: ValidationOutput }
  | { type: "xstate.done.actor.sandbox"; output: SandboxOutput }
  | { type: "xstate.done.actor.smt"; output: SMTOutput }
  | { type: "xstate.done.actor.falsification"; output: FalsificationOutput }
  | { type: "xstate.done.actor.redTeamActor"; output: RedTeamOutput }
  | { type: "xstate.done.actor.lean"; output: LeanOutput }
  | { type: "xstate.done.actor.errorCorrection"; output: ErrorCorrectionOutput }
  | { type: "xstate.done.actor.scribe"; output: ScribeOutput }
  | { type: "xstate.error.actor.*"; error: unknown };

// ──────────────────────────────────────────────
// Runner Configuration
// ──────────────────────────────────────────────

export interface ResearchMachineConfig {
  apiKey: string;
  workspaceDir: string;
  /** Maximum ideation retries before ExitGracefully (default: 3). */
  maxIdeationRetries?: number;
  /** Maximum proof retries before TerminalFailure (default: 3). */
  maxProofRetries?: number;
  /** Verbose logging (default: true). */
  verbose?: boolean;
  /** Activate generalized publishable logic. */
  publishableMode?: boolean;
  /** Activate the PhD Level Cross-Pollination Engine. */
  crossPollinate?: boolean;
}

// ──────────────────────────────────────────────
// Final Result
// ──────────────────────────────────────────────

export interface ResearchResult {
  plan: ResearchPlan | null;
  evidence: EvidenceReport | null;
  approvedConjecture: { signature: string; description: string } | null;
  redTeamHistory: RedTeamResult[];
  proofStatus: "PROVED" | "FAILED" | "SKIPPED";
  proofTree: ProofTree | null;
  outputDir: string;
  finalState: string;
}
