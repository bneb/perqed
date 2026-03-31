/**
 * Hybrid Roster: AgentFactory Tests
 *
 * Tests factory instantiation with the new signals-based API.
 * getAgent() now takes RoutingSignals to select Gemini tier.
 */

import { describe, test, expect } from "bun:test";
import { AgentFactory } from "../src/agents/factory";
import type { RoutingSignals } from "../src/types";

// Helper: build default signals
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
    totalTacticianCalls: 0,
    ...overrides,
  };
}

describe("AgentFactory — getAgent()", () => {

  test("creates TACTICIAN with correct role", () => {
    const factory = new AgentFactory();
    const agent = factory.getAgent("TACTICIAN", makeSignals());
    expect(agent.role).toBe("TACTICIAN");
  });

  test("creates REASONER with correct role when API key provided", () => {
    const factory = new AgentFactory({ geminiApiKey: "test-key-123" });
    const agent = factory.getAgent("REASONER", makeSignals());
    expect(agent.role).toBe("REASONER");
  });

  test("creates ARCHITECT with correct role when API key provided", () => {
    const factory = new AgentFactory({ geminiApiKey: "test-key-123" });
    const agent = factory.getAgent("ARCHITECT", makeSignals());
    expect(agent.role).toBe("ARCHITECT");
  });

  test("throws on ARCHITECT when no API key provided", () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const factory = new AgentFactory();
      expect(() => factory.getAgent("ARCHITECT", makeSignals())).toThrow(/Gemini API key/);
    } finally {
      if (originalKey !== undefined) {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });

  test("throws on REASONER when no API key provided", () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const factory = new AgentFactory();
      expect(() => factory.getAgent("REASONER", makeSignals())).toThrow(/Gemini API key/);
    } finally {
      if (originalKey !== undefined) {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });

  test("throws on unknown role", () => {
    const factory = new AgentFactory();
    expect(() => factory.getAgent("UNKNOWN" as any, makeSignals())).toThrow(/Unknown agent role/);
  });

  test("TACTICIAN and REASONER are distinct agents", () => {
    const factory = new AgentFactory({ geminiApiKey: "test-key" });
    const tactician = factory.getAgent("TACTICIAN", makeSignals());
    const reasoner = factory.getAgent("REASONER", makeSignals());
    expect(tactician.role).not.toBe(reasoner.role);
  });

  test("accepts custom Ollama endpoint", () => {
    const factory = new AgentFactory({ ollamaEndpoint: "http://gpu-box:11434" });
    const agent = factory.getAgent("TACTICIAN", makeSignals());
    expect(agent.role).toBe("TACTICIAN");
  });
});
