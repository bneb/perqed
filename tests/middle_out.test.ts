/**
 * Middle-Out Tripwire Tests (TDD)
 *
 * Tests for the deterministic tripwire routing rules
 * and the FailureDigest construction.
 */

import { describe, test, expect } from "bun:test";
import { AgentRouter } from "../src/agents/router";
import { buildFailureDigest, type FailureDigest } from "../src/agents/failure_digest";
import type { RoutingSignals, AttemptLog } from "../src/types";

// ──────────────────────────────────────────────
// Helper
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
    identicalErrorCount: 0,
    totalTacticianCalls: 0,
    ...overrides,
  };
}

function makeLogs(count: number, opts: { error?: string; agent?: "TACTICIAN" | "REASONER" | "ARCHITECT" } = {}): AttemptLog[] {
  return Array.from({ length: count }, (_, i) => ({
    agent: opts.agent ?? "TACTICIAN" as const,
    action: "PROPOSE_LEAN_TACTICS",
    success: false,
    error: opts.error ?? `error ${i}`,
    timestamp: Date.now() + i,
  }));
}

// ──────────────────────────────────────────────
// Tripwire Routing
// ──────────────────────────────────────────────

describe("Middle-Out Tripwires", () => {

  test("ARCHITECT when totalTacticianCalls >= 10 (budget ceiling)", () => {
    const signals = makeSignals({ totalTacticianCalls: 10, totalAttempts: 12 });
    expect(AgentRouter.determineNextAgent(signals)).toBe("ARCHITECT");
  });

  test("ARCHITECT when totalTacticianCalls = 15 (well above ceiling)", () => {
    const signals = makeSignals({ totalTacticianCalls: 15, totalAttempts: 20 });
    expect(AgentRouter.determineNextAgent(signals)).toBe("ARCHITECT");
  });

  test("TACTICIAN still used when totalTacticianCalls = 9 (below ceiling)", () => {
    const signals = makeSignals({ totalTacticianCalls: 9, totalAttempts: 10 });
    expect(AgentRouter.determineNextAgent(signals)).toBe("TACTICIAN");
  });

  test("ARCHITECT when identicalErrorCount >= 3 (stuck detection)", () => {
    const signals = makeSignals({ identicalErrorCount: 3, totalAttempts: 5 });
    expect(AgentRouter.determineNextAgent(signals)).toBe("ARCHITECT");
  });

  test("TACTICIAN when identicalErrorCount = 2 (below threshold)", () => {
    const signals = makeSignals({ identicalErrorCount: 2, totalAttempts: 5 });
    expect(AgentRouter.determineNextAgent(signals)).toBe("TACTICIAN");
  });

  test("tripwire takes priority over REASONER", () => {
    // 3 consecutive failures would normally route to REASONER,
    // but 10 tactician calls should route to ARCHITECT
    const signals = makeSignals({
      consecutiveFailures: 3,
      totalTacticianCalls: 10,
      totalAttempts: 12,
    });
    expect(AgentRouter.determineNextAgent(signals)).toBe("ARCHITECT");
  });

  test("initial state (totalAttempts=0) still routes to ARCHITECT", () => {
    const signals = makeSignals({ totalAttempts: 0, totalTacticianCalls: 0 });
    expect(AgentRouter.determineNextAgent(signals)).toBe("ARCHITECT");
  });
});

// ──────────────────────────────────────────────
// Failure Digest
// ──────────────────────────────────────────────

describe("FailureDigest", () => {

  test("produces MAX_TACTIC_ATTEMPTS digest when tactician ceiling is hit", () => {
    const signals = makeSignals({ totalTacticianCalls: 10, totalAttempts: 12 });
    const logs = makeLogs(10);
    const digest = buildFailureDigest(signals, logs);

    expect(digest.triggerReason).toBe("MAX_TACTIC_ATTEMPTS");
    expect(digest.totalAttempts).toBe(12);
    expect(digest.lastNErrors.length).toBeGreaterThan(0);
    expect(digest.lastNErrors.length).toBeLessThanOrEqual(3);
  });

  test("produces IDENTICAL_ERRORS digest when stuck on same error", () => {
    const signals = makeSignals({ identicalErrorCount: 3, totalAttempts: 5 });
    const logs = makeLogs(3, { error: "unknown identifier 'omega'" });
    const digest = buildFailureDigest(signals, logs);

    expect(digest.triggerReason).toBe("IDENTICAL_ERRORS");
    expect(digest.uniqueErrorSignatures.length).toBe(1);
    expect(digest.uniqueErrorSignatures[0]).toContain("omega");
  });

  test("produces STUCK_LOOP digest when isStuckInLoop is true with high failures", () => {
    const signals = makeSignals({
      isStuckInLoop: true,
      consecutiveFailures: 6,
      globalFailures: 6,
      totalAttempts: 8,
    });
    const logs = makeLogs(6, { error: "type mismatch" });
    const digest = buildFailureDigest(signals, logs);

    expect(digest.triggerReason).toBe("STUCK_LOOP");
  });

  test("deduplicates error signatures", () => {
    const signals = makeSignals({ totalTacticianCalls: 10, totalAttempts: 10 });
    const logs = [
      ...makeLogs(3, { error: "error A" }),
      ...makeLogs(4, { error: "error B" }),
      ...makeLogs(3, { error: "error A" }),
    ];
    const digest = buildFailureDigest(signals, logs);

    expect(digest.uniqueErrorSignatures).toContain("error A");
    expect(digest.uniqueErrorSignatures).toContain("error B");
    expect(digest.uniqueErrorSignatures.length).toBe(2);
  });

  test("includes deterministic recommendation", () => {
    const signals = makeSignals({ identicalErrorCount: 3, totalAttempts: 5 });
    const logs = makeLogs(3, { error: "omega failed" });
    const digest = buildFailureDigest(signals, logs);

    expect(digest.recommendation).toBeTruthy();
    expect(typeof digest.recommendation).toBe("string");
  });

  test("lastNErrors contains at most 3 entries", () => {
    const signals = makeSignals({ totalTacticianCalls: 10, totalAttempts: 10 });
    const logs = makeLogs(10);
    const digest = buildFailureDigest(signals, logs);

    expect(digest.lastNErrors.length).toBeLessThanOrEqual(3);
  });
});
