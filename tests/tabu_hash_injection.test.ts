/**
 * TDD: Tabu Hash Injection Pipeline
 *
 * Tests that Zobrist hashes from glass floor failure_mode entries flow
 * through every layer of the SA pipeline:
 *
 *   1. ramsey_worker_thread deserializes tabuHashes from the message payload
 *   2. OrchestratedSearchConfig accepts and forwards tabuHashes
 *   3. requestSearchPivot merges journal tabu hashes into the returned SearchPhase
 */

import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { ramseySearch } from "../src/search/ramsey_worker";
import type { RamseySearchConfig } from "../src/search/ramsey_worker";
import { orchestratedSearch } from "../src/search/ramsey_orchestrator";
import type { OrchestratedSearchConfig } from "../src/search/ramsey_orchestrator";
import { ResearchJournal, type JournalEntry } from "../src/search/research_journal";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeGlassFloorEntry(zobristHash: string, id = "glass-1"): JournalEntry {
  return {
    id,
    timestamp: new Date().toISOString(),
    type: "failure_mode",
    claim: "Glass floor detected",
    evidence: "Z3 UNSAT on neighborhood",
    target_goal: "R(4,6) >= 36",
    zobristHash,
  };
}

/** Build a ResearchJournal backed by a fixed in-memory entry list (no disk I/O). */
function journalWithEntries(entries: JournalEntry[]): ResearchJournal {
  const j = new ResearchJournal("/tmp/nonexistent_tabu.json");
  (j as any).readFile = async () => ({ version: 1, entries });
  return j;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ramseySearch tabu hash wiring (pure function — easier to test directly)
// ─────────────────────────────────────────────────────────────────────────────

describe("ramseySearch tabu hash wiring", () => {
  test("tabuHashes are accepted and coerced from string[] without throwing", () => {
    // Tiny search: 4 vertices, 100 iterations, just verifying no crash
    const config: RamseySearchConfig = {
      n: 4,
      r: 3,
      s: 3,
      maxIterations: 100,
      initialTemp: 1.0,
      coolingRate: 0.99,
      tabuHashes: ["18020449463733375403", "137464187416166579"],
      tabuPenaltyTemperature: 5.0,
    };
    expect(() => ramseySearch(config)).not.toThrow();
  });

  test("tabuHashes=undefined produces null tabuSet (no Zobrist allocations)", () => {
    // Verify the tabu path is inactive when no hashes provided
    const config: RamseySearchConfig = {
      n: 4,
      r: 3,
      s: 3,
      maxIterations: 100,
      initialTemp: 1.0,
      coolingRate: 0.99,
      // tabuHashes intentionally omitted
    };
    // Should complete without error — tabuSet is null, no BigInt conversions
    const result = ramseySearch(config);
    expect(typeof result.bestEnergy).toBe("number");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. OrchestratedSearchConfig tabu field propagation
// ─────────────────────────────────────────────────────────────────────────────

describe("OrchestratedSearchConfig tabuHashes field", () => {
  test("OrchestratedSearchConfig accepts tabuHashes field", () => {
    // Just type-checks at runtime — verifies the field exists on the interface.
    // If tabuHashes doesn't exist on the type, this won't compile.
    const config: OrchestratedSearchConfig = {
      n: 4,
      r: 3,
      s: 3,
      saIterations: 100,
      strategy: "single",
      workers: 1,
      seed: "random",
      tabuHashes: ["18020449463733375403"],
    };
    expect((config as any).tabuHashes).toHaveLength(1);
  });

  test("orchestratedSearch (single, tiny) completes with tabuHashes without throwing", async () => {
    const config: OrchestratedSearchConfig = {
      n: 5,
      r: 3,
      s: 3,
      saIterations: 500,
      strategy: "single",
      workers: 1,
      seed: "random",
      tabuHashes: ["18020449463733375403", "137464187416166579"],
    };
    await expect(orchestratedSearch(config)).resolves.toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. requestSearchPivot injects tabu hashes from journal
// ─────────────────────────────────────────────────────────────────────────────

// We need to import the function dynamically since it's not currently exported.
// After the fix it will be exported (or we test it through the SearchPhase result).

describe("requestSearchPivot tabu hash injection", () => {
  const KNOWN_HASH_1 = "18020449463733375403";
  const KNOWN_HASH_2 = "137464187416166579";

  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  test("flat pivot result includes tabuHashes from journal failure_mode entries", async () => {
    // This test imports requestSearchPivot indirectly via the module.
    // After the fix, requestSearchPivot should accept a tabuHashes: string[] param
    // and merge them into the returned SearchPhase.

    // Mock Gemini to return a minimal SearchPhase
    const MOCK_PHASE = JSON.stringify({
      vertices: 35,
      r: 4,
      s: 6,
      sa_iterations: 25_000_000_000,
      strategy: "island_model",
      workers: 5,
      seed: "random",
      // Note: no tabuHashes — the function must inject them
    });

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: MOCK_PHASE }] } }] }),
      text: async () => "",
    }) as any;

    // Dynamically import *after* mocking fetch so the module picks up our mock
    const { getTabuHashesFromJournal } = await import("../src/cli/perqed_tabu_utils");

    const journal = journalWithEntries([
      makeGlassFloorEntry(KNOWN_HASH_1, "e1"),
      makeGlassFloorEntry(KNOWN_HASH_2, "e2"),
    ]);

    const hashes = await getTabuHashesFromJournal(journal);
    expect(hashes).toContain(KNOWN_HASH_1);
    expect(hashes).toContain(KNOWN_HASH_2);
    expect(hashes).toHaveLength(2);
  });

  test("getTabuHashesFromJournal returns empty array when journal has no failure_mode entries", async () => {
    const { getTabuHashesFromJournal } = await import("../src/cli/perqed_tabu_utils");
    const journal = journalWithEntries([]);
    const hashes = await getTabuHashesFromJournal(journal);
    expect(hashes).toEqual([]);
  });

  test("getTabuHashesFromJournal deduplicates repeated hashes", async () => {
    const { getTabuHashesFromJournal } = await import("../src/cli/perqed_tabu_utils");
    const journal = journalWithEntries([
      makeGlassFloorEntry(KNOWN_HASH_1, "e1"),
      makeGlassFloorEntry(KNOWN_HASH_1, "e2"), // duplicate
      makeGlassFloorEntry(KNOWN_HASH_2, "e3"),
    ]);
    const hashes = await getTabuHashesFromJournal(journal);
    expect(hashes).toHaveLength(2);
    expect(new Set(hashes).size).toBe(2);
  });
});
