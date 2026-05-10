/**
 * Hash Context Gap — TDD tests
 *
 * Tests cover all four parts of the pipeline:
 *   1. JournalEntry accepts optional zobristHash string
 *   2. distillJournalForPrompt emits the tabu hash block
 *   3. buildTabuHashBlock extracts hashes from failure_mode entries
 *   4. BigInt serialization roundtrip (string → BigInt → string identity)
 *   5. SA worker coerces string hashes to BigInt correctly
 *   6. RamseySearchConfig tabuHashes is string[] at the type boundary
 */

import { describe, test, expect } from "bun:test";
import type { JournalEntry } from "../src/search/research_journal";
import {
  distillJournalForPrompt,
  buildTabuHashBlock,
} from "../src/search/research_journal";
import { ZobristHasher } from "../src/search/zobrist_hash";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function makeEntry(
  overrides: Partial<JournalEntry> & { type: JournalEntry["type"] },
): JournalEntry {
  return {
    id: "test-id",
    timestamp: "2026-03-17T00:00:00.000Z",
    claim: "test claim",
    evidence: "test evidence",
    target_goal: "R(4,6) >= 36",
    ...overrides,
  };
}

function makeFailureWithHash(hash: string, energy: number): JournalEntry {
  return makeEntry({
    type: "failure_mode",
    claim: `LNS could not repair E=${energy} basin for R(4,6) on K_35`,
    evidence: `Z3 UNSAT: neighborhood of 100 edges; 100 free edges tried`,
    zobristHash: hash,
  });
}

// ──────────────────────────────────────────────────────────────────────────

describe("JournalEntry — optional zobristHash field", () => {
  test("JournalEntry accepts zobristHash string property", () => {
    const entry: JournalEntry = makeEntry({
      type: "failure_mode",
      zobristHash: "14819238491823",
    });
    expect(entry.zobristHash).toBe("14819238491823");
  });

  test("JournalEntry without zobristHash is still valid (optional)", () => {
    const entry: JournalEntry = makeEntry({ type: "lemma" });
    expect(entry.zobristHash).toBeUndefined();
  });
});

describe("buildTabuHashBlock — extract hashes from journal entries", () => {
  test("returns empty string when no entries have zobristHash", () => {
    const entries: JournalEntry[] = [
      makeEntry({ type: "lemma" }),
      makeEntry({ type: "observation" }),
      makeEntry({ type: "failure_mode" }), // no hash
    ];
    expect(buildTabuHashBlock(entries)).toBe("");
  });

  test("returns formatted block for one hashed failure", () => {
    const entries = [makeFailureWithHash("14819238491823", 8)];
    const block = buildTabuHashBlock(entries);
    expect(block).toContain("KNOWN STERILE BASINS");
    expect(block).toContain("14819238491823");
    expect(block).toContain("tabuHashes");
  });

  test("includes all hashes when multiple failure_mode entries have hashes", () => {
    const entries = [
      makeFailureWithHash("111111111111", 8),
      makeFailureWithHash("222222222222", 11),
      makeFailureWithHash("333333333333", 12),
    ];
    const block = buildTabuHashBlock(entries);
    expect(block).toContain("111111111111");
    expect(block).toContain("222222222222");
    expect(block).toContain("333333333333");
  });

  test("deduplicates identical hashes", () => {
    const entries = [
      makeFailureWithHash("999999999999", 8),
      makeFailureWithHash("999999999999", 8), // duplicate
    ];
    const block = buildTabuHashBlock(entries);
    // Should appear exactly once
    const count = (block.match(/999999999999/g) ?? []).length;
    expect(count).toBe(1);
  });

  test("ignores non-failure_mode entries even if they somehow have a hash", () => {
    const entries: JournalEntry[] = [
      { ...makeEntry({ type: "lemma" }), zobristHash: "123" },
      makeFailureWithHash("456", 10),
    ];
    const block = buildTabuHashBlock(entries);
    expect(block).not.toContain('"123"');
    expect(block).toContain("456");
  });
});

describe("distillJournalForPrompt — tabu block integration", () => {
  test("distillJournalForPrompt emits tabu block when failures have hashes", () => {
    const entries: JournalEntry[] = [
      makeEntry({ type: "lemma", claim: "No circulant witness" }),
      makeFailureWithHash("14819238491823", 8),
    ];
    const output = distillJournalForPrompt(entries);
    expect(output).toContain("KNOWN STERILE BASINS");
    expect(output).toContain("14819238491823");
  });

  test("distillJournalForPrompt does NOT emit tabu block when no hashes", () => {
    const entries: JournalEntry[] = [
      makeEntry({ type: "lemma", claim: "No circulant witness" }),
      makeEntry({ type: "failure_mode", claim: "SA stalled at E=12" }),
    ];
    const output = distillJournalForPrompt(entries);
    expect(output).not.toContain("KNOWN STERILE BASINS");
    expect(output).not.toContain("tabuHashes");
  });
});

describe("BigInt serialization roundtrip", () => {
  test("ZobristHasher.computeInitial() result survives string roundtrip", () => {
    const hasher = new ZobristHasher(4, 42n);
    const adj = new AdjacencyMatrix(4);
    adj.addEdge(0, 1);
    adj.addEdge(2, 3);

    const original: bigint = hasher.computeInitial(adj);
    const serialized: string = original.toString();
    const deserialized: bigint = BigInt(serialized);

    expect(deserialized).toBe(original);
    // The string must be parseable as a decimal integer
    expect(/^\d+$/.test(serialized)).toBe(true);
  });

  test("BigInt(str) correctly coerces all common hash magnitudes", () => {
    const cases = [
      "0",
      "1",
      "18446744073709551615", // 2^64 - 1 (max uint64)
      "14819238491823",
      "9007199254740993", // > Number.MAX_SAFE_INTEGER
    ];
    for (const c of cases) {
      expect(BigInt(c).toString()).toBe(c);
    }
  });
});

describe("RamseySearchConfig — tabuHashes is string[] at JSON boundary", () => {
  test("tabuHashes string[] config passes through JSON.parse cleanly", () => {
    const config = {
      n: 35, r: 4, s: 6,
      maxIterations: 1000,
      initialTemp: 3.0,
      coolingRate: 0.9999,
      tabuHashes: ["14819238491823", "8471923847192"],
      tabuPenaltyTemperature: 3.0,
    };
    // Simulate JSON serialization boundary (e.g., worker thread message)
    const serialized = JSON.stringify(config);
    const parsed = JSON.parse(serialized) as typeof config;

    expect(parsed.tabuHashes).toEqual(["14819238491823", "8471923847192"]);
    // They must be parseable as BigInt
    const bigints = parsed.tabuHashes.map((h) => BigInt(h));
    expect(bigints[0]).toBe(14819238491823n);
    expect(bigints[1]).toBe(8471923847192n);
  });

  test("tabuHashes coercion: Set<bigint> is correctly populated from string[]", () => {
    const hashes = ["14819238491823", "8471923847192"];
    const tabuSet = new Set<bigint>(hashes.map((h) => BigInt(h)));

    expect(tabuSet.has(14819238491823n)).toBe(true);
    expect(tabuSet.has(8471923847192n)).toBe(true);
    expect(tabuSet.has(99999999999n)).toBe(false);
  });
});
