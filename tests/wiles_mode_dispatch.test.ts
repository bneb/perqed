/**
 * wiles_mode_dispatch.test.ts — RED-to-GREEN tests for problem-class-aware Wiles Mode
 *
 * Validates that WILES_OPF_PROMPT and WILES_OPF_PROMPT_DIRECT contain correct
 * routing instructions for both graph and partition problem classes.
 */
import { describe, expect, it } from "bun:test";
import { WILES_OPF_PROMPT, WILES_OPF_PROMPT_DIRECT } from "../src/architect_client";

describe("WILES_OPF_PROMPT — partition support", () => {
  it("mentions algebraic_partition_construction as a node kind", () => {
    expect(WILES_OPF_PROMPT).toContain("algebraic_partition_construction");
  });

  it("mentions partition_rule_js as the partition config key", () => {
    expect(WILES_OPF_PROMPT).toContain("partition_rule_js");
  });

  it("explicitly calls out Schur numbers as a partition problem", () => {
    expect(WILES_OPF_PROMPT).toMatch(/[Ss]chur/);
  });

  it("provides a concrete partition example with domain_size and num_partitions", () => {
    expect(WILES_OPF_PROMPT).toContain("domain_size");
    expect(WILES_OPF_PROMPT).toContain("num_partitions");
  });
});

describe("WILES_OPF_PROMPT_DIRECT — partition support", () => {
  it("mentions algebraic_partition_construction", () => {
    expect(WILES_OPF_PROMPT_DIRECT).toContain("algebraic_partition_construction");
  });

  it("mentions partition_rule_js", () => {
    expect(WILES_OPF_PROMPT_DIRECT).toContain("partition_rule_js");
  });

  it("mentions Schur or integer partitioning", () => {
    expect(WILES_OPF_PROMPT_DIRECT).toMatch(/[Ss]chur|integer.*partition|partition.*integer/);
  });

  it("provides a partition example with domain_size", () => {
    expect(WILES_OPF_PROMPT_DIRECT).toContain("domain_size");
  });

  it("exploitation prompt is NOT hardcoded to edge_rule_js only", () => {
    // The exploitation prompt used when cognitive mode is EXPLOITATION must mention
    // both edge_rule_js (graphs) and partition_rule_js (partitions) — or be generic.
    // It must NOT only say "Retrieve the edge_rule_js" which would confuse Schur runs.
    // We check that it doesn't contain ONLY edge_rule_js without also mentioning partition.
    // This is a documentation/prompt invariant test.
    const prompt = WILES_OPF_PROMPT_DIRECT;
    // If edge_rule_js appears, partition_rule_js must also appear (balanced treatment)
    if (prompt.includes("edge_rule_js")) {
      expect(prompt).toContain("partition_rule_js");
    }
  });
});
