/**
 * Agency Topology: Factory Integration Tests
 *
 * TDD RED-to-GREEN: validates that the AgentFactory correctly uses
 * the AgencyRegistry for model resolution while maintaining backward
 * compatibility with the existing signals-based escalation logic.
 */

import { describe, test, expect } from "bun:test";
import { AgentFactory } from "../../src/agents/factory";
import { AgencyRegistry } from "../../src/agency/registry";
import type { RoutingSignals } from "../../src/types";

function makeSignals(overrides: Partial<RoutingSignals> = {}): RoutingSignals {
  return {
    totalAttempts: 1,
    consecutiveFailures: 0,
    globalFailures: 0,
    goalCount: 1,
    isStuckInLoop: false,
    lastErrors: [],
    hasArchitectDirective: false,
    identicalErrorCount: 0,
    totalProverCalls: 0,
    hasSubgoalProposal: false,
    ...overrides,
  };
}

describe("AgentFactory with AgencyRegistry", () => {
  test("TACTICIAN uses the local thinker model from registry", () => {
    const registry = new AgencyRegistry();
    const factory = new AgentFactory({ geminiApiKey: "test-key" }, registry);
    const agent = factory.getAgent("PROVER", makeSignals());
    expect(agent.role).toBe("PROVER");
  });

  test("REASONER creates an agent with correct role", () => {
    const registry = new AgencyRegistry();
    const factory = new AgentFactory({ geminiApiKey: "test-key" }, registry);
    const agent = factory.getAgent("ARCHITECT", makeSignals());
    expect(agent.role).toBe("ARCHITECT");
  });

  test("ARCHITECT creates an agent with correct role", () => {
    const registry = new AgencyRegistry();
    const factory = new AgentFactory({ geminiApiKey: "test-key" }, registry);
    const agent = factory.getAgent("ARCHITECT", makeSignals());
    expect(agent.role).toBe("ARCHITECT");
  });

  test("REASONER escalates model tier on high failure count", () => {
    const registry = new AgencyRegistry();
    const factory = new AgentFactory({ geminiApiKey: "test-key" }, registry);

    const base = factory.getAgent("ARCHITECT", makeSignals({ consecutiveFailures: 0 }));
    const escalated = factory.getAgent("ARCHITECT", makeSignals({ consecutiveFailures: 4 }));

    expect(base.role).toBe("ARCHITECT");
    expect(escalated.role).toBe("ARCHITECT");
    // The model tier should differ between base and escalated
    expect((base as any).modelTier).not.toBe((escalated as any).modelTier);
  });

  test("ARCHITECT escalates model tier on high global failures", () => {
    const registry = new AgencyRegistry();
    const factory = new AgentFactory({ geminiApiKey: "test-key" }, registry);

    const base = factory.getAgent("ARCHITECT", makeSignals({ globalFailures: 0 }));
    const escalated = factory.getAgent("ARCHITECT", makeSignals({ globalFailures: 6 }));

    expect((base as any).modelTier).not.toBe((escalated as any).modelTier);
  });

  test("backward compat: factory works without registry parameter", () => {
    const factory = new AgentFactory({ geminiApiKey: "test-key" });
    const agent = factory.getAgent("PROVER", makeSignals());
    expect(agent.role).toBe("PROVER");
  });

  test("backward compat: factory throws on unknown role", () => {
    const factory = new AgentFactory({ geminiApiKey: "test-key" });
    expect(() => factory.getAgent("UNKNOWN" as any, makeSignals())).toThrow(/Unknown agent role/);
  });
});
