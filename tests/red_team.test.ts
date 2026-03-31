/**
 * tests/red_team.test.ts — RedTeamAuditor (TDD RED → GREEN)
 *
 * Covers: verdict contracts, multi-round WEAKEN loops, exhaustion,
 * malformed API responses, evidence-in-prompt contract.
 */

import { describe, test, expect, afterEach } from "bun:test";
import { RedTeamAuditor } from "../src/agents/red_team";
import type { EvidenceReport } from "../src/agents/research_types";
import {
  geminiResponseMock,
  geminiBlankTextMock,
  geminiEmptyMock,
  geminiCapturingMock,
} from "./helpers/fetch_mock";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubEvidence(overrides: Partial<EvidenceReport> = {}): EvidenceReport {
  return {
    hypothesis: "For all prime p > 2, p is odd.",
    results: [],
    synthesis: "All domains produced consistent results.",
    anomalies: [],
    kills: ["complex_analysis", "algebraic_topology"],
    ...overrides,
  };
}

const STUB_CONJECTURE = {
  signature: "theorem test_theorem (n : Nat) : n + 0 = n",
  description: "A test conjecture about natural number addition.",
};

// ── APPROVE ───────────────────────────────────────────────────────────────────

describe("RedTeamAuditor — APPROVE verdict", () => {
  test("returns APPROVE on round 1 when API says APPROVE", async () => {
    globalThis.fetch = geminiResponseMock({
      verdict: "APPROVE",
      rationale: "Well-scoped and empirically supported.",
    });

    const auditor = new RedTeamAuditor({ apiKey: "test-key" });
    const { final, history } = await auditor.audit(STUB_CONJECTURE, stubEvidence());

    expect(final.verdict).toBe("APPROVE");
    expect(final.round).toBe(1);
    expect(history).toHaveLength(1);
  });

  test("APPROVE verdict includes a non-empty rationale", async () => {
    globalThis.fetch = geminiResponseMock({
      verdict: "APPROVE",
      rationale: "Confirmed by spectral analysis.",
    });

    const { final } = await new RedTeamAuditor({ apiKey: "k" }).audit(
      STUB_CONJECTURE,
      stubEvidence(),
    );

    expect(final.rationale.length).toBeGreaterThan(0);
  });

  test("does not call API more than once after APPROVE", async () => {
    let callCount = 0;
    const { fetch, capturedBodies } = geminiCapturingMock([
      { verdict: "APPROVE", rationale: "ok" },
    ]);
    globalThis.fetch = fetch;

    await new RedTeamAuditor({ apiKey: "k" }).audit(STUB_CONJECTURE, stubEvidence());

    expect(capturedBodies).toHaveLength(1);
  });
});

// ── REJECT ────────────────────────────────────────────────────────────────────

describe("RedTeamAuditor — REJECT verdict", () => {
  test("returns REJECT immediately", async () => {
    globalThis.fetch = geminiResponseMock({
      verdict: "REJECT",
      rationale: "Counterexample found at n=0.",
    });

    const { final } = await new RedTeamAuditor({ apiKey: "k" }).audit(
      STUB_CONJECTURE,
      stubEvidence(),
    );

    expect(final.verdict).toBe("REJECT");
    expect(final.round).toBe(1);
  });

  test("REJECT history has exactly 1 entry", async () => {
    globalThis.fetch = geminiResponseMock({ verdict: "REJECT", rationale: "fatal" });

    const { history } = await new RedTeamAuditor({ apiKey: "k" }).audit(
      STUB_CONJECTURE,
      stubEvidence(),
    );

    expect(history).toHaveLength(1);
  });
});

// ── WEAKEN loops ──────────────────────────────────────────────────────────────

