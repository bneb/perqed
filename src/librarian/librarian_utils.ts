/**
 * librarian_utils.ts — Pure utility functions for the Librarian stage.
 *
 * All functions here are free of side effects and network calls, making
 * them fully unit-testable and safe to call in any context.
 *
 * Exports:
 *   - extractSearchQuery()       Bug 4: normalise raw prompt before embedding
 *   - keywordLiteratureFallback() Bug 5: offline fallback from seed_literature.json
 *   - formatLibraryMatch()       Bug 2: type-aware rendering for ARCHITECT injection
 */

import { join } from "node:path";
import type { Premise } from "../embeddings/vector_store";

// ── Bug 4: extractSearchQuery ─────────────────────────────────────────────

/**
 * Normalise a raw user prompt into a clean semantic query suitable for
 * dense vector embedding.
 *
 * Stripping strategy (applied in order):
 *   1. Fenced code blocks (``` ... ```)   — Lean, JSON, shell snippets
 *   2. Inline JSON objects ({ ... })      — search_config blobs
 *   3. Markdown structural characters     — #, >, |, -, * at line start
 *   4. Excess whitespace                  — collapse to single spaces
 *   5. Length cap at 400 chars            — ~100 tokens, optimal for nomic-embed-text
 *
 * @param prompt  Raw user input (may be hundreds of lines)
 * @returns Normalised plain-text query, ≤400 chars
 */
export function extractSearchQuery(prompt: string): string {
  return prompt
    // 1. Strip fenced code blocks (including content)
    .replace(/```[\s\S]*?```/g, " ")
    // 2. Strip inline JSON objects (greedy within one brace level)
    .replace(/\{[^{}]*\}/g, " ")
    // 3. Strip markdown structural characters at line start
    .replace(/^[ \t]*[-*#>|`]+/gm, "")
    // 4. Collapse whitespace
    .replace(/\s+/g, " ")
    .trim()
    // 5. Cap at 400 characters
    .slice(0, 400)
    .trim();
}

// ── Bug 5: keywordLiteratureFallback ─────────────────────────────────────

interface SeedEntry {
  title: string;
  summary: string;
}

type SeedLiterature = Record<string, SeedEntry[]>;

/** Lazily loaded seed corpus — read once per process. */
let _seedCache: SeedLiterature | null = null;

function loadSeedLiterature(): SeedLiterature {
  if (_seedCache) return _seedCache;
  try {
    // Resolve relative to this file's directory so it works regardless of CWD
    const seedPath = join(import.meta.dir, "seed_literature.json");
    // Bun.file().text() is async; fall back to synchronous readFileSync for
    // the cold-path that must work even without await (called in sync context).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const raw = require("node:fs").readFileSync(seedPath, "utf8");
    _seedCache = JSON.parse(raw) as SeedLiterature;
    return _seedCache;
  } catch {
    return {};
  }
}

/**
 * Keyword-based offline fallback for when Ollama or the vector DB is
 * unavailable.
 *
 * Reads domain keywords from src/librarian/seed_literature.json. If the
 * context string contains any keyword (case-insensitive), that domain's
 * entries are included in the output block.
 *
 * Returns an empty string if no domain keywords match — caller can skip
 * injection entirely in that case.
 *
 * @param contextText  Normalised search query or raw prompt
 * @returns Formatted markdown block for prompt injection, or "" if no match
 */
export function keywordLiteratureFallback(contextText: string): string {
  const seed = loadSeedLiterature();
  const q = contextText.toLowerCase();
  const matched: SeedEntry[] = [];
  const seen = new Set<string>();

  for (const [keyword, entries] of Object.entries(seed)) {
    if (q.includes(keyword)) {
      for (const entry of entries) {
        if (!seen.has(entry.title)) {
          seen.add(entry.title);
          matched.push(entry);
        }
      }
    }
  }

  if (matched.length === 0) return "";

  const lines = matched.map((e) => `- **[Paper]** ${e.title}\n  ${e.summary}`);
  return (
    "\n\n## Relevant Literature (keyword fallback — Ollama unavailable)\n\n" +
    lines.join("\n\n")
  );
}

// ── Bug 2: formatLibraryMatch ─────────────────────────────────────────────

/**
 * Format a single vector-DB match for injection into the ARCHITECT prompt.
 *
 * Renders ARXIV premises as `[Paper]` entries with title + abstract,
 * and MATHLIB/LEAN_RESULT premises as `[Lemma]` entries with theorem
 * signature + tactic. This prevents the ARCHITECT from confusing paper
 * abstracts with usable Lean 4 proof tactics.
 *
 * @param match   Premise returned from VectorDatabase.search()
 * @param index   1-based index for numbered list rendering
 * @returns Formatted markdown string for this single entry
 */
export function formatLibraryMatch(
  match: Omit<Premise, "vector">,
  index: number
): string {
  if (match.type === "ARXIV") {
    const title = (match as any).paperTitle ?? match.theoremSignature;
    const body = (match as any).paperAbstract ?? match.successfulTactic;
    return `${index}. **[Paper]** ${title}\n   ${body}`;
  }

  // MATHLIB or LEAN_RESULT or legacy (no type field)
  return (
    `${index}. **[Lemma]** \`${match.theoremSignature}\`` +
    (match.successfulTactic
      ? `\n   Tactic: \`${match.successfulTactic}\``
      : "")
  );
}
