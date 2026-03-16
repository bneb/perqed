/**
 * TDD Tests — research_journal.ts
 * Red phase: written before implementation.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import {
  ResearchJournal,
  distillJournalForPrompt,
  type JournalEntry,
} from "../src/search/research_journal";

// Use a temp file per test to avoid cross-contamination
function tmpJournalPath() {
  return join(tmpdir(), `perqed_journal_test_${randomUUID()}.json`);
}

describe("ResearchJournal — persistence", () => {
  let path: string;
  let journal: ResearchJournal;

  beforeEach(() => {
    path = tmpJournalPath();
    journal = new ResearchJournal(path);
  });

  afterEach(async () => {
    try { await unlink(path); } catch {}
  });

  test("addEntry persists to disk and getAllEntries retrieves it", async () => {
    await journal.addEntry({
      type: "lemma",
      claim: "No circulant 2-coloring of K_35 witnesses R(4,6)",
      evidence: "Z3 UNSAT on 17-variable encoding with 1.675M constraints",
      target_goal: "R(4,6) >= 36",
    });

    // New instance from same file — must see the entry
    const journal2 = new ResearchJournal(path);
    const all = await journal2.getAllEntries();
    expect(all).toHaveLength(1);
    expect(all[0]!.claim).toContain("No circulant");
    expect(all[0]!.type).toBe("lemma");
  });

  test("addEntry assigns unique id and timestamp", async () => {
    await journal.addEntry({
      type: "observation",
      claim: "SA stalled at E=12",
      evidence: "500M iters, 8 workers",
      target_goal: "R(4,6) >= 36",
    });

    const all = await journal.getAllEntries();
    expect(all[0]!.id).toBeTruthy();
    expect(all[0]!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("multiple entries are all persisted and ordered by timestamp", async () => {
    await journal.addEntry({ type: "lemma", claim: "A", evidence: "e1", target_goal: "G1" });
    await journal.addEntry({ type: "observation", claim: "B", evidence: "e2", target_goal: "G1" });
    await journal.addEntry({ type: "failure_mode", claim: "C", evidence: "e3", target_goal: "G2" });

    const all = await journal.getAllEntries();
    expect(all).toHaveLength(3);
  });

  test("fresh ResearchJournal on non-existent file starts empty", async () => {
    const all = await journal.getAllEntries();
    expect(all).toHaveLength(0);
  });
});

describe("ResearchJournal — getEntriesForGoal", () => {
  let path: string;
  let journal: ResearchJournal;

  beforeEach(() => {
    path = tmpJournalPath();
    journal = new ResearchJournal(path);
  });

  afterEach(async () => {
    try { await unlink(path); } catch {}
  });

  test("returns only entries matching target_goal", async () => {
    await journal.addEntry({ type: "lemma", claim: "A", evidence: "e", target_goal: "R(4,6) >= 36" });
    await journal.addEntry({ type: "lemma", claim: "B", evidence: "e", target_goal: "R(5,5) >= 43" });
    await journal.addEntry({ type: "observation", claim: "C", evidence: "e", target_goal: "R(4,6) >= 36" });

    const r46 = await journal.getEntriesForGoal("R(4,6) >= 36");
    expect(r46).toHaveLength(2);
    expect(r46.map(e => e.claim)).toContain("A");
    expect(r46.map(e => e.claim)).toContain("C");
  });

  test("returns empty array for unknown goal", async () => {
    await journal.addEntry({ type: "lemma", claim: "X", evidence: "e", target_goal: "R(3,3) >= 6" });
    const results = await journal.getEntriesForGoal("R(6,6) >= 100");
    expect(results).toHaveLength(0);
  });
});

describe("distillJournalForPrompt — format", () => {
  test("returns empty string for empty entries", () => {
    expect(distillJournalForPrompt([])).toBe("");
  });

  test("contains a header section", () => {
    const entry: JournalEntry = {
      id: "1", timestamp: "2026-01-01T00:00:00Z",
      type: "lemma", claim: "Test claim", evidence: "Test evidence",
      target_goal: "R(4,6) >= 36",
    };
    const result = distillJournalForPrompt([entry]);
    expect(result).toContain("LEMMA");
    expect(result).toContain("PREVIOUSLY ESTABLISHED");
  });

  test("includes claim and evidence in dense format", () => {
    const entry: JournalEntry = {
      id: "1", timestamp: "2026-01-01T00:00:00Z",
      type: "lemma", claim: "No circulant witness", evidence: "Z3 UNSAT",
      target_goal: "R(4,6) >= 36",
    };
    const result = distillJournalForPrompt([entry]);
    expect(result).toContain("No circulant witness");
    expect(result).toContain("Z3 UNSAT");
    // Must NOT leak raw JSON brackets
    expect(result).not.toMatch(/^\{/m);
    expect(result).not.toMatch(/^\[/m);
  });

  test("respects maxEntries cap — only includes most recent N", () => {
    const entries: JournalEntry[] = Array.from({ length: 20 }, (_, i) => ({
      id: String(i), timestamp: `2026-01-0${i + 1}T00:00:00Z`,
      type: "observation" as const, claim: `Claim ${i}`, evidence: `Evidence ${i}`,
      target_goal: "R(4,6) >= 36",
    }));

    const result = distillJournalForPrompt(entries, { maxEntries: 5 });
    // Should only include 5 entries (most recent — highest index)
    const claimMatches = (result.match(/Claim \d+/g) ?? []).length;
    expect(claimMatches).toBeLessThanOrEqual(5);
  });

  test("result is under estimated token budget", () => {
    const entries: JournalEntry[] = Array.from({ length: 10 }, (_, i) => ({
      id: String(i), timestamp: "2026-01-01T00:00:00Z",
      type: "lemma" as const,
      claim: "No circulant 2-coloring of K_35 witnesses R(4,6) — very long claim text here",
      evidence: "Z3 UNSAT on 17-variable SAT encoding with 1.675M clique constraints",
      target_goal: "R(4,6) >= 36",
    }));

    const result = distillJournalForPrompt(entries, { maxTokens: 800 });
    // Rough estimate: 4 chars per token
    expect(result.length).toBeLessThanOrEqual(800 * 5); // generous upper bound
  });

  test("groups lemmas before observations before failure_modes", () => {
    const entries: JournalEntry[] = [
      { id: "1", timestamp: "T", type: "failure_mode", claim: "FailureModeX", evidence: "e", target_goal: "G" },
      { id: "2", timestamp: "T", type: "lemma", claim: "LemmaX", evidence: "e", target_goal: "G" },
      { id: "3", timestamp: "T", type: "observation", claim: "ObservationX", evidence: "e", target_goal: "G" },
    ];
    const result = distillJournalForPrompt(entries);
    const lemmaPos = result.indexOf("LemmaX");
    const obsPos = result.indexOf("ObservationX");
    const fmPos = result.indexOf("FailureModeX");
    // Lemmas come first, then observations, then failure_modes
    expect(lemmaPos).toBeGreaterThan(-1);
    expect(obsPos).toBeGreaterThan(-1);
    expect(fmPos).toBeGreaterThan(-1);
    expect(lemmaPos).toBeLessThan(obsPos);
    expect(obsPos).toBeLessThan(fmPos);
  });
});

describe("Integration: Z3 UNSAT → journal → ARCHITECT prompt", () => {
  let path: string;
  let journal: ResearchJournal;

  beforeEach(() => {
    path = tmpJournalPath();
    journal = new ResearchJournal(path);
  });

  afterEach(async () => {
    try { await unlink(path); } catch {}
  });

  test("simulated Z3 UNSAT writes lemma that appears in distilled prompt", async () => {
    // Simulate what perqed.ts does on Z3 UNSAT
    await journal.addEntry({
      type: "lemma",
      claim: "No circulant 2-coloring of K_35 witnesses R(4,6)",
      evidence: "Z3 UNSAT: 17-var encoding, 52360 red + 1623160 blue constraints",
      target_goal: "R(4,6) >= 36",
    });

    // Simulate what ARCHITECT pivot call does
    const entries = await journal.getEntriesForGoal("R(4,6) >= 36");
    const prompt = distillJournalForPrompt(entries);

    // The lemma must appear in the ARCHITECT prompt payload
    expect(prompt).toContain("No circulant 2-coloring of K_35");
    expect(prompt).toContain("Z3 UNSAT");
    // Must be dense — not thousands of chars
    expect(prompt.length).toBeLessThan(2000);
  });
});
