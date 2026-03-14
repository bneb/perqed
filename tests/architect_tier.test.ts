/**
 * Sprint 8b: Architect Tier Tests (TDD — RED first)
 *
 * Tests that the router can distinguish between Flash (light)
 * and Pro (heavy) Architect tiers based on failure severity.
 */

import { describe, test, expect } from "bun:test";
import { AgentRouter } from "../src/agents/router";
import { AgentFactory } from "../src/agents/factory";
import type { RoutingSignals } from "../src/types";

function makeSignals(overrides: Partial<RoutingSignals> = {}): RoutingSignals {
  return {
    totalAttempts: 5,
    consecutiveFailures: 0,
    goalCount: 1,
    isStuckInLoop: false,
    lastErrors: [],
    hasArchitectDirective: false,
    ...overrides,
  };
}

describe("AgentRouter — determineArchitectTier()", () => {

  test("returns FLASH for initial proof plan (0 attempts)", () => {
    const signals = makeSignals({ totalAttempts: 0 });
    expect(AgentRouter.determineArchitectTier(signals)).toBe("FLASH");
  });

  test("returns PRO for 5+ consecutive failures (structural rethink)", () => {
    const signals = makeSignals({ consecutiveFailures: 5 });
    expect(AgentRouter.determineArchitectTier(signals)).toBe("PRO");
  });

  test("returns PRO for 7 consecutive failures", () => {
    const signals = makeSignals({ consecutiveFailures: 7 });
    expect(AgentRouter.determineArchitectTier(signals)).toBe("PRO");
  });

  test("returns FLASH when called for non-ARCHITECT role (fallback)", () => {
    // If something unexpected routes here with low failures, default to cheap
    const signals = makeSignals({ consecutiveFailures: 2 });
    expect(AgentRouter.determineArchitectTier(signals)).toBe("FLASH");
  });
});

describe("AgentFactory — Architect tier selection", () => {

  test("creates Flash architect with correct role", () => {
    const factory = new AgentFactory({ geminiApiKey: "test-key" });
    const agent = factory.getAgent("ARCHITECT", "FLASH");
    expect(agent.role).toBe("ARCHITECT");
  });

  test("creates Pro architect with correct role", () => {
    const factory = new AgentFactory({ geminiApiKey: "test-key" });
    const agent = factory.getAgent("ARCHITECT", "PRO");
    expect(agent.role).toBe("ARCHITECT");
  });

  test("defaults to Flash when no tier specified", () => {
    const factory = new AgentFactory({ geminiApiKey: "test-key" });
    // Should not throw — defaults to flash
    const agent = factory.getAgent("ARCHITECT");
    expect(agent.role).toBe("ARCHITECT");
  });

  test("reads GEMINI_API_KEY from process.env as fallback", () => {
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "env-test-key";
    try {
      const factory = new AgentFactory(); // No key in config
      const agent = factory.getAgent("ARCHITECT");
      expect(agent.role).toBe("ARCHITECT");
    } finally {
      // Restore
      if (originalKey !== undefined) {
        process.env.GEMINI_API_KEY = originalKey;
      } else {
        delete process.env.GEMINI_API_KEY;
      }
    }
  });
});
