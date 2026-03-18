/**
 * TDD: Escalating Creativity and Conceptual Scatter
 *
 * Tests cover:
 *   Part 1: ResearchJournal.getConsecutiveMacroFailures()
 *     - empty journal → 0
 *     - trailing failures (type=failure_mode) → counted
 *     - streak resets on lemma (success signal)
 *     - streak resets on observation that breaks the pattern
 *     - mixed entries count correctly
 *
 *   Part 2: formulateDAG escalation ladder (via mocked ResearchJournal)
 *     - consecutiveFailures = 1 → temperature 0.2, no special prompt
 *     - consecutiveFailures = 4 → temperature 0.70, "LOCAL MINIMUM DETECTED"
 *     - consecutiveFailures = 7 → temperature 0.95, "TRIGGER CONCEPTUAL SCATTER"
 *     - Zod validation still applied at temperature 0.95 (invalid JSON → retry)
 *     - empty journal → stage 1 defaults (graceful startup)
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { ResearchJournal, type JournalEntry } from "../src/search/research_journal";
import { ArchitectClient } from "../src/architect_client";

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function makeEntry(type: JournalEntry["type"], n: number): Omit<JournalEntry, "id" | "timestamp"> {
  return {
    type,
    claim: `test claim ${n}`,
    evidence: `test evidence ${n}`,
    target_goal: "R(4,6) >= 36",
  };
}

/** Build a ResearchJournal backed by a fixed in-memory entry list (no disk I/O). */
function journalWithEntries(entries: JournalEntry[]): ResearchJournal {
  const j = new ResearchJournal("/tmp/nonexistent.json");
  // Override getAllEntries to return the synthetic set
  (j as any).readFile = async () => ({ version: 1, entries });
  return j;
}

