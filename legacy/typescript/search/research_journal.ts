/**
 * Research Journal — append-only JSONL storage.
 *
 * Perqed's long-term memory. Each entry is written as a single newline-
 * delimited JSON record, making concurrent writes safe: Bun's append-mode
 * writer is atomic at the OS level for single-line writes, eliminating the
 * TOCTOU race inherent in the old read-modify-write JSON-array pattern.
 *
 * Storage: .perqed/journal.jsonl (global, persists across runs)
 *
 * Context compaction: distillJournalForPrompt() converts journal entries into
 * dense, token-bounded markdown for injection into the ARCHITECT's preamble.
 * Raw logs and search telemetry are NEVER injected — only typed, claim-sized
 * entries make it into the LLM context.
 */

import { join } from "node:path";
import { mkdir, appendFile } from "node:fs/promises";
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
  /**
   * Optional: Zobrist hash of the failed adjacency matrix, stored as a
   * decimal string (BigInt-safe JSON transport).
   * Only present on failure_mode entries where the graph was hashed at
   * the moment Z3 returned UNSAT.
   */
  zobristHash?: string;
}

// ──────────────────────────────────────────────
// ResearchJournal class
// ──────────────────────────────────────────────

export class ResearchJournal {
  constructor(private readonly journalPath: string) {}

  /**
   * Synchronous thin wrapper for callers that use the `{ record(obs) }` interface
   * (e.g. AlgebraicBuilder). Fires-and-forgets an async addEntry. Safe because
   * Bun append writes are OS-atomic at the line level.
   */
  record(obs: string): void {
    // Fire-and-forget — errors are swallowed to preserve sync callers
    this.addEntry({
      type: "observation",
      claim: obs,
      evidence: "automated log",
      target_goal: "general",
    }).catch(() => {});
  }

  /**
   * Append a new entry to the JSONL file.
   * Each call writes exactly one newline-terminated JSON line — no read step,
   * no unlock step. Concurrent callers are safe.
   */
  async addEntry(
    entry: Omit<JournalEntry, "id" | "timestamp">,
  ): Promise<JournalEntry> {
    const full: JournalEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    };

    const dir = join(this.journalPath, "..");
    await mkdir(dir, { recursive: true });

    // appendFile uses O_APPEND — atomic at OS level for single-line writes.
    // Multiple concurrent callers can safely call this without a mutex.
    await appendFile(this.journalPath, JSON.stringify(full) + "\n", "utf-8");

