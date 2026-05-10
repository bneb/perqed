/**
 * Tabu hash utilities for the SA pivot pipeline.
 *
 * Extracts Zobrist hashes from ResearchJournal failure_mode entries
 * so they can be injected into SA worker configs via requestSearchPivot
 * and OrchestratedSearchConfig, preventing workers from re-entering
 * Z3-certified sterile basins.
 */

import type { ResearchJournal } from "../search/research_journal";

/**
 * Extract unique Zobrist hashes from all failure_mode entries in the journal.
 * Returns decimal strings (safe for JSON transport through Worker boundaries).
 */
export async function getTabuHashesFromJournal(journal: ResearchJournal): Promise<string[]> {
  const entries = await journal.getAllEntries();
  const seen = new Set<string>();
  for (const entry of entries) {
    if (entry.type === "failure_mode" && entry.zobristHash) {
      seen.add(entry.zobristHash);
    }
  }
  return [...seen];
}
