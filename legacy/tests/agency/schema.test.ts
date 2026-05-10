/**
 * Agency Topology: Schema Validation Tests
 *
 * TDD RED-to-GREEN: validates that the Zod schemas correctly enforce
 * the agency topology structure, rejecting invalid configurations.
 */

import { describe, test, expect } from "bun:test";
import { AgencyTopologySchema, ProviderSchema, CapabilityTag } from "../../src/agency/schema";
import { readFileSync } from "node:fs";

describe("AgencyTopology Schema", () => {
  test("validates a minimal valid topology", () => {
    const config = {
      agency_topology: {
        default_tier: "L0",
        escalation_policy: "sequential_chain",
        max_parse_retries: 2,
        providers: {
          L0_thinker: {
            engine: "ollama",
            model: "gemma:4b",
            endpoint: "http://localhost:11434",
            capabilities: ["reasoning", "lean4"],
          },
        },
      },
    };
    expect(() => AgencyTopologySchema.parse(config)).not.toThrow();
  });

  test("rejects unknown engine type", () => {
    const config = {
      agency_topology: {
        default_tier: "L0",
        providers: {
          bad: { engine: "gpt4all", model: "foo", capabilities: ["chat"] },
        },
      },
    };
    expect(() => AgencyTopologySchema.parse(config)).toThrow();
  });

  test("rejects unknown capability tag", () => {
    const config = {
      agency_topology: {
        default_tier: "L0",
        providers: {
          bad: { engine: "ollama", model: "foo", capabilities: ["quantum_telepathy"] },
        },
      },
    };
    expect(() => AgencyTopologySchema.parse(config)).toThrow();
  });

  test("applies defaults for escalation_policy and max_parse_retries", () => {
    const config = {
      agency_topology: {
        default_tier: "L0",
        providers: {
          L0: { engine: "ollama", model: "test", capabilities: ["chat"] },
        },
      },
    };
    const parsed = AgencyTopologySchema.parse(config);
    expect(parsed.agency_topology.escalation_policy).toBe("sequential_chain");
    expect(parsed.agency_topology.max_parse_retries).toBe(2);
  });

  test("validates the full agency.json file", () => {
    const raw = JSON.parse(readFileSync("agency.json", "utf8"));
    const result = AgencyTopologySchema.safeParse(raw);
    expect(result.success).toBe(true);
  });

  test("rejects provider with temperature out of range", () => {
    const config = {
      agency_topology: {
        default_tier: "L0",
        providers: {
          bad: { engine: "ollama", model: "test", capabilities: ["chat"], temperature: 5.0 },
        },
      },
    };
    expect(() => AgencyTopologySchema.parse(config)).toThrow();
  });

  test("allows provider with valid temperature", () => {
    const config = {
      agency_topology: {
        default_tier: "L0",
        providers: {
          good: { engine: "ollama", model: "test", capabilities: ["chat"], temperature: 0.7 },
        },
      },
    };
    expect(() => AgencyTopologySchema.parse(config)).not.toThrow();
  });

  test("defaults fallback_for to empty array", () => {
    const config = {
      agency_topology: {
        default_tier: "L0",
        providers: {
          L0: { engine: "ollama", model: "test", capabilities: ["chat"] },
        },
      },
    };
    const parsed = AgencyTopologySchema.parse(config);
    expect(parsed.agency_topology.providers.L0!.fallback_for).toEqual([]);
  });

  test("accepts all valid capability tags", () => {
    const allCaps = [
      "reasoning", "lean4", "chat", "bash", "file_edit",
      "python", "latex", "conjecture", "red_team", "formalization", "compilation",
    ];
    const config = {
      agency_topology: {
        default_tier: "L0",
        providers: {
          all: { engine: "gemini", model: "test", capabilities: allCaps },
        },
      },
    };
    expect(() => AgencyTopologySchema.parse(config)).not.toThrow();
  });

  test("accepts all valid engine types", () => {
    for (const engine of ["ollama", "gemini", "gemini_rest", "openai_compat"]) {
      const config = {
        agency_topology: {
          default_tier: "L0",
          providers: {
            test: { engine, model: "test", capabilities: ["chat"] },
          },
        },
      };
      expect(() => AgencyTopologySchema.parse(config)).not.toThrow();
    }
  });
});
