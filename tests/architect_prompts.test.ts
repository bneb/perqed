import { expect, test, describe } from "bun:test";
import { ArchitectClient, WILES_OPF_PROMPT, WILES_OPF_PROMPT_DIRECT } from "../src/architect_client";
import type { ProofDAG } from "../src/proof_dag/schemas";

describe("Architect Prompt Formatting", () => {
  test("WILES_OPF_PROMPT contains the formatting rules", () => {
    expect(WILES_OPF_PROMPT).toContain("CRITICAL JS FORMAT RULES:");
    expect(WILES_OPF_PROMPT).toContain("function(i, j)");
    expect(WILES_OPF_PROMPT).toContain("Output ONLY the raw logic body");
    expect(WILES_OPF_PROMPT).toContain("raw logic body");
    expect(WILES_OPF_PROMPT).toContain("MAXIMUM of 3 sentences");
  });

  test("WILES_OPF_PROMPT_DIRECT contains the formatting rules", () => {
    expect(WILES_OPF_PROMPT_DIRECT).toContain("CRITICAL JS FORMAT RULES:");
    expect(WILES_OPF_PROMPT_DIRECT).toContain("function(i, j)");
    expect(WILES_OPF_PROMPT_DIRECT).toContain("raw logic body");
    expect(WILES_OPF_PROMPT_DIRECT).toContain("MAXIMUM of 3 sentences");
  });

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
    
    // Mock fetch to capture the injected prompt
    global.fetch = (async (url: any, options: any) => {
      if (options && typeof options.body === "string") {
        capturedBody = options.body;
      }
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
      global.fetch = originalFetch; // Restore
    }
  });
});
