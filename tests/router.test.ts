/**
 * Sprint 8: AgentRouter Tests (TDD)
 *
 * Tests the pure routing logic: given telemetry signals,
 * which specialist should handle the next move?
 */

import { describe, test, expect } from "bun:test";
import { AgentRouter } from "../src/agents/router";
import type { RoutingSignals } from "../src/types";

// ──────────────────────────────────────────────
// Helper: default signals (all zeros, healthy state)
// ──────────────────────────────────────────────

function makeSignals(overrides: Partial<RoutingSignals> = {}): RoutingSignals {
  return {
    totalAttempts: 5,
    consecutiveFailures: 0,
    globalFailures: 0,
    goalCount: 1,
    isStuckInLoop: false,
    lastErrors: [],
    hasArchitectDirective: false,
    ...overrides,
  };
}

// ──────────────────────────────────────────────
// Routing Logic
// ──────────────────────────────────────────────

describe("AgentRouter — determineNextAgent()", () => {

  test("returns ARCHITECT when totalAttempts is 0 (initial proof plan)", () => {
    const signals = makeSignals({ totalAttempts: 0 });
    expect(AgentRouter.determineNextAgent(signals)).toBe("ARCHITECT");
  });

  test("returns TACTICIAN on 1 goal and 0 failures (happy path)", () => {
    const signals = makeSignals({ goalCount: 1, consecutiveFailures: 0 });
    expect(AgentRouter.determineNextAgent(signals)).toBe("TACTICIAN");
  });

  test("returns REASONER on 3 consecutive failures", () => {
    const signals = makeSignals({ consecutiveFailures: 3 });
    expect(AgentRouter.determineNextAgent(signals)).toBe("REASONER");
  });

  test("returns REASONER on identical back-to-back errors (stuck in loop)", () => {
    const signals = makeSignals({ isStuckInLoop: true, consecutiveFailures: 1 });
    expect(AgentRouter.determineNextAgent(signals)).toBe("REASONER");
  });

  test("returns REASONER when Lean state has multiple goals (goal explosion)", () => {
    const signals = makeSignals({ goalCount: 2, consecutiveFailures: 0 });
    expect(AgentRouter.determineNextAgent(signals)).toBe("REASONER");
  });

  test("returns ARCHITECT on 6+ global tree failures (break glass)", () => {
    const signals = makeSignals({ globalFailures: 6, consecutiveFailures: 6 });
    expect(AgentRouter.determineNextAgent(signals)).toBe("ARCHITECT");
  });

  test("returns ARCHITECT on 7 global tree failures (above threshold)", () => {
    const signals = makeSignals({ globalFailures: 7, consecutiveFailures: 7 });
    expect(AgentRouter.determineNextAgent(signals)).toBe("ARCHITECT");
  });

  test("returns TACTICIAN when architect directive exists but 0 failures", () => {
    const signals = makeSignals({ hasArchitectDirective: true, consecutiveFailures: 0 });
    expect(AgentRouter.determineNextAgent(signals)).toBe("TACTICIAN");
  });

  test("ARCHITECT takes priority over REASONER at 6 global failures with loop", () => {
    const signals = makeSignals({ globalFailures: 6, consecutiveFailures: 6, isStuckInLoop: true, goalCount: 3 });
    expect(AgentRouter.determineNextAgent(signals)).toBe("ARCHITECT");
  });

  test("returns REASONER at exactly 5 failures (below ARCHITECT threshold of 6)", () => {
    const signals = makeSignals({ consecutiveFailures: 5 });
    expect(AgentRouter.determineNextAgent(signals)).toBe("REASONER");
  });
});

// ──────────────────────────────────────────────
// Goal Count Parsing
// ──────────────────────────────────────────────

describe("AgentRouter — parseGoalCount()", () => {

  test("parses '2 goals' correctly", () => {
    expect(AgentRouter.parseGoalCount("case zero\n⊢ 0 + m = m + 0\ncase succ\n⊢ ...\n2 goals")).toBe(2);
  });

  test("parses '3 goals' correctly", () => {
    expect(AgentRouter.parseGoalCount("3 goals\ncase zero\ncase succ\ncase succ.succ")).toBe(3);
  });

  test("returns 1 for single-goal state with ⊢", () => {
    expect(AgentRouter.parseGoalCount("n m : Nat\n⊢ n + m = m + n")).toBe(1);
  });

  test("returns 1 for single-goal state with |-", () => {
    expect(AgentRouter.parseGoalCount("n m : Nat\n|- n + m = m + n")).toBe(1);
  });

  test("returns 0 for empty string (no goals / solved)", () => {
    expect(AgentRouter.parseGoalCount("")).toBe(0);
  });

  test("returns 0 for 'No goals' text", () => {
    expect(AgentRouter.parseGoalCount("No goals")).toBe(0);
  });

  test("parses '1 goal' as 1", () => {
    expect(AgentRouter.parseGoalCount("1 goal\nn m : Nat\n⊢ n + m = m + n")).toBe(1);
  });
});
