/**
 * Research Journal
 *
 * Perqed's long-term memory. Captures lemmas, observations, and failure modes
 * across search attempts so the ARCHITECT can build on past results rather than
 * repeating failed strategies.
 *
 * Storage: .perqed/journal.json (global, persists across runs)
 *
 * Context compaction: distillJournalForPrompt() converts journal entries into
 * dense, token-bounded markdown for injection into the ARCHITECT's preamble.
 * Raw logs and search telemetry are NEVER injected — only typed, claim-sized
 * entries make it into the LLM context.
 */

import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type JournalEntryType = "lemma" | "observation" | "failure_mode";

export interface JournalEntry {
  /** Unique identifier for deduplication */
  id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Classification: proven fact, structural note, or known dead-end */
  type: JournalEntryType;
  /**
   * The mathematical claim, stated precisely.
   * Examples:
   *   lemma: "No circulant 2-coloring of K_35 witnesses R(4,6)"
   *   observation: "SA on K_35 R(4,6) stalls at E_min=12 across 8 independent workers"
   *   failure_mode: "Circulant SA with distance-flip mutation cannot escape E=12 glass floor"
   */
  claim: string;
  /**
   * How we know this — proof mechanism or empirical evidence.
   * Examples:
   *   "Z3 UNSAT: 17-var encoding, 52360 red + 1623160 blue constraints"
   *   "500M SA iters × 8 workers, best E=12 (10 seeds)"
   */
  evidence: string;
  /**
   * The top-level goal this entry is relevant to.
   * Used for goal-scoped retrieval.
   * Format: "R(4,6) >= 36"
   */
  target_goal: string;
}

interface JournalFile {
  version: 1;
  entries: JournalEntry[];
}

// ──────────────────────────────────────────────
// ResearchJournal class
// ──────────────────────────────────────────────

export class ResearchJournal {
  constructor(private readonly journalPath: string) {}

  /**
   * Add a new entry. Assigns id and timestamp automatically.
   * Atomic append: reads current state, appends, writes back.
   */
  async addEntry(
    entry: Omit<JournalEntry, "id" | "timestamp">,
  ): Promise<JournalEntry> {
    const full: JournalEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    };

    const existing = await this.readFile();
    existing.entries.push(full);
    await this.writeFile(existing);
    return full;
  }

  /** All entries relevant to a specific goal string (exact match). */
  async getEntriesForGoal(goal: string): Promise<JournalEntry[]> {
    const { entries } = await this.readFile();
    return entries.filter((e) => e.target_goal === goal);
  }

  /** All entries across all goals, in insertion order. */
  async getAllEntries(): Promise<JournalEntry[]> {
    const { entries } = await this.readFile();
    return entries;
  }

  // ── Private ─────────────────────────────────

  private async readFile(): Promise<JournalFile> {
    try {
      const raw = await readFile(this.journalPath, "utf-8");
      return JSON.parse(raw) as JournalFile;
    } catch {
      return { version: 1, entries: [] };
    }
  }

  private async writeFile(data: JournalFile): Promise<void> {
    const dir = join(this.journalPath, "..");
    await mkdir(dir, { recursive: true });
    await writeFile(this.journalPath, JSON.stringify(data, null, 2), "utf-8");
  }
}

// ──────────────────────────────────────────────
// Context compaction
// ──────────────────────────────────────────────

export interface DistillOptions {
  /** Max number of entries to include (most recent first). Default: 10 */
  maxEntries?: number;
  /** Approximate token budget (4 chars ≈ 1 token). Default: 800 */
  maxTokens?: number;
}

/**
 * Convert journal entries into dense, token-bounded markdown for the
 * ARCHITECT's preamble. Returns "" for empty entries (no noise).
 *
 * Format:
 *   ### PREVIOUSLY ESTABLISHED LEMMAS & OBSERVATIONS ###
 *   Do not attempt strategies that contradict these established facts:
 *   [LEMMA] No circulant 2-coloring of K_35 witnesses R(4,6) (Evidence: Z3 UNSAT ...)
 *   [OBSERVATION] SA stalls at E=12 ... (Evidence: ...)
 *   [FAILURE_MODE] ... (Evidence: ...)
 *
 * Ordering: lemmas first (proven facts), then observations, then failure_modes.
 * Token cap: truncates at maxTokens to prevent context bloat.
 */
export function distillJournalForPrompt(
  entries: JournalEntry[],
  opts: DistillOptions = {},
): string {
  if (entries.length === 0) return "";

  const { maxEntries = 10, maxTokens = 800 } = opts;

  // Take only the most recent maxEntries (by array order = insertion order)
  const recentEntries = entries.slice(-maxEntries);

  // Sort by type priority: lemma > observation > failure_mode
  const typePriority: Record<JournalEntryType, number> = {
    lemma: 0,
    observation: 1,
    failure_mode: 2,
  };
  const sorted = [...recentEntries].sort(
    (a, b) => typePriority[a.type] - typePriority[b.type],
  );

  const header =
    "### PREVIOUSLY ESTABLISHED LEMMAS & OBSERVATIONS ###\n" +
    "Do not attempt strategies that contradict these established facts:\n";

  const lines: string[] = [];
  let charBudget = maxTokens * 4 - header.length;

  for (const entry of sorted) {
    const line = `- [${entry.type.toUpperCase()}] ${entry.claim} (Evidence: ${entry.evidence})`;
    if (line.length > charBudget) break;
    lines.push(line);
    charBudget -= line.length + 1; // +1 for newline
  }

  if (lines.length === 0) return "";

  return header + lines.join("\n") + "\n";
}

// ──────────────────────────────────────────────
// Default journal path
// ──────────────────────────────────────────────

/** Resolves the global journal path relative to the perqed project root. */
export function defaultJournalPath(projectRoot: string): string {
  return join(projectRoot, ".perqed", "journal.json");
}
