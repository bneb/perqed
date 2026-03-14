/**
 * Sprint 8: Orchestrator Routing Infrastructure Tests (TDD)
 *
 * Tests for buildRoutingSignals() and buildSlimContext() —
 * the pure functions that bridge workspace state to routing decisions.
 */

import { describe, test, expect } from "bun:test";
import { buildRoutingSignals, buildSlimContext } from "../src/orchestrator";
import type { AttemptLog } from "../src/types";

// ──────────────────────────────────────────────
// Helper: create AttemptLog entries
// ──────────────────────────────────────────────

function makeLog(overrides: Partial<AttemptLog> = {}): AttemptLog {
  return {
    agent: "TACTICIAN",
    action: "PROPOSE_LEAN_TACTICS",
    success: false,
    timestamp: Date.now(),
    ...overrides,
  };
}

// ──────────────────────────────────────────────
// buildRoutingSignals
// ──────────────────────────────────────────────

describe("buildRoutingSignals()", () => {

  test("returns totalAttempts=0 for empty logs", () => {
    const signals = buildRoutingSignals([], "", false);
    expect(signals.totalAttempts).toBe(0);
  });

  test("counts totalAttempts correctly", () => {
    const logs = [makeLog(), makeLog(), makeLog({ success: true })];
    const signals = buildRoutingSignals(logs, "", false);
    expect(signals.totalAttempts).toBe(3);
  });

  test("counts consecutive failures from the tail", () => {
    const logs = [
      makeLog({ success: true }),
      makeLog({ success: false }),
      makeLog({ success: false }),
      makeLog({ success: false }),
    ];
    const signals = buildRoutingSignals(logs, "", false);
    expect(signals.consecutiveFailures).toBe(3);
  });

  test("resets consecutive failures on success", () => {
    const logs = [
      makeLog({ success: false }),
      makeLog({ success: false }),
      makeLog({ success: true }),
      makeLog({ success: false }),
    ];
    const signals = buildRoutingSignals(logs, "", false);
    expect(signals.consecutiveFailures).toBe(1);
  });

  test("detects stuck-in-loop from identical errors", () => {
    const logs = [
      makeLog({ success: false, error: "unknown identifier 'simp'" }),
      makeLog({ success: false, error: "unknown identifier 'simp'" }),
    ];
    const signals = buildRoutingSignals(logs, "", false);
    expect(signals.isStuckInLoop).toBe(true);
  });

  test("not stuck when errors differ", () => {
    const logs = [
      makeLog({ success: false, error: "unknown identifier 'simp'" }),
      makeLog({ success: false, error: "type mismatch" }),
    ];
    const signals = buildRoutingSignals(logs, "", false);
    expect(signals.isStuckInLoop).toBe(false);
  });

  test("parses goalCount from tactic state", () => {
    const signals = buildRoutingSignals([], "2 goals\ncase zero\ncase succ", false);
    expect(signals.goalCount).toBe(2);
  });

  test("passes through hasArchitectDirective", () => {
    const signals = buildRoutingSignals([], "", true);
    expect(signals.hasArchitectDirective).toBe(true);
  });

  test("extracts lastErrors from recent failed logs", () => {
    const logs = [
      makeLog({ success: false, error: "error A" }),
      makeLog({ success: false, error: "error B" }),
    ];
    const signals = buildRoutingSignals(logs, "", false);
    expect(signals.lastErrors).toContain("error A");
    expect(signals.lastErrors).toContain("error B");
  });
});

// ──────────────────────────────────────────────
// buildSlimContext
// ──────────────────────────────────────────────

describe("buildSlimContext()", () => {

  test("includes theorem name and signature", () => {
    const ctx = buildSlimContext("nat_add_comm", "(n m : Nat) : n + m = m + n");
    expect(ctx).toContain("nat_add_comm");
    expect(ctx).toContain("n + m = m + n");
    expect(ctx).toContain(":= by");
  });

  test("includes last error when provided", () => {
    const ctx = buildSlimContext("nat_add_comm", "(n m : Nat) : n + m = m + n", "unknown identifier 'simp'");
    expect(ctx).toContain("Previous tactic failed with error:");
    expect(ctx).toContain("unknown identifier 'simp'");
  });

  test("omits error section when no error", () => {
    const ctx = buildSlimContext("nat_add_comm", "(n m : Nat) : n + m = m + n");
    expect(ctx).not.toContain("Previous tactic failed");
  });

  test("starts with instruction to output only tactics", () => {
    const ctx = buildSlimContext("nat_add_comm", "(n m : Nat) : n + m = m + n");
    expect(ctx.startsWith("Prove this theorem")).toBe(true);
    expect(ctx).toContain("ONLY the tactic");
  });
});
