/**
 * ProgramDatabase — FunSearch-style persistent program population.
 *
 * Persists every evaluated partition/graph rule as a JSONL file.
 * On each new ARCHITECT call, the top-K lowest-energy programs are
 * injected as few-shot examples, turning the LLM into an evolutionary
 * mutation operator rather than a zero-shot generator.
 *
 * Features:
 *   - Energy-ranked retrieval (topK)
 *   - Structural island classification (diversity pressure)
 *   - Best-per-island retrieval (topKDiverse)
 *   - Few-shot prompt formatting (formatFewShot)
 *   - Deduplication by rule text (keeps lower energy)
 *   - Append-only JSONL persistence
 */

import { existsSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type Island =
  | "modular"
  | "logarithmic"
  | "lookup_table"
  | "digit_sum"
  | "bitwise"
  | "hybrid";

export interface ProgramEntry {
  rule_js: string;
  energy: number;
  description: string;
  island: Island;
  domain_size: number;
  num_partitions: number;
  timestamp: string;
}

// ──────────────────────────────────────────────
// ProgramDatabase
// ──────────────────────────────────────────────

export class ProgramDatabase {
  private entries: Map<string, ProgramEntry>; // keyed by rule_js for dedup
  private readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.entries = new Map();
    this.loadFromDisk();
  }

  // ── Island Classification ──

  /**
   * Classify a partition_rule_js into a structural family (island).
   * Order matters — more specific patterns first.
   */
  static classifyIsland(rule_js: string): Island {
    // Digit-sum: while loop + modulus (base-digit iteration)
    if (rule_js.includes("while") && rule_js.includes("%")) {
      return "digit_sum";
    }
    // Lookup table: array literal
    if (/\[[\d,\s]+\]/.test(rule_js)) {
      return "lookup_table";
    }
    // Logarithmic: Math.log
    if (rule_js.includes("Math.log")) {
      return "logarithmic";
    }
    // Bitwise: &, |, >>, <<
    if (/[&|]|>>|<</.test(rule_js)) {
      return "bitwise";
    }
    // Modular: % as primary operation (no other distinguishing pattern)
    if (rule_js.includes("%")) {
      return "modular";
    }
    // Fallback
    return "hybrid";
  }

  // ── CRUD ──

  /**
   * Record a program evaluation. Deduplicates by rule text,
   * keeping the entry with the lower energy.
   */
  record(entry: Omit<ProgramEntry, "timestamp" | "island">): void {
    const island = ProgramDatabase.classifyIsland(entry.rule_js);
    const timestamp = new Date().toISOString();
    const full: ProgramEntry = { ...entry, island, timestamp };

    const existing = this.entries.get(entry.rule_js);
    if (existing && existing.energy <= entry.energy) {
      return; // Already have a better or equal result for this rule
    }

    this.entries.set(entry.rule_js, full);
    this.appendToDisk(full);
  }

  /**
   * Return the K programs with the lowest energy, sorted ascending.
   */
  topK(k: number): ProgramEntry[] {
    const sorted = [...this.entries.values()].sort((a, b) => a.energy - b.energy);
    return sorted.slice(0, k);
  }

  /**
   * Return the single best program from each island (diversity pressure).
   * At most one per island, sorted by energy ascending.
   */
  topKDiverse(k: number): ProgramEntry[] {
    const bestByIsland = new Map<Island, ProgramEntry>();

    for (const entry of this.entries.values()) {
      const existing = bestByIsland.get(entry.island);
      if (!existing || entry.energy < existing.energy) {
        bestByIsland.set(entry.island, entry);
      }
    }

    return [...bestByIsland.values()]
      .sort((a, b) => a.energy - b.energy)
      .slice(0, k);
  }

  // ── Prompt Formatting ──

  /**
   * Format the top-K programs as a markdown block for few-shot injection
   * into the ARCHITECT's system prompt.
   */
  formatFewShot(k: number): string {
    const diverse = this.topKDiverse(k);
    if (diverse.length === 0) return "";

    const header = [
      "PROGRAM DATABASE (FunSearch): The following are the best partition rules discovered across ALL previous runs.",
      "Study them carefully. Generate a NEW rule that IMPROVES on these — you may combine, mutate, or extend them.",
      "DO NOT simply repeat a rule below. Each rule's energy E is shown (lower = better, E=0 = perfect witness).",
      "",
    ];

    const entries = diverse.map((p, i) => [
      `### Program ${i + 1} — E=${p.energy} [${p.island}]`,
      `Description: ${p.description}`,
      "```js",
      p.rule_js,
      "```",
      "",
    ].join("\n"));

    return [...header, ...entries].join("\n");
  }

  // ── Persistence ──

  private loadFromDisk(): void {
    if (!existsSync(this.dbPath)) return;

    const lines = readFileSync(this.dbPath, "utf-8")
      .split("\n")
      .filter((l) => l.trim().length > 0);

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as ProgramEntry;
        const existing = this.entries.get(entry.rule_js);
        if (!existing || entry.energy < existing.energy) {
          this.entries.set(entry.rule_js, entry);
        }
      } catch {
        // Skip malformed lines
      }
    }
  }

  private appendToDisk(entry: ProgramEntry): void {
    appendFileSync(this.dbPath, JSON.stringify(entry) + "\n");
  }
}
