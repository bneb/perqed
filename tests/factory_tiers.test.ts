/**
 * Hybrid Roster: Factory Tier Selection Tests (TDD RED)
 *
 * Verifies that the AgentFactory selects the correct Gemini model tier
 * based on RoutingSignals thresholds:
 *   M=4: Advance Flash (gemini-3.1-flash-lite-preview)
 *   N=6: Break Glass Pro (gemini-3.1-pro-preview)
 */

import { describe, test, expect } from "bun:test";
import { AgentFactory } from "../src/agents/factory";
import type { RoutingSignals } from "../src/types";

// ──────────────────────────────────────────────
// Helper: build RoutingSignals with overrides
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
// Factory Tier Selection
// ──────────────────────────────────────────────

describe("AgentFactory Tier Selection", () => {
  const factory = new AgentFactory({
    geminiApiKey: "test-key-123",
  });

  // ── TACTICIAN: Always local ──

  test("TACTICIAN is always local FormalistAgent", () => {
    const agent = factory.getAgent("TACTICIAN", makeSignals());
    expect(agent.role).toBe("TACTICIAN");
  });

  // ── REASONER: Free → Paid Flash ──

  test("REASONER at 3 failures → gemini-2.5-flash (free tier)", () => {
    const agent = factory.getAgent("REASONER", makeSignals({ consecutiveFailures: 3 }));
    expect(agent.role).toBe("REASONER");
    // Verify it's the free tier model
    expect((agent as any).modelTier).toBe("gemini-2.5-flash");
  });

  test("REASONER at M=4 failures → gemini-3.1-flash-lite-preview (paid tier)", () => {
    const agent = factory.getAgent("REASONER", makeSignals({ consecutiveFailures: 4 }));
    expect(agent.role).toBe("REASONER");
    expect((agent as any).modelTier).toBe("gemini-3.1-flash-lite-preview");
  });

  // ── ARCHITECT: Free → Pro ──

  test("ARCHITECT at 0 globalFailures → gemini-2.5-flash (free tier)", () => {
    const agent = factory.getAgent("ARCHITECT", makeSignals({ globalFailures: 0 }));
    expect(agent.role).toBe("ARCHITECT");
    expect((agent as any).modelTier).toBe("gemini-2.5-flash");
  });

  test("ARCHITECT at N=6 globalFailures → gemini-3.1-pro-preview (break glass)", () => {
    const agent = factory.getAgent("ARCHITECT", makeSignals({ globalFailures: 6 }));
    expect(agent.role).toBe("ARCHITECT");
    expect((agent as any).modelTier).toBe("gemini-3.1-pro-preview");
  });

  // ── Edge cases ──

  test("REASONER without API key throws", () => {
    const savedKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const noKeyFactory = new AgentFactory({});
      expect(() => noKeyFactory.getAgent("REASONER", makeSignals())).toThrow("GEMINI_API_KEY");
    } finally {
      if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
    }
  });

  test("ARCHITECT without API key throws", () => {
    const savedKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const noKeyFactory = new AgentFactory({});
      expect(() => noKeyFactory.getAgent("ARCHITECT", makeSignals())).toThrow("GEMINI_API_KEY");
    } finally {
      if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
    }
  });
});
