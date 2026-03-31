/**
 * Hybrid Roster: Gemini Tier Selection Tests (TDD)
 *
 * Tests that the AgentFactory selects the correct Gemini model tier
 * based on RoutingSignals:
 *   - REASONER: < M(4) → 2.5-flash, ≥ M → 3.1-flash-lite
 *   - ARCHITECT: < N(6) → 2.5-flash, ≥ N → 3.1-pro
 */

import { describe, test, expect } from "bun:test";
import { AgentFactory } from "../src/agents/factory";
import type { RoutingSignals } from "../src/types";

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

describe("AgentFactory — Gemini tier based on signals", () => {

  const factory = new AgentFactory({ geminiApiKey: "test-key" });

  test("ARCHITECT at 0 failures → gemini-2.5-flash (free tier)", () => {
    const agent = factory.getAgent("ARCHITECT", makeSignals({ totalAttempts: 0 }));
    expect(agent.role).toBe("ARCHITECT");
    expect((agent as any).modelTier).toBe("gemini-2.5-flash");
  });

  test("ARCHITECT at 5 globalFailures → gemini-2.5-flash (still below N=6)", () => {
    const agent = factory.getAgent("ARCHITECT", makeSignals({ globalFailures: 5 }));
    expect((agent as any).modelTier).toBe("gemini-2.5-flash");
  });

  test("ARCHITECT at N=6 globalFailures → gemini-3.1-pro-preview (break glass)", () => {
    const agent = factory.getAgent("ARCHITECT", makeSignals({ globalFailures: 6 }));
    expect((agent as any).modelTier).toBe("gemini-3.1-pro-preview");
  });

  test("ARCHITECT at 7 globalFailures → still gemini-3.1-pro-preview", () => {
    const agent = factory.getAgent("ARCHITECT", makeSignals({ globalFailures: 7 }));
    expect((agent as any).modelTier).toBe("gemini-3.1-pro-preview");
  });

  test("REASONER at 0 failures → gemini-2.5-flash (free tier)", () => {
    const agent = factory.getAgent("REASONER", makeSignals({ consecutiveFailures: 0 }));
    expect((agent as any).modelTier).toBe("gemini-2.5-flash");
  });

  test("REASONER at 3 failures → gemini-2.5-flash (below M=4)", () => {
    const agent = factory.getAgent("REASONER", makeSignals({ consecutiveFailures: 3 }));
    expect((agent as any).modelTier).toBe("gemini-2.5-flash");
  });

  test("REASONER at M=4 failures → gemini-3.1-flash-lite-preview (paid tier)", () => {
    const agent = factory.getAgent("REASONER", makeSignals({ consecutiveFailures: 4 }));
    expect((agent as any).modelTier).toBe("gemini-3.1-flash-lite-preview");
  });

  test("reads GEMINI_API_KEY from process.env as fallback", () => {
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "env-test-key";
    try {
      const f = new AgentFactory(); // No key in config
      const agent = f.getAgent("ARCHITECT", makeSignals());
      expect(agent.role).toBe("ARCHITECT");
    } finally {
      if (originalKey !== undefined) {
        process.env.GEMINI_API_KEY = originalKey;
      } else {
        delete process.env.GEMINI_API_KEY;
      }
    }
  });
});
