/**
 * Sprint 8: End-to-End Routing Integration Tests
 *
 * Verifies the full pipeline: AttemptLog[] → buildRoutingSignals() →
 * AgentRouter.determineNextAgent() → AgentFactory.getAgent() → correct role.
 *
 * These tests validate that the three components work together correctly,
 * simulating realistic orchestrator scenarios.
 */

import { describe, test, expect } from "bun:test";
import { buildRoutingSignals } from "../src/orchestrator";
import { AgentRouter } from "../src/agents/router";
import { AgentFactory } from "../src/agents/factory";
import type { AttemptLog, RoutingSignals } from "../src/types";

function makeLog(overrides: Partial<AttemptLog> = {}): AttemptLog {
  return {
    agent: "TACTICIAN",
    action: "PROPOSE_LEAN_TACTICS",
    success: false,
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeSignals(overrides: Partial<RoutingSignals> = {}): RoutingSignals {
  return {
    totalAttempts: 1,
    consecutiveFailures: 0,
    globalFailures: 0,
    goalCount: 1,
    isStuckInLoop: false,
    lastErrors: [],
    hasArchitectDirective: false,
    ...overrides,
  };
}

describe("End-to-End Routing Integration", () => {

  test("fresh proof → ARCHITECT (proof plan)", () => {
    const signals = buildRoutingSignals([], "", false);
    const role = AgentRouter.determineNextAgent(signals);
    expect(role).toBe("ARCHITECT");
  });

  test("after architect sets directive, next move → TACTICIAN", () => {
    const logs = [
      makeLog({ agent: "ARCHITECT", action: "ARCHITECT_ESCALATION", success: true }),
    ];
    const signals = buildRoutingSignals(logs, "n m : Nat\n⊢ n + m = m + n", true);
    const role = AgentRouter.determineNextAgent(signals);
    expect(role).toBe("TACTICIAN");
  });

  test("tactician fails 3 times → REASONER", () => {
    const logs = [
      makeLog({ agent: "ARCHITECT", success: true }),
      makeLog({ agent: "TACTICIAN", success: false, error: "unknown tactic" }),
      makeLog({ agent: "TACTICIAN", success: false, error: "type mismatch" }),
      makeLog({ agent: "TACTICIAN", success: false, error: "unsolved goals" }),
    ];
    const signals = buildRoutingSignals(logs, "⊢ n + m = m + n", false);
    const role = AgentRouter.determineNextAgent(signals);
    expect(role).toBe("REASONER");
  });

  test("same error repeated → loop detection → REASONER", () => {
    const logs = [
      makeLog({ agent: "ARCHITECT", success: true }),
      makeLog({ agent: "TACTICIAN", success: false, error: "unknown identifier 'omega'" }),
      makeLog({ agent: "TACTICIAN", success: false, error: "unknown identifier 'omega'" }),
    ];
    const signals = buildRoutingSignals(logs, "⊢ n + m = m + n", false);
    const role = AgentRouter.determineNextAgent(signals);
    expect(role).toBe("REASONER");
  });

  test("goal explosion (induction splits to 2 goals) → REASONER", () => {
    const logs = [
      makeLog({ agent: "ARCHITECT", success: true }),
      makeLog({ agent: "TACTICIAN", success: true }),
    ];
    const signals = buildRoutingSignals(logs, "2 goals\ncase zero\ncase succ", false);
    const role = AgentRouter.determineNextAgent(signals);
    expect(role).toBe("REASONER");
  });

  test("6+ global tree failures → ARCHITECT (break glass structural failure)", () => {
    const logs = [
      makeLog({ agent: "ARCHITECT", success: true }),
      makeLog({ agent: "TACTICIAN", success: false }),
      makeLog({ agent: "TACTICIAN", success: false }),
      makeLog({ agent: "REASONER", success: false }),
      makeLog({ agent: "TACTICIAN", success: false }),
      makeLog({ agent: "TACTICIAN", success: false }),
      makeLog({ agent: "TACTICIAN", success: false }),
    ];
    const signals = buildRoutingSignals(logs, "⊢ n + m = m + n", false);
    // Simulate ProofTree.getGlobalTreeFailures() — in production this comes from the tree
    signals.globalFailures = 6;
    const role = AgentRouter.determineNextAgent(signals);
    expect(role).toBe("ARCHITECT");
  });

  test("factory creates correct agent for each routed role", () => {
    const factory = new AgentFactory({ geminiApiKey: "test-key" });
    const signals = makeSignals();

    const tacticianAgent = factory.getAgent("TACTICIAN", signals);
    const reasonerAgent = factory.getAgent("REASONER", signals);
    const architectAgent = factory.getAgent("ARCHITECT", signals);

    expect(tacticianAgent.role).toBe("TACTICIAN");
    expect(reasonerAgent.role).toBe("REASONER");
    expect(architectAgent.role).toBe("ARCHITECT");
  });

  test("success resets failure count → back to TACTICIAN", () => {
    const logs = [
      makeLog({ agent: "ARCHITECT", success: true }),
      makeLog({ agent: "TACTICIAN", success: false }),
      makeLog({ agent: "TACTICIAN", success: false }),
      makeLog({ agent: "REASONER", success: true }), // Reasoner unblocks
      makeLog({ agent: "TACTICIAN", success: false }), // One failure after reset
    ];
    const signals = buildRoutingSignals(logs, "⊢ n + m = m + n", false);
    const role = AgentRouter.determineNextAgent(signals);
    // Only 1 consecutive failure → TACTICIAN
    expect(role).toBe("TACTICIAN");
  });
});