    return full;
  }

  /** Permanent tracking of investigation milestones */
  async recordInvestigation(skill: string, input: string, result: string): Promise<void> {
    await this.addEntry({
      type: "observation",
      claim: `[Investigation: ${skill}] ${input.substring(0, 80)} → ${result}`,
      evidence: `skill: ${skill}`,
      target_goal: "general",
    });
  }

  /**
   * Evaluates the relative depth of the current best mathematical basin.
   * Streams the JSONL file line-by-line — no full JSON parse into memory.
   */
  async getCognitiveTemperature(targetGoal: string): Promise<"EXPLOITATION" | "EXPLORATION"> {
    const attempts = await this._collectFailureEnergies(targetGoal);
    if (attempts.length === 0) return "EXPLORATION";

    const minEnergySeen = Math.min(...attempts);
    const maxEnergySeen = Math.max(...attempts);

    if (maxEnergySeen === 0 || minEnergySeen === Infinity) return "EXPLORATION";
    const depth = minEnergySeen / maxEnergySeen;
    return depth < 0.05 ? "EXPLOITATION" : "EXPLORATION";
  }

  /**
   * The Memory Manager (Epistemic Pruning)
   * Prevents Context Window Bloat by strictly enforcing Garbage Collection.
   */
  async getSummary(targetGoal: string): Promise<string> {
    const allEntries = await this.getAllEntries();
    const allGoalEntries = allEntries.filter(e => e.target_goal === targetGoal);

    const failures = allGoalEntries.filter(e => e.type === "failure_mode");
    const investigations = allEntries.filter(
      e => e.claim.startsWith("[Investigation:")
    );

    const attempts = failures.map(f => {
      const match = f.claim.match(/E=(\d+)/);
      const eScore = match ? parseInt(match[1]!, 10) : Infinity;
      return { entry: f, energy: eScore, time: new Date(f.timestamp).getTime() };
    });

    const sortedByEnergy = [...attempts].sort((a, b) => a.energy - b.energy);
    const top3 = sortedByEnergy.slice(0, 3);
    const top3Ids = new Set(top3.map(t => t.entry.id));

    const sortedByTime = [...attempts].sort((a, b) => b.time - a.time);
    const recent2: typeof attempts = [];
    for (const a of sortedByTime) {
      if (!top3Ids.has(a.entry.id)) {
        recent2.push(a);
        if (recent2.length >= 2) break;
      }
    }

    const keeperAttempts = [...top3, ...recent2].sort((a, b) => a.time - b.time);

    let summary = "### Empirical Findings (Memory Manager PRUNED)\n\n";

    if (investigations.length > 0) {
      summary += "#### Investigated Constraints & Analogies:\n";
      for (const inv of investigations.slice(-5)) {
        summary += `- ${inv.claim}\n`;
      }
      summary += "\n";
    }

    if (keeperAttempts.length > 0) {
      summary += "#### Best/Recent Algebraic Attempts:\n";
      for (const attempt of keeperAttempts) {
        summary += `- Failed with E=${attempt.energy}: ${attempt.entry.claim}\n`;
      }
    } else {
      summary += "No previous algebraic failures logged.\n";
    }

    return summary;
  }

  /** All entries relevant to a specific goal string (exact match). */
  async getEntriesForGoal(goal: string): Promise<JournalEntry[]> {
    const all = await this.getAllEntries();
    return all.filter(e => e.target_goal === goal);
  }

  /** All entries across all goals, in insertion order. */
  async getAllEntries(): Promise<JournalEntry[]> {
    return this._streamLines();
  }

  /**
   * Count consecutive macro-failures at the tail of the journal.
   */
  async getConsecutiveMacroFailures(): Promise<number> {
    const entries = await this.getAllEntries();
    let streak = 0;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i]!.type === "failure_mode") {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  // ── Private ─────────────────────────────────

  /** Stream the JSONL file and return all valid JournalEntry objects. */
  private async _streamLines(): Promise<JournalEntry[]> {
    try {
      const text = await Bun.file(this.journalPath).text();
      const entries: JournalEntry[] = [];
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          entries.push(JSON.parse(trimmed) as JournalEntry);
        } catch {
          // Skip malformed lines — never crash on corrupt JSONL
        }
      }
      return entries;
    } catch {
      return [];
    }
  }

  /** Collect numeric energies from failure_mode entries for a target goal. */
  private async _collectFailureEnergies(targetGoal: string): Promise<number[]> {
    const entries = await this._streamLines();
    return entries
      .filter(e => e.target_goal === targetGoal && e.type === "failure_mode")
      .map(f => {
        const match = f.claim.match(/E=(\d+)/);
        return match ? parseInt(match[1]!, 10) : Infinity;
      })
      .filter(e => e !== Infinity);
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
 */
export function distillJournalForPrompt(
  entries: JournalEntry[],
  opts: DistillOptions = {},
): string {
  if (entries.length === 0) return "";

  const { maxEntries = 10, maxTokens = 800 } = opts;

  const recentEntries = entries.slice(-maxEntries);

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
    charBudget -= line.length + 1;
  }

  if (lines.length === 0) return "";

  let result = header + lines.join("\n") + "\n";

  const tabuBlock = buildTabuHashBlock(sorted);
  if (tabuBlock) result += "\n" + tabuBlock;

  return result;
}

/**
 * Build the KNOWN STERILE BASINS block for the ARCHITECT's system prompt.
 */
export function buildTabuHashBlock(entries: JournalEntry[]): string {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (entry.type === "failure_mode" && entry.zobristHash) {
      seen.add(entry.zobristHash);
    }
  }

  if (seen.size === 0) return "";

  const hashList = [...seen].map(h => `  "${h}"`).join(",\n");

  return (
    `KNOWN STERILE BASINS (TABU HASHES):\n` +
    `The following Zobrist hashes represent completely explored, sterile energy basins.\n` +
    `If you use the 'distributed_tabu_search' skill, you MUST copy these exact strings\n` +
    `into the 'tabuHashes' array of your search node config:\n` +
    `[\n${hashList}\n]\n`
  );
}

// ──────────────────────────────────────────────
// Default journal path
// ──────────────────────────────────────────────

/** Resolves the global journal path relative to the perqed project root. */
export function defaultJournalPath(projectRoot: string): string {
  return join(projectRoot, ".perqed", "journal.jsonl");
}