describe("RedTeamAuditor — WEAKEN convergence", () => {
  test("WEAKEN→APPROVE produces 2-entry history and APPROVE final", async () => {
    const { fetch, capturedBodies } = geminiCapturingMock([
      {
        verdict: "WEAKEN",
        rationale: "Too broad — add h : n > 0.",
        suggested_revision: "theorem t (n : Nat) (h : n > 0) : n + 0 = n",
      },
      { verdict: "APPROVE", rationale: "Narrowed form is correct." },
    ]);
    globalThis.fetch = fetch;

    const { final, history } = await new RedTeamAuditor({ apiKey: "k" }).audit(
      STUB_CONJECTURE,
      stubEvidence(),
    );

    expect(final.verdict).toBe("APPROVE");
    expect(history).toHaveLength(2);
    expect(history[0]!.verdict).toBe("WEAKEN");
    expect(history[1]!.verdict).toBe("APPROVE");
    expect(capturedBodies).toHaveLength(2);
  });

  test("second audit request body contains the revised signature", async () => {
    const { fetch, capturedBodies } = geminiCapturingMock([
      {
        verdict: "WEAKEN",
        rationale: "Needs hypothesis.",
        suggested_revision: "theorem REVISED_UNIQUE_99999 : True",
      },
      { verdict: "APPROVE", rationale: "ok" },
    ]);
    globalThis.fetch = fetch;

    await new RedTeamAuditor({ apiKey: "k" }).audit(STUB_CONJECTURE, stubEvidence());

    expect(capturedBodies[1]).toContain("REVISED_UNIQUE_99999");
  });

  test("WEAKEN×3 exhausts MAX_ROUNDS and produces REJECT", async () => {
    globalThis.fetch = geminiResponseMock({
      verdict: "WEAKEN",
      rationale: "Still too broad.",
      suggested_revision: "theorem narrower : True",
    });

    const { final, history } = await new RedTeamAuditor({ apiKey: "k" }).audit(
      STUB_CONJECTURE,
      stubEvidence(),
    );

    expect(final.verdict).toBe("REJECT");
    // 3 real WEAKEN rounds + 1 synthetic exhaustion REJECT
    expect(history).toHaveLength(4);
    expect(history.slice(0, 3).every((h) => h.verdict === "WEAKEN")).toBe(true);
    expect(history[3]!.verdict).toBe("REJECT");
  });

  test("WEAKEN without suggested_revision is treated as REJECT immediately", async () => {
    globalThis.fetch = geminiResponseMock({
      verdict: "WEAKEN",
      rationale: "Problem found, but cannot suggest a fix.",
      // no suggested_revision
    });

    const { final } = await new RedTeamAuditor({ apiKey: "k" }).audit(
      STUB_CONJECTURE,
      stubEvidence(),
    );

    expect(final.verdict).toBe("REJECT");
  });

  test("round numbers in history are 1-indexed and monotonically increasing", async () => {
    const { fetch } = geminiCapturingMock([
      { verdict: "WEAKEN", rationale: "r1", suggested_revision: "theorem x : True" },
      { verdict: "WEAKEN", rationale: "r2", suggested_revision: "theorem x : True" },
      { verdict: "APPROVE", rationale: "ok" },
    ]);
    globalThis.fetch = fetch;

    const { history } = await new RedTeamAuditor({ apiKey: "k" }).audit(
      STUB_CONJECTURE,
      stubEvidence(),
    );

    expect(history.map((h) => h.round)).toEqual([1, 2, 3]);
  });
});

// ── API failure resilience ────────────────────────────────────────────────────

describe("RedTeamAuditor — API failure resilience", () => {
  test("empty text response is treated as REJECT", async () => {
    globalThis.fetch = geminiBlankTextMock();

    const { final } = await new RedTeamAuditor({ apiKey: "k" }).audit(
      STUB_CONJECTURE,
      stubEvidence(),
    );

    expect(final.verdict).toBe("REJECT");
    expect(final.rationale.length).toBeGreaterThan(0);
  });

  test("empty candidates array is treated as REJECT", async () => {
    globalThis.fetch = geminiEmptyMock();

    const { final } = await new RedTeamAuditor({ apiKey: "k" }).audit(
      STUB_CONJECTURE,
      stubEvidence(),
    );

    expect(final.verdict).toBe("REJECT");
  });
});

// ── Evidence and conjecture injected into prompt ──────────────────────────────

describe("RedTeamAuditor — prompt contract", () => {
  test("request body includes the evidence hypothesis", async () => {
    const { fetch, capturedBodies } = geminiCapturingMock([
      { verdict: "APPROVE", rationale: "ok" },
    ]);
    globalThis.fetch = fetch;

    const evidence = stubEvidence({ hypothesis: "UNIQUE_HYPOTHESIS_XYZ_12345" });
    await new RedTeamAuditor({ apiKey: "k" }).audit(STUB_CONJECTURE, evidence);

    expect(capturedBodies[0]).toContain("UNIQUE_HYPOTHESIS_XYZ_12345");
  });

  test("request body includes the conjecture signature", async () => {
    const { fetch, capturedBodies } = geminiCapturingMock([
      { verdict: "APPROVE", rationale: "ok" },
    ]);
    globalThis.fetch = fetch;

    const conjecture = {
      signature: "theorem UNIQUE_SIG_ABCDEF_55555 : True",
      description: "test",
    };
    await new RedTeamAuditor({ apiKey: "k" }).audit(conjecture, stubEvidence());

    expect(capturedBodies[0]).toContain("UNIQUE_SIG_ABCDEF_55555");
  });

  test("request body includes anomaly domains from evidence", async () => {
    const { fetch, capturedBodies } = geminiCapturingMock([
      { verdict: "APPROVE", rationale: "ok" },
    ]);
    globalThis.fetch = fetch;

    const evidence = stubEvidence({ anomalies: ["UNIQUE_ANOMALY_DOMAIN_77777"] });
    await new RedTeamAuditor({ apiKey: "k" }).audit(STUB_CONJECTURE, evidence);

    expect(capturedBodies[0]).toContain("UNIQUE_ANOMALY_DOMAIN_77777");
  });

  test("request body includes kill domains from evidence", async () => {
    const { fetch, capturedBodies } = geminiCapturingMock([
      { verdict: "APPROVE", rationale: "ok" },
    ]);
    globalThis.fetch = fetch;

    const evidence = stubEvidence({ kills: ["UNIQUE_KILL_DOMAIN_88888"] });
    await new RedTeamAuditor({ apiKey: "k" }).audit(STUB_CONJECTURE, evidence);

    expect(capturedBodies[0]).toContain("UNIQUE_KILL_DOMAIN_88888");
  });
});
