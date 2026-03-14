/**
 * Sprint 8: AgentFactory Tests (TDD)
 *
 * Tests factory instantiation, role configuration,
 * and error handling for missing API keys.
 */

import { describe, test, expect } from "bun:test";
import { AgentFactory } from "../src/agents/factory";

describe("AgentFactory — getAgent()", () => {

  test("creates TACTICIAN with correct role", () => {
    const factory = new AgentFactory();
    const agent = factory.getAgent("TACTICIAN");
    expect(agent.role).toBe("TACTICIAN");
  });

  test("creates REASONER with correct role", () => {
    const factory = new AgentFactory();
    const agent = factory.getAgent("REASONER");
    expect(agent.role).toBe("REASONER");
  });

  test("creates ARCHITECT with correct role when API key provided", () => {
    const factory = new AgentFactory({ geminiApiKey: "test-key-123" });
    const agent = factory.getAgent("ARCHITECT");
    expect(agent.role).toBe("ARCHITECT");
  });

  test("throws on ARCHITECT when no API key provided", () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const factory = new AgentFactory();
      expect(() => factory.getAgent("ARCHITECT")).toThrow(/Gemini API key/);
    } finally {
      if (originalKey !== undefined) {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });

  test("throws on unknown role", () => {
    const factory = new AgentFactory();
    expect(() => factory.getAgent("UNKNOWN" as any)).toThrow(/Unknown agent role/);
  });

  test("TACTICIAN and REASONER are distinct agents", () => {
    const factory = new AgentFactory();
    const tactician = factory.getAgent("TACTICIAN");
    const reasoner = factory.getAgent("REASONER");
    expect(tactician.role).not.toBe(reasoner.role);
  });

  test("accepts custom Ollama endpoint", () => {
    // Should not throw — just verifying construction succeeds
    const factory = new AgentFactory({ ollamaEndpoint: "http://gpu-box:11434" });
    const agent = factory.getAgent("TACTICIAN");
    expect(agent.role).toBe("TACTICIAN");
  });
});
