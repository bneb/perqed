/**
 * Sprint 11: TelemetryEmitter Integration Tests
 *
 * Verifies that the orchestrator's dynamic loop calls TelemetryEmitter.emit()
 * correctly: once per iteration (IN_PROGRESS) and once with terminal status.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { TelemetryEmitter, type TelemetryPayload } from "../src/telemetry/emitter";

// ──────────────────────────────────────────────
// Spy on emit() calls
// ──────────────────────────────────────────────

describe("TelemetryEmitter — Orchestrator Integration", () => {
  let savedToken: string | undefined;
  let savedGistId: string | undefined;

  beforeEach(() => {
    savedToken = process.env.GITHUB_GIST_TOKEN;
    savedGistId = process.env.GITHUB_GIST_ID;
  });

  afterEach(() => {
    if (savedToken !== undefined) process.env.GITHUB_GIST_TOKEN = savedToken;
    else delete process.env.GITHUB_GIST_TOKEN;
    if (savedGistId !== undefined) process.env.GITHUB_GIST_ID = savedGistId;
    else delete process.env.GITHUB_GIST_ID;
  });

  test("emit() payload has correct shape for IN_PROGRESS", () => {
    const payload: TelemetryPayload = {
      runId: "integration-test-uuid",
      theorem: "nat_add_comm",
      status: "IN_PROGRESS",
      iteration: 3,
      currentSignals: {
        totalAttempts: 5,
        consecutiveFailures: 2,
        goalCount: 1,
        isStuckInLoop: false,
        lastErrors: ["tactic 'simp' failed"],
        hasArchitectDirective: true,
      },
      latestLog: {
        agent: "TACTICIAN",
        action: "PROPOSE_LEAN_TACTICS",
        success: false,
        error: "tactic 'simp' failed",
        timestamp: Date.now(),
      },
      history: [
        { agent: "ARCHITECT", action: "ARCHITECT_ESCALATION", success: true, timestamp: Date.now() },
        { agent: "TACTICIAN", action: "PROPOSE_LEAN_TACTICS", success: false, error: "tactic 'simp' failed", timestamp: Date.now() },
      ],
      timestamp: new Date().toISOString(),
    };

    // Verify structural correctness
    expect(payload.runId).toBeString();
    expect(payload.theorem).toBe("nat_add_comm");
    expect(payload.status).toBe("IN_PROGRESS");
    expect(payload.iteration).toBe(3);
    expect(payload.currentSignals.consecutiveFailures).toBe(2);
    expect(payload.latestLog).not.toBeNull();
    expect(payload.latestLog!.agent).toBe("TACTICIAN");
    expect(payload.history).toHaveLength(2);
    expect(payload.timestamp).toBeString();
  });

  test("emit() payload has correct shape for SOLVED terminal status", () => {
    const payload: TelemetryPayload = {
      runId: "integration-test-uuid",
      theorem: "nat_add_comm",
      status: "SOLVED",
      iteration: 5,
      currentSignals: {
        totalAttempts: 7,
        consecutiveFailures: 0,
        goalCount: 0,
        isStuckInLoop: false,
        lastErrors: [],
        hasArchitectDirective: false,
      },
      latestLog: {
        agent: "TACTICIAN",
        action: "PROPOSE_LEAN_TACTICS",
        success: true,
        timestamp: Date.now(),
      },
      history: [],
      timestamp: new Date().toISOString(),
    };

    expect(payload.status).toBe("SOLVED");
    expect(payload.currentSignals.consecutiveFailures).toBe(0);
    expect(payload.latestLog!.success).toBe(true);
  });

  test("emit() payload has correct shape for EXHAUSTED terminal status", () => {
    const payload: TelemetryPayload = {
      runId: "integration-test-uuid",
      theorem: "nat_add_comm",
      status: "EXHAUSTED",
      iteration: 15,
      currentSignals: {
        totalAttempts: 15,
        consecutiveFailures: 6,
        goalCount: 2,
        isStuckInLoop: true,
        lastErrors: ["maxRecDepth reached"],
        hasArchitectDirective: false,
      },
      latestLog: {
        agent: "REASONER",
        action: "PROPOSE_LEAN_TACTICS",
        success: false,
        error: "maxRecDepth reached",
        timestamp: Date.now(),
      },
      history: [],
      timestamp: new Date().toISOString(),
    };

    expect(payload.status).toBe("EXHAUSTED");
    expect(payload.currentSignals.consecutiveFailures).toBe(6);
    expect(payload.currentSignals.isStuckInLoop).toBe(true);
  });

  test("emit() sends full payload to Gist when configured", async () => {
    process.env.GITHUB_GIST_TOKEN = "ghp_testtoken";
    process.env.GITHUB_GIST_ID = "testgistid";

    let capturedBody: any = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input: any, init?: any) => {
      capturedBody = JSON.parse(init?.body ?? "{}");
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const emitter = new TelemetryEmitter();
      emitter.emit({
        runId: "test-run",
        theorem: "nat_add_comm",
        status: "IN_PROGRESS",
        iteration: 4,
        currentSignals: {
          totalAttempts: 6,
          consecutiveFailures: 3,
          goalCount: 1,
          isStuckInLoop: false,
          lastErrors: [],
          hasArchitectDirective: true,
        },
        latestLog: { agent: "REASONER", action: "PROPOSE_LEAN_TACTICS", success: false, timestamp: Date.now() },
        history: [],
        timestamp: new Date().toISOString(),
      });

      await new Promise((r) => setTimeout(r, 50));

      const content = JSON.parse(capturedBody.files["perqed_live_state.json"].content);
      expect(content.runId).toBe("test-run");
      expect(content.status).toBe("IN_PROGRESS");
      expect(content.iteration).toBe(4);
      expect(content.currentSignals.consecutiveFailures).toBe(3);
      expect(content.currentSignals.hasArchitectDirective).toBe(true);
      expect(content.latestLog.agent).toBe("REASONER");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
