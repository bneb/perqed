/**
 * tests/conjecturer_with_evidence.test.ts — ConjecturerAgent evidence injection
 *
 * Tests the updated ConjecturerAgent.generateConjectures() signature which
 * accepts an optional EvidenceReport to ground conjectures in empirical data.
 *
 * Uses globalThis.fetch mocking (project standard).
 */

import { describe, test, expect, afterEach } from "bun:test";
import { ConjecturerAgent, type Conjecture } from "../src/agents/conjecturer";
import type { EvidenceReport } from "../src/agents/research_types";
import { geminiResponseMock, geminiCapturingMock, geminiEmptyMock } from "./helpers/fetch_mock";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const MOCK_CONJECTURES: Conjecture[] = [
  {
    name: "prime_gap_bound",
    signature: "theorem prime_gap_bound (n : Nat) (h : n > 2) : ∃ p, Nat.Prime p ∧ n < p ∧ p < 2 * n",
    description: "A constructive version of Bertrand's postulate.",
  },
  {
    name: "spectral_radius_bound",
    signature: "theorem spectral_radius_bound (G : SimpleGraph V) : G.spectralRadius ≤ G.maxDegree",
    description: "Upper bound on spectral radius in terms of maximum degree.",
  },
];

function stubEvidence(overrides: Partial<EvidenceReport> = {}): EvidenceReport {
  return {
    hypothesis: "Prime gaps grow slower than logarithmically.",
    results: [],
    synthesis: "Analytic number theory domain showed strong signal.",
    anomalies: ["analytic_number_theory"],
    kills: ["algebraic_topology"],
    ...overrides,
  };
}

// ── Without evidence (existing contract) ─────────────────────────────────────

describe("ConjecturerAgent — without evidence (baseline)", () => {
  test("generateConjectures parses Gemini JSON response", async () => {
    globalThis.fetch = geminiResponseMock(MOCK_CONJECTURES);

    const agent = new ConjecturerAgent("test-key");
    const results = await agent.generateConjectures("Some arXiv literature context");

    expect(results).toHaveLength(2);
    expect(results[0]!.name).toBe("prime_gap_bound");
    expect(results[1]!.signature).toContain("spectralRadius");
  });

  test("all returned conjectures have non-empty name, signature, description", async () => {
    globalThis.fetch = geminiResponseMock(MOCK_CONJECTURES);

    const agent = new ConjecturerAgent("test-key");
    const results = await agent.generateConjectures("Literature context");

    for (const c of results) {
      expect(typeof c.name).toBe("string");
      expect(c.name.length).toBeGreaterThan(0);
      expect(typeof c.signature).toBe("string");
      expect(c.signature.length).toBeGreaterThan(0);
      expect(typeof c.description).toBe("string");
      expect(c.description.length).toBeGreaterThan(0);
    }
  });

  test("prompt includes the literature context string", async () => {
    const UNIQUE_CONTEXT = "UNIQUE_LITERATURE_CONTEXT_99999";
    const { fetch, capturedBodies } = geminiCapturingMock([MOCK_CONJECTURES]);
    globalThis.fetch = fetch;

    const agent = new ConjecturerAgent("test-key");
    await agent.generateConjectures(UNIQUE_CONTEXT);

    expect(capturedBodies[0]).toContain(UNIQUE_CONTEXT);
  });

  test("evidence parameter is optional — omitting it does not throw", async () => {
    globalThis.fetch = geminiResponseMock(MOCK_CONJECTURES);

    const agent = new ConjecturerAgent("test-key");
    // Should not throw when evidence is undefined
    const results = await agent.generateConjectures("some context");
    expect(Array.isArray(results)).toBe(true);
  });
});

// ── With evidence injection ────────────────────────────────────────────────────

