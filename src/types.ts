/**
 * Sprint 8: Shared types for the Specialist Roster.
 *
 * These types are consumed by the AgentRouter, AgentFactory,
 * and the Orchestrator loop.
 */

// ──────────────────────────────────────────────
// Agent Roles
// ──────────────────────────────────────────────

/** The three specialist roles in the roster. */
export type AgentRole = "TACTICIAN" | "REASONER" | "ARCHITECT";

// ──────────────────────────────────────────────
// Routing Signals
// ──────────────────────────────────────────────

/**
 * Telemetry signals extracted from workspace state and attempt logs.
 * These are the inputs to the AgentRouter's pure routing function.
 */
export interface RoutingSignals {
  /** Total number of attempts so far in this proof run. */
  totalAttempts: number;
  /** Number of consecutive failures (resets on success). */
  consecutiveFailures: number;
  /** Number of open goals parsed from Lean tactic state. */
  goalCount: number;
  /** True if last 2+ errors are identical (stuck in a loop). */
  isStuckInLoop: boolean;
  /** The last N error strings for pattern detection. */
  lastErrors: string[];
  /** True if an architect directive file exists (active guidance). */
  hasArchitectDirective: boolean;
}

// ──────────────────────────────────────────────
// Attempt Log
// ──────────────────────────────────────────────

/**
 * A single attempt record, used by the router to analyze momentum.
 */
export interface AttemptLog {
  /** Which specialist made this attempt. */
  agent: AgentRole;
  /** The action taken (e.g., "PROPOSE_LEAN_TACTICS"). */
  action: string;
  /** Whether the attempt succeeded. */
  success: boolean;
  /** Error message if failed. */
  error?: string;
  /** Unix timestamp of the attempt. */
  timestamp: number;
}
