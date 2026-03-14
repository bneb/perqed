/**
 * Sprint 8: AgentRouter — Signal-Based Specialist Selection
 *
 * Pure function. No I/O, no side effects. Analyzes telemetry
 * signals to determine which specialist should handle the next move.
 *
 * Routing priority (evaluated top-to-bottom):
 *   1. Initial state (no attempts)     → ARCHITECT (build proof plan)
 *   2. 5+ consecutive failures         → ARCHITECT (structural rethink)
 *   3. 3+ failures / stuck / multigoal → REASONER  (strategic unblock)
 *   4. Default                          → TACTICIAN (fast tactic spray)
 */

import type { AgentRole, RoutingSignals } from "../types";

/** Architect sub-tier: Flash (fast/cheap) vs Pro (deep reasoning). */
export type ArchitectTier = "FLASH" | "PRO";

export class AgentRouter {

  /**
   * Evaluate routing signals and select the appropriate specialist.
   *
   * @param signals - Telemetry extracted from workspace state and logs.
   * @returns The AgentRole that should handle the next move.
   */
  static determineNextAgent(signals: RoutingSignals): AgentRole {
    // ── Priority 1: Initial state — Architect builds the proof plan ──
    if (signals.totalAttempts === 0) {
      return "ARCHITECT";
    }

    // ── Priority 2: Total failure — Architect must intervene structurally ──
    if (signals.consecutiveFailures >= 5) {
      return "ARCHITECT";
    }

    // ── Priority 3: Struggling — Reasoner analyzes and unblocks ──
    if (
      signals.consecutiveFailures >= 3 ||
      signals.isStuckInLoop ||
      signals.goalCount > 1
    ) {
      return "REASONER";
    }

    // ── Priority 4: Normal operation — Tactician fires fast tactics ──
    return "TACTICIAN";
  }

  /**
   * Determine which Gemini tier to use when the ARCHITECT is selected.
   *
   * - FLASH: Initial proof plan, periodic checks (fast, cheap)
   * - PRO:   Heavy structural rethink after total failure (deep reasoning)
   */
  static determineArchitectTier(signals: RoutingSignals): ArchitectTier {
    // Pro only for severe failure — 5+ consecutive failures means
    // we need Gemini's deep reasoning to fundamentally rethink approach
    if (signals.consecutiveFailures >= 5) {
      return "PRO";
    }

    // Everything else (initial plan, light checks) → Flash
    return "FLASH";
  }

  /**
   * Parse the number of open goals from a Lean 4 tactic state string.
   *
   * Lean conventions:
   *   - "N goals" (N > 1) appears when multiple goals exist
   *   - "1 goal" appears for single-goal states
   *   - "⊢" or "|-" indicates at least one goal
   *   - Empty string or "No goals" means solved
   */
  static parseGoalCount(tacticState: string): number {
    if (!tacticState || tacticState.trim() === "") {
      return 0;
    }

    // Match "N goals" (plural) or "1 goal" (singular)
    const multiMatch = tacticState.match(/(\d+)\s+goals?/);
    if (multiMatch) {
      return parseInt(multiMatch[1]!, 10);
    }

    // Single goal indicated by turnstile
    if (tacticState.includes("⊢") || tacticState.includes("|-")) {
      return 1;
    }

    // No recognizable goal markers
    return 0;
  }
}