describe("ConjecturerAgent — with EvidenceReport injection", () => {
  test("prompt includes the evidence synthesis when evidence is provided", async () => {
    const UNIQUE_SYNTHESIS = "UNIQUE_SYNTHESIS_STRING_ABCDEF_55555";
    const { fetch, capturedBodies } = geminiCapturingMock([MOCK_CONJECTURES]);
    globalThis.fetch = fetch;

    const evidence = stubEvidence({ synthesis: UNIQUE_SYNTHESIS });
    const agent = new ConjecturerAgent("test-key");
    await agent.generateConjectures("some context", evidence);

    expect(capturedBodies[0]).toContain(UNIQUE_SYNTHESIS);
  });

  test("prompt includes anomaly domain names from evidence", async () => {
    const UNIQUE_ANOMALY = "UNIQUE_ANOMALY_DOMAIN_XYZ_77777";
    const { fetch, capturedBodies } = geminiCapturingMock([MOCK_CONJECTURES]);
    globalThis.fetch = fetch;

    const evidence = stubEvidence({ anomalies: [UNIQUE_ANOMALY] });
    const agent = new ConjecturerAgent("test-key");
    await agent.generateConjectures("some context", evidence);

    expect(capturedBodies[0]).toContain(UNIQUE_ANOMALY);
  });

  test("prompt includes kill domain names from evidence", async () => {
    const UNIQUE_KILL = "UNIQUE_KILL_DOMAIN_ZZZ_88888";
    const { fetch, capturedBodies } = geminiCapturingMock([MOCK_CONJECTURES]);
    globalThis.fetch = fetch;

    const evidence = stubEvidence({ kills: [UNIQUE_KILL] });
    const agent = new ConjecturerAgent("test-key");
    await agent.generateConjectures("some context", evidence);

    expect(capturedBodies[0]).toContain(UNIQUE_KILL);
  });

  test("prompt includes both literature context AND evidence when both provided", async () => {
    const UNIQUE_CONTEXT = "CONTEXT_STRING_11111";
    const UNIQUE_SYNTHESIS = "SYNTHESIS_STRING_22222";
    const { fetch, capturedBodies } = geminiCapturingMock([MOCK_CONJECTURES]);
    globalThis.fetch = fetch;

    const evidence = stubEvidence({ synthesis: UNIQUE_SYNTHESIS });
    const agent = new ConjecturerAgent("test-key");
    await agent.generateConjectures(UNIQUE_CONTEXT, evidence);

    expect(capturedBodies[0]).toContain(UNIQUE_CONTEXT);
    expect(capturedBodies[0]).toContain(UNIQUE_SYNTHESIS);
  });

  test("evidence section absent from prompt when evidence not provided", async () => {
    const EVIDENCE_MARKER = "Empirical Investigation Results";
    const { fetch, capturedBodies } = geminiCapturingMock([MOCK_CONJECTURES]);
    globalThis.fetch = fetch;

    const agent = new ConjecturerAgent("test-key");
    await agent.generateConjectures("some context"  /* no evidence */);

    // The evidence section header should not appear
    expect(capturedBodies[0]).not.toContain(EVIDENCE_MARKER);
  });

  test("evidence section present in prompt when evidence IS provided", async () => {
    const EVIDENCE_MARKER = "Empirical Investigation Results";
    const { fetch, capturedBodies } = geminiCapturingMock([MOCK_CONJECTURES]);
    globalThis.fetch = fetch;

    const agent = new ConjecturerAgent("test-key");
    await agent.generateConjectures("some context", stubEvidence());

    expect(capturedBodies[0]).toContain(EVIDENCE_MARKER);
  });

  test("empty anomalies/kills lists are handled without throwing", async () => {
    const { fetch } = geminiCapturingMock([MOCK_CONJECTURES]);
    globalThis.fetch = fetch;

    const evidence = stubEvidence({ anomalies: [], kills: [] });
    const agent = new ConjecturerAgent("test-key");

    // Should not throw
    const results = await agent.generateConjectures("some context", evidence);
    expect(Array.isArray(results)).toBe(true);
  });
});

// ── Error handling ─────────────────────────────────────────────────────────────

describe("ConjecturerAgent — error handling", () => {
  test("throws when Gemini returns empty candidates", async () => {
    globalThis.fetch = geminiEmptyMock();

    const agent = new ConjecturerAgent("test-key");
    let threw = false;
    try {
      await agent.generateConjectures("some context");
    } catch (e: any) {
      threw = true;
      expect(e.message).toBeTruthy();
    }
    expect(threw).toBe(true);
  });
});
