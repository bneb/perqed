/**
 * Middle-Out: FailureDigest — Deterministic Context Compression
 *
 * Pure function. No LLM calls. Extracts a structured summary
 * from routing signals and attempt logs when a tripwire fires.
 *
 * The ARCHITECT receives this digest instead of raw logs,
 * saving tokens and providing actionable context.
 */

import type { RoutingSignals, AttemptLog } from "../types";

// ──────────────────────────────────────────────
// Tripwire Constants (shared with router)
// ──────────────────────────────────────────────

export const MAX_TACTIC_ATTEMPTS = 10;
export const MAX_IDENTICAL_ERRORS = 3;

// ──────────────────────────────────────────────
// Digest Type
// ──────────────────────────────────────────────

export type TriggerReason =
  | "MAX_TACTIC_ATTEMPTS"
  | "IDENTICAL_ERRORS"
  | "STUCK_LOOP"
  | "GLOBAL_FAILURE";

export interface FailureDigest {
  /** Why the escalation was triggered. */
  triggerReason: TriggerReason;
  /** Total attempts in this run. */
  totalAttempts: number;
  /** Deduplicated error messages. */
  uniqueErrorSignatures: string[];
  /** Last 3 error strings (most recent first). */
  lastNErrors: string[];
  /** Current state description. */
  currentState: string;
  /** Deterministic recommendation based on trigger reason. */
  recommendation: string;
}

// ──────────────────────────────────────────────
// Builder
// ──────────────────────────────────────────────

const RECOMMENDATIONS: Record<TriggerReason, string> = {
  MAX_TACTIC_ATTEMPTS:
    "TACTICIAN has exhausted its budget. Consider a fundamentally different approach: helper lemma, alternative encoding, or decomposition into sub-goals.",
  IDENTICAL_ERRORS:
    "The same error is repeating. The current tactic family cannot solve this goal. Try a different proof strategy entirely.",
  STUCK_LOOP:
    "The proof search is cycling through identical states. Backtrack to an earlier node or restructure the proof tree.",
  GLOBAL_FAILURE:
    "Multiple branches of the proof tree have failed. Consider whether the theorem statement is correct, or try a completely different approach.",
};

export function buildFailureDigest(
  signals: RoutingSignals,
  logs: AttemptLog[],
): FailureDigest {
  // Determine trigger reason (priority order)
  let triggerReason: TriggerReason;
  if (signals.identicalErrorCount >= MAX_IDENTICAL_ERRORS) {
    triggerReason = "IDENTICAL_ERRORS";
  } else if (signals.totalTacticianCalls >= MAX_TACTIC_ATTEMPTS) {
    triggerReason = "MAX_TACTIC_ATTEMPTS";
  } else if (signals.isStuckInLoop && signals.consecutiveFailures >= 6) {
    triggerReason = "STUCK_LOOP";
  } else {
    triggerReason = "GLOBAL_FAILURE";
  }

  // Extract last 3 errors
  const failedLogs = logs.filter((l) => !l.success && l.error);
  const lastNErrors = failedLogs
    .slice(-3)
    .map((l) => l.error!)
    .reverse();

  // Deduplicate error signatures
  const uniqueErrorSignatures = [
    ...new Set(failedLogs.map((l) => l.error!)),
  ];

  // Build state description
  const currentState = [
    `${signals.totalAttempts} total attempts`,
    `${signals.consecutiveFailures} consecutive failures`,
    `${signals.totalTacticianCalls} TACTICIAN calls`,
    `${signals.goalCount} open goal(s)`,
  ].join(", ");

  return {
    triggerReason,
    totalAttempts: signals.totalAttempts,
    uniqueErrorSignatures,
    lastNErrors,
    currentState,
    recommendation: RECOMMENDATIONS[triggerReason],
  };
}

// ──────────────────────────────────────────────
// Formatter (for ARCHITECT context)
// ──────────────────────────────────────────────

export function formatDigestForArchitect(digest: FailureDigest): string {
  const lines = [
    `🚨 [ESCALATION TRIGGERED: ${digest.triggerReason}]`,
    ``,
    `## Failure Digest`,
    `- Trigger: ${digest.triggerReason}`,
    `- State: ${digest.currentState}`,
    ``,
    `## Unique Errors (${digest.uniqueErrorSignatures.length})`,
    ...digest.uniqueErrorSignatures.map((e) => `- ${e}`),
    ``,
    `## Last 3 Errors`,
    ...digest.lastNErrors.map((e, i) => `${i + 1}. ${e}`),
    ``,
    `## Recommendation`,
    digest.recommendation,
  ];
  return lines.join("\n");
}
