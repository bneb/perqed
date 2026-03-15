/**
 * Hybrid Roster: AgentRouter — Signal-Based Specialist Selection
 *
 * Pure function. No I/O, no side effects. Analyzes telemetry
 * signals to determine which specialist should handle the next move.
 *
 * 4-Tier Escalation (evaluated top-to-bottom):
 *   1. Initial state (no attempts)                → ARCHITECT (build proof plan)
 *   2. 6+ global tree failures                    → ARCHITECT (break glass / structural rethink)
 *   3. 3+ local failures / stuck / multigoal      → REASONER  (tactical unblock)
 *   4. Default                                     → TACTICIAN (fast tactic spray)
 *
 * The ARCHITECT sees global tree health; the REASONER sees local node state.
 * Gemini tier selection is handled by the AgentFactory, not the router.
 */

import type { AgentRole, RoutingSignals } from "../types";

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

    // ── Priority 2: Global tree failure (N=6+) — Architect must intervene structurally ──
    // Requires BOTH global tree health to be poor AND an active local crisis
    // (consecutive failures >= 6). Prevents infinite ARCHITECT loops when
    // tree-accumulated errors persist after a DIRECTIVE reset.
    if (signals.globalFailures >= 6 && signals.consecutiveFailures >= 6) {
      return "ARCHITECT";
    }

    // ── Priority 3: Struggling (3+) — Reasoner analyzes and unblocks ──
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
