/**
 * Agency Topology: Registry Resolution Tests
 *
 * TDD RED-to-GREEN: validates that the AgencyRegistry correctly
 * loads agency.json, resolves providers by capability, walks
 * escalation chains, and reads API keys from the environment.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { AgencyRegistry } from "../../src/agency/registry";

describe("AgencyRegistry", () => {
  let registry: AgencyRegistry;

  beforeEach(() => {
    registry = new AgencyRegistry();
  });

  // ── Loading ──

  test("loads agency.json without errors", () => {
    expect(registry).toBeDefined();
  });

  test("lists all 6 providers from agency.json", () => {
    const ids = registry.listProviderIds();
    expect(ids).toContain("L0_thinker");
    expect(ids).toContain("L0_typist");
    expect(ids).toContain("L1_micro");
    expect(ids).toContain("L2_standard");
    expect(ids).toContain("L3_complex");
    expect(ids).toContain("L4_frontier");
    expect(ids.length).toBe(6);
  });

  // ── Provider Access ──

  test("getProvider returns correct model for L0_thinker", () => {
    const provider = registry.getProvider("L0_thinker");
    expect(provider.model).toBe("gemma:4b");
    expect(provider.engine).toBe("ollama");
  });

  test("getProvider returns correct model for L0_typist", () => {
    const provider = registry.getProvider("L0_typist");
    expect(provider.model).toBe("qwen2.5-coder");
    expect(provider.engine).toBe("ollama");
  });

  test("getProvider throws on unknown ID", () => {
    expect(() => registry.getProvider("nonexistent")).toThrow(/not found/);
  });

  test("getModel returns model string", () => {
    expect(registry.getModel("L1_micro")).toBe("gemini-2.5-flash");
  });

  test("getEndpoint returns endpoint for local provider", () => {
    expect(registry.getEndpoint("L0_thinker")).toBe("http://localhost:11434");
  });

  // ── Capability Resolution ──

  test("resolves 'reasoning' capability to L0_thinker when preferLocal=true", () => {
    const provider = registry.resolveProvider("reasoning", true);
    expect(provider.engine).toBe("ollama");
    expect(provider.model).toBe("gemma:4b");
  });

  test("resolves 'python' capability to L0_typist when preferLocal=true", () => {
    const provider = registry.resolveProvider("python", true);
    expect(provider.engine).toBe("ollama");
    expect(provider.model).toBe("qwen2.5-coder");
  });

  test("resolves 'reasoning' to a cloud provider when preferLocal=false", () => {
    const provider = registry.resolveProvider("reasoning", false);
    expect(provider.engine).toBe("gemini");
  });

  test("resolves 'latex' capability (only cloud providers have it)", () => {
    const provider = registry.resolveProvider("latex");
    expect(provider.engine).toBe("gemini");
  });

  test("resolves 'bash' capability to L0_typist (only local has it)", () => {
    const provider = registry.resolveProvider("bash", true);
    expect(provider.model).toBe("qwen2.5-coder");
  });

  test("throws when no provider has the requested capability", () => {
    expect(() => registry.resolveProvider("quantum_telepathy" as any)).toThrow(/No provider supports/);
  });

  // ── Escalation ──

  test("escalationLevel=1 skips the first provider", () => {
    const base = registry.resolveProvider("reasoning", true, 0);
    const escalated = registry.resolveProvider("reasoning", true, 1);
    expect(base.model).not.toBe(escalated.model);
  });

  test("escalation chain for L0_thinker includes L1_micro", () => {
    const chain = registry.getEscalationChain("L0_thinker");
    expect(chain).toContain("L1_micro");
  });

  test("escalation chain for L1_micro includes L2_standard", () => {
    const chain = registry.getEscalationChain("L1_micro");
    expect(chain).toContain("L2_standard");
  });

  test("escalation chain for L4_frontier is empty (terminal)", () => {
    const chain = registry.getEscalationChain("L4_frontier");
    expect(chain.length).toBe(0);
  });

  // ── API Key Resolution ──

  test("getApiKey reads from process.env", () => {
    const original = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-key-abc";
    try {
      const key = registry.getApiKey("L1_micro");
      expect(key).toBe("test-key-abc");
    } finally {
      if (original !== undefined) process.env.GEMINI_API_KEY = original;
      else delete process.env.GEMINI_API_KEY;
    }
  });

  test("getApiKey throws when env var is not set", () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      expect(() => registry.getApiKey("L1_micro")).toThrow(/not set/);
    } finally {
      if (original !== undefined) process.env.GEMINI_API_KEY = original;
    }
  });

  test("getApiKey throws for local provider without api_env_var", () => {
    expect(() => registry.getApiKey("L0_thinker")).toThrow(/no api_env_var/);
  });

  // ── Config Properties ──

  test("maxParseRetries returns configured value", () => {
    expect(registry.maxParseRetries).toBe(2);
  });

  test("escalationPolicy returns configured value", () => {
    expect(registry.escalationPolicy).toBe("sequential_chain");
  });
});
