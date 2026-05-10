import { expect, test, describe } from "bun:test";
import { ArchitectClient, WILES_OPF_PROMPT, WILES_OPF_PROMPT_DIRECT } from "../src/architect_client";
import type { ProofDAG } from "../src/proof_dag/schemas";

describe("Architect Prompt Formatting", () => {
  test("WILES_OPF_PROMPT contains the formatting rules", () => {
    expect(WILES_OPF_PROMPT).toContain("STEP 5 - THE ALGEBRAIC BUILDER");
    expect(WILES_OPF_PROMPT).toContain("algebraic_graph_construction");
    expect(WILES_OPF_PROMPT).toContain("algebraic_partition_construction");
  });

  // ── WILES_OPF_PROMPT_DIRECT: Topology Selection ─────────────────────────────

  test("WILES_OPF_PROMPT_DIRECT teaches TOPOLOGY SELECTION", () => {
    expect(WILES_OPF_PROMPT_DIRECT).toContain("TOPOLOGY SELECTION");
    expect(WILES_OPF_PROMPT_DIRECT).toContain("algebraic_graph_construction");
    expect(WILES_OPF_PROMPT_DIRECT).toContain("algebraic_partition_construction");
  });

  test("WILES_OPF_PROMPT_DIRECT includes partition_rule_js format rules", () => {
    expect(WILES_OPF_PROMPT_DIRECT).toContain("partition_rule_js");
    expect(WILES_OPF_PROMPT_DIRECT).toContain("domain_size");
    expect(WILES_OPF_PROMPT_DIRECT).toContain("num_partitions");
  });

  test("WILES_OPF_PROMPT_DIRECT includes a concrete partition few-shot example", () => {
    expect(WILES_OPF_PROMPT_DIRECT).toContain("PARTITION EXAMPLE");
    expect(WILES_OPF_PROMPT_DIRECT).toContain("537");
  });

  test("WILES_OPF_PROMPT_DIRECT body-only rule references BOTH topology types", () => {
    expect(WILES_OPF_PROMPT_DIRECT).toContain("BOTH");
  });

  // ── WILES_OPF_PROMPT: Step 5 topology choice ─────────────────────────────

  test("WILES_OPF_PROMPT Step 5 teaches topology selection", () => {
    expect(WILES_OPF_PROMPT).toContain("TOPOLOGY");
    expect(WILES_OPF_PROMPT).toContain("algebraic_partition_construction");
    expect(WILES_OPF_PROMPT).toContain("algebraic_graph_construction");
  });

  test("WILES_OPF_PROMPT explicitly warns about Schur as partition problem", () => {
    expect(WILES_OPF_PROMPT).toContain("Schur");
    expect(WILES_OPF_PROMPT).toContain("partition_rule_js");
    expect(WILES_OPF_PROMPT).toContain("IMPORTANT");
  });

  // ── replanDAG: kind enum and partition example in schema ─────────────────────

  test("replanDAG injects EXPLOITATION vs EXPLORATION constraints", async () => {
    const ai = new ArchitectClient({ apiKey: "test", model: "test" });
    const mockDag: ProofDAG = {
      id: "mock",
      goal: "Test Goal",
      createdAt: new Date().toISOString(),
      nodes: []
    };

    let capturedBody = "";
    const originalFetch = global.fetch;

    global.fetch = (async (_url: any, options: any) => {
      if (options && typeof options.body === "string") capturedBody = options.body;
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "{\"id\": \"mock\", \"goal\": \"Test Goal\", \"nodes\": [{\"id\":\"n1\",\"kind\":\"calculate_degrees_of_freedom\",\"config\":{\"vertices\":10,\"edge_rule_js\":\"return true\"}}]}" }] } }]
        })
      } as any;
    }) as unknown as typeof fetch;

    try {
      await ai.replanDAG(mockDag, "journal content", "EXPLOITATION");
      expect(capturedBody).toContain("ATOMIC MUTATION");
      expect(capturedBody).toContain("MUST NOT exceed 2 sentences");

      await ai.replanDAG(mockDag, "journal content", "EXPLORATION");
      expect(capturedBody).toContain("exploring barren space");
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("replanDAG kind enum includes algebraic_partition_construction", async () => {
    const ai = new ArchitectClient({ apiKey: "test", model: "test" });
    const mockDag: ProofDAG = {
      id: "mock",
      goal: "Test Goal",
      createdAt: new Date().toISOString(),
      nodes: []
    };

    let capturedBody = "";
    const originalFetch = global.fetch;

    global.fetch = (async (_url: any, options: any) => {
      if (options && typeof options.body === "string") capturedBody = options.body;
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "{\"id\": \"r\", \"goal\": \"Test Goal\", \"nodes\": [{\"id\":\"n1\",\"kind\":\"query_literature\",\"config\":{\"search_term\":\"schur\"}}]}" }] } }]
        })
      } as any;
    }) as unknown as typeof fetch;

    try {
      await ai.replanDAG(mockDag, "journal content");
      expect(capturedBody).toContain("algebraic_partition_construction");
      expect(capturedBody).toContain("algebraic_graph_construction");
      expect(capturedBody).toContain("domain_size");
      expect(capturedBody).toContain("partition_rule_js");
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("formulateAlgebraicRule injects EXPLOITATION vs EXPLORATION constraints", async () => {
    const ai = new ArchitectClient({ apiKey: "test", model: "test" });

    let capturedBody = "";
    const originalFetch = global.fetch;

    global.fetch = (async (_url: any, options: any) => {
      if (options && typeof options.body === "string") capturedBody = options.body;
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "{\"description\":\"test\",\"vertices\":10,\"edge_rule_js\":\"return true\"}" }] } }]
        })
      } as any;
    }) as unknown as typeof fetch;

    try {
      await ai.formulateAlgebraicRule("Test Goal", "journal content", "EXPLOITATION");
      expect(capturedBody).toContain("ATOMIC MUTATION");

      await ai.formulateAlgebraicRule("Test Goal", "journal content", "EXPLORATION");
      expect(capturedBody).not.toContain("ATOMIC MUTATION");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