function makeFullEntry(type: JournalEntry["type"], id: string): JournalEntry {
  return {
    id,
    timestamp: new Date().toISOString(),
    type,
    claim: `claim-${id}`,
    evidence: `evidence-${id}`,
    target_goal: "R(4,6) >= 36",
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Part 1: getConsecutiveMacroFailures()
// ──────────────────────────────────────────────────────────────────────────

describe("ResearchJournal.getConsecutiveMacroFailures()", () => {
  test("empty journal returns 0", async () => {
    const j = journalWithEntries([]);
    expect(await j.getConsecutiveMacroFailures()).toBe(0);
  });

  test("single failure_mode entry → streak = 1", async () => {
    const j = journalWithEntries([makeFullEntry("failure_mode", "a")]);
    expect(await j.getConsecutiveMacroFailures()).toBe(1);
  });

  test("three consecutive failure_modes → streak = 3", async () => {
    const j = journalWithEntries([
      makeFullEntry("failure_mode", "a"),
      makeFullEntry("failure_mode", "b"),
      makeFullEntry("failure_mode", "c"),
    ]);
    expect(await j.getConsecutiveMacroFailures()).toBe(3);
  });

  test("lemma after failures resets streak to 0", async () => {
    // lemma = success indicator; streak is 0 because most recent is a lemma
    const j = journalWithEntries([
      makeFullEntry("failure_mode", "a"),
      makeFullEntry("failure_mode", "b"),
      makeFullEntry("lemma", "c"),   // ← breaks the streak
    ]);
    expect(await j.getConsecutiveMacroFailures()).toBe(0);
  });

  test("failures after a lemma only count those failures", async () => {
    // lemma in the middle; trailing failures = 2
    const j = journalWithEntries([
      makeFullEntry("failure_mode", "a"),
      makeFullEntry("lemma", "b"),   // ← streak reset here
      makeFullEntry("failure_mode", "c"),
      makeFullEntry("failure_mode", "d"),
    ]);
    expect(await j.getConsecutiveMacroFailures()).toBe(2);
  });

  test("observation also resets the streak (non-failure type)", async () => {
    const j = journalWithEntries([
      makeFullEntry("failure_mode", "a"),
      makeFullEntry("failure_mode", "b"),
      makeFullEntry("observation", "c"),  // ← not a failure
      makeFullEntry("failure_mode", "d"),
    ]);
    expect(await j.getConsecutiveMacroFailures()).toBe(1);
  });

  test("all entries are observations → streak = 0", async () => {
    const j = journalWithEntries([
      makeFullEntry("observation", "a"),
      makeFullEntry("observation", "b"),
    ]);
    expect(await j.getConsecutiveMacroFailures()).toBe(0);
  });

  test("7 consecutive failure_modes → streak = 7", async () => {
    const entries = Array.from({ length: 7 }, (_, i) =>
      makeFullEntry("failure_mode", `f${i}`));
    const j = journalWithEntries(entries);
    expect(await j.getConsecutiveMacroFailures()).toBe(7);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Part 2: formulateDAG escalation ladder
//
// We mock fetch to return a valid ProofDAG JSON, but also capture what
// the client SENT (temperature, prompt content) by inspecting the payload.
// ──────────────────────────────────────────────────────────────────────────

describe("ArchitectClient.formulateDAG — escalation ladder", () => {
  const VALID_DAG = JSON.stringify({
    id: "00000000-0000-0000-0000-000000000001",
    goal: "R(4,6) >= 36",
    nodes: [
      {
        id: "lit_node",
        kind: "literature",
        label: "Search literature",
        dependsOn: [],
        config: { query: "Ramsey R(4,6)" },
        status: "pending",
      },
    ],
    createdAt: new Date().toISOString(),
  });

  /** Capture the last fetch payload so we can inspect temperature and prompt. */
  let lastPayload: any = null;

  beforeEach(() => {
    lastPayload = null;
    (globalThis as any).fetch = async (_url: string, opts: RequestInit) => {
      lastPayload = JSON.parse(opts.body as string);
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: VALID_DAG }] } }],
        }),
        text: async () => "",
      };
    };
  });

  function makeClient() {
    return new ArchitectClient({ apiKey: "test-key", model: "gemini-test" });
  }

  async function runWithFailureStreak(consecutiveFailures: number) {
    const entries: JournalEntry[] = Array.from({ length: consecutiveFailures }, (_, i) =>
      makeFullEntry("failure_mode", `f${i}`));
    const journal = journalWithEntries(entries);
    const client = makeClient();
    await client.formulateDAG("ctx", "R(4,6) >= 36", [], [], journal);
    return lastPayload;
  }

  test("0 consecutive failures → temperature 0.2 (Stage 1: default exploitation)", async () => {
    const payload = await runWithFailureStreak(0);
    expect(payload.generationConfig.temperature).toBe(0.2);
    const prompt: string = payload.contents[0].parts[0].text;
    expect(prompt).not.toContain("LOCAL MINIMUM DETECTED");
    expect(prompt).not.toContain("TRIGGER CONCEPTUAL SCATTER");
  });

  test("1 consecutive failure → temperature 0.2 (still Stage 1)", async () => {
    const payload = await runWithFailureStreak(1);
    expect(payload.generationConfig.temperature).toBe(0.2);
  });

  test("3 consecutive failures → temperature 0.70, prompt contains LOCAL MINIMUM DETECTED", async () => {
    const payload = await runWithFailureStreak(3);
    expect(payload.generationConfig.temperature).toBe(0.70);
    const prompt: string = payload.contents[0].parts[0].text;
    expect(prompt).toContain("LOCAL MINIMUM DETECTED");
    expect(prompt).toContain("3");  // failure count injected
  });

  test("4 consecutive failures → temperature 0.70 (Stage 2)", async () => {
    const payload = await runWithFailureStreak(4);
    expect(payload.generationConfig.temperature).toBe(0.70);
    const prompt: string = payload.contents[0].parts[0].text;
    expect(prompt).toContain("LOCAL MINIMUM DETECTED");
  });

  test("6 consecutive failures → temperature 0.95, prompt contains TRIGGER CONCEPTUAL SCATTER", async () => {
    const payload = await runWithFailureStreak(6);
    expect(payload.generationConfig.temperature).toBe(0.95);
    const prompt: string = payload.contents[0].parts[0].text;
    expect(prompt).toContain("TRIGGER CONCEPTUAL SCATTER");
    expect(prompt).toContain("6");
  });

  test("7 consecutive failures → temperature 0.95 (Stage 3: Wiles Maneuver)", async () => {
    const payload = await runWithFailureStreak(7);
    expect(payload.generationConfig.temperature).toBe(0.95);
    const prompt: string = payload.contents[0].parts[0].text;
    expect(prompt).toContain("TRIGGER CONCEPTUAL SCATTER");
    expect(prompt).toContain("CRITICAL MACRO-STALENESS DETECTED");
  });

  test("empty journal returns Stage 1 defaults gracefully", async () => {
    const journal = journalWithEntries([]);
    const client = makeClient();
    const payload_capture = await client.formulateDAG("ctx", "R(4,6) >= 36", [], [], journal)
      .then(() => lastPayload);
    expect(payload_capture.generationConfig.temperature).toBe(0.2);
  });

  test("Zod validation still runs at temperature 0.95; invalid JSON triggers retry then succeeds", async () => {
    let callCount = 0;
    // First call returns garbage JSON; second returns valid DAG
    (globalThis as any).fetch = async (_url: string, opts: RequestInit) => {
      callCount++;
      lastPayload = JSON.parse(opts.body as string);
      const txt = callCount === 1 ? "not json at all {{" : VALID_DAG;
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: txt }] } }],
        }),
        text: async () => "",
      };
    };

    // Use streak=7 so temperature is 0.95
    const entries: JournalEntry[] = Array.from({ length: 7 }, (_, i) =>
      makeFullEntry("failure_mode", `f${i}`));
    const journal = journalWithEntries(entries);
    const client = makeClient();

    // Should succeed on retry (no throw)
    const dag = await client.formulateDAG("ctx", "R(4,6) >= 36", [], [], journal);
    expect(dag.goal).toBe("R(4,6) >= 36");
    expect(callCount).toBe(2); // failed once, succeeded on retry
    expect(lastPayload.generationConfig.temperature).toBe(0.95);
  });
});
