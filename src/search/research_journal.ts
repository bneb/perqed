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
  /**
   * Optional: Zobrist hash of the failed adjacency matrix, stored as a
   * decimal string (BigInt-safe JSON transport).
   * Only present on failure_mode entries where the graph was hashed at
   * the moment Z3 returned UNSAT.
   */
  zobristHash?: string;
}

interface JournalFile {
  version: 1;
  entries: JournalEntry[];
  investigations?: Array<{ skill: string; input: string; result: string; timestamp: string }>;
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

  /** Permanent tracking of investigation milestones */
  async recordInvestigation(skill: string, input: string, result: string): Promise<void> {
    const existing = await this.readFile();
    if (!existing.investigations) existing.investigations = [];
    existing.investigations.push({
      skill,
      input,
      result,
      timestamp: new Date().toISOString(),
    });
    await this.writeFile(existing);
  }

  /**
   * Evaluates the relative depth of the current best mathematical basin.
   */
  async getCognitiveTemperature(targetGoal: string): Promise<"EXPLOITATION" | "EXPLORATION"> {
    const file = await this.readFile();
    const attempts = file.entries
      .filter(e => e.target_goal === targetGoal && e.type === "failure_mode")
      .map(f => {
        const match = f.claim.match(/E=(\d+)/);
        return match ? parseInt(match[1]!, 10) : Infinity;
      })
      .filter(e => e !== Infinity);

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
    const file = await this.readFile();
    const allGoalEntries = file.entries.filter(e => e.target_goal === targetGoal);
    
    // Extract failure modes
    const failures = allGoalEntries.filter(e => e.type === "failure_mode");
    
    // Parse energy from claim (e.g., "Algebraic Construction init_alg failed (E=1766).")
    const attempts = failures.map(f => {
      const match = f.claim.match(/E=(\d+)/);
      const eScore = match ? parseInt(match[1]!, 10) : Infinity;
      return { entry: f, energy: eScore, time: new Date(f.timestamp).getTime() };
    });

    // 1. Top 3 Best Attempts (lowest E scores)
    const sortedByEnergy = [...attempts].sort((a, b) => a.energy - b.energy);
    const top3 = sortedByEnergy.slice(0, 3);
    const top3Ids = new Set(top3.map(t => t.entry.id));

    // 2. 2 Most Recent Attempts (that are not already in Top 3)
    const sortedByTime = [...attempts].sort((a, b) => b.time - a.time);
    const recent2 = [];
    for (const a of sortedByTime) {
      if (!top3Ids.has(a.entry.id)) {
        recent2.push(a);
        if (recent2.length >= 2) break;
      }
    }

    const keeperAttempts = [...top3, ...recent2].sort((a, b) => a.time - b.time);

    let summary = "### Empirical Findings (Memory Manager PRUNED)\n\n";

    if (file.investigations && file.investigations.length > 0) {
      summary += "#### Investigated Constraints & Analogies:\n";
      for (const inv of file.investigations) {
        summary += `- [${inv.skill}] Input: ${inv.input.substring(0, 50)}... -> Result: ${inv.result}\n`;
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
    const { entries } = await this.readFile();
    return entries.filter((e) => e.target_goal === goal);
  }

  /** All entries across all goals, in insertion order. */
  async getAllEntries(): Promise<JournalEntry[]> {
    const { entries } = await this.readFile();
    return entries;
  }

  /**
   * Count consecutive macro-failures at the tail of the journal.
   *
   * Iterates backwards through all entries. Each `failure_mode` entry
   * adds 1 to the streak. Any `lemma` or `observation` entry (a success
   * signal or neutral note) immediately breaks the streak and returns
   * the count accumulated so far.
   *
   * Returns 0 for an empty journal (safe startup default).
   */
  async getConsecutiveMacroFailures(): Promise<number> {
    const { entries } = await this.readFile();
    let streak = 0;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i]!.type === "failure_mode") {
        streak++;
      } else {
        // lemma or observation: streak broken
        break;
      }
    }
    return streak;
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

  let result = header + lines.join("\n") + "\n";

  // Append the tabu hash block if any failure_mode entries carry hashes.
  const tabuBlock = buildTabuHashBlock(sorted);
  if (tabuBlock) result += "\n" + tabuBlock;

  return result;
}

/**
 * Build the KNOWN STERILE BASINS block for the ARCHITECT's system prompt.
 *
 * Extracts Zobrist hashes from failure_mode journal entries and formats
 * them into an explicit instruction block that tells Gemini exactly which
 * hash strings to copy into the `tabuHashes` array of a search node.
 *
 * Returns "" when there are no hashed failure_mode entries (no noise).
 */
export function buildTabuHashBlock(entries: JournalEntry[]): string {
  // Collect unique hashes from failure_mode entries only
  const seen = new Set<string>();
  for (const entry of entries) {
    if (entry.type === "failure_mode" && entry.zobristHash) {
      seen.add(entry.zobristHash);
    }
  }

  if (seen.size === 0) return "";

  const hashList = [...seen].map((h) => `  "${h}"`).join(",\n");

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
  return join(projectRoot, ".perqed", "journal.json");
}
