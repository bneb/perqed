import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { ResearchJournal } from "../src/search/research_journal";
import { rm } from "node:fs/promises";

describe("Epistemic Pruning (Memory Manager)", () => {
  const TEST_JOURNAL = "./.perqed/test_journal_gc.json";

  beforeAll(async () => {
    try { await rm(TEST_JOURNAL); } catch {}
  });

  afterAll(async () => {
    try { await rm(TEST_JOURNAL); } catch {}
  });

  test("getSummary retains exactly Top 3 Best (lowest E) and 2 Most Recent", async () => {
    const journal = new ResearchJournal(TEST_JOURNAL);
    const target = "Prove R(TEST) >= 1";

    // Insert 10 failure modes with random energies and increasing timestamps.
    // Insert order (simulated time):
    // 0: E=5000 (Very high)
    // 1: E=100  (Top #2)
    // 2: E=3000 (High)
    // 3: E=50   (Top #1)
    // 4: E=2000 (High)
    // 5: E=150  (Top #3)
    // 6: E=1000 (High)
    // 7: E=800  (High)
    // 8: E=600  (Recent 2)
    // 9: E=400  (Recent 1)

    const energies = [5000, 100, 3000, 50, 2000, 150, 1000, 800, 600, 400];
    for (let i = 0; i < energies.length; i++) {
      await journal.addEntry({
        type: "failure_mode",
        claim: `Algebraic Construction test_${i} failed (E=${energies[i]}).`,
        evidence: "TDD",
        target_goal: target
      });
      // sleep 10ms to ensure distinct timestamps
      await new Promise((r) => setTimeout(r, 10));
    }

    const summary = await journal.getSummary(target);

    // It should include E=50, E=100, E=150 (Top 3)
    expect(summary).toContain("E=50:");
    expect(summary).toContain("E=100:");
    expect(summary).toContain("E=150:");

    // It should include E=600, E=400 (Recent 2 that aren't in Top 3)
    expect(summary).toContain("E=600:");
    expect(summary).toContain("E=400:");

    // It should silently drop all others
    expect(summary).not.toContain("E=5000:");
    expect(summary).not.toContain("E=3000:");
    expect(summary).not.toContain("E=2000:");
    expect(summary).not.toContain("E=1000:");
    expect(summary).not.toContain("E=800:");

    // Test investigation recording
    await journal.recordInvestigation("query_literature", "Paley", "Found Paley graph.");
    const summary2 = await journal.getSummary(target);
    expect(summary2).toContain("[query_literature] Input: Paley... -> Result: Found Paley graph.");
  });
});
