/**
 * prm_scorer.ts — Process Reward Model for partition rule candidate scoring.
 *
 * Instead of passing the full ResearchJournal to the ARCHITECT's replanDAG,
 * the PRM scores a beam of N candidates using fast heuristics (no LLM call),
 * allowing the ARCHITECT to generate diverse options and the PRM to prune them.
 *
 * Score = novelty + diversity_bonus + drift_penalty + complexity
 */

import type { ProgramDatabase, Island } from "../search/program_database";
import { ProgramDatabase as PDB } from "../search/program_database";

export interface PRMCandidate {
  rule_js: string;
  description: string;
}

export interface PRMScore {
  candidate: PRMCandidate;
  /** Composite 0..1+ score. Higher = more promising. */
  score: number;
  novelty: number;
  diversity_bonus: number;
  /** Negative if this candidate is a known failure. */
  drift_penalty: number;
  complexity: number;
  island: Island;
}

/**
 * Score a beam of candidates using fast heuristics.
 * Returns candidates sorted descending by score (best first).
 */
export function scoreCandidates(
  candidates: PRMCandidate[],
  programDb: ProgramDatabase,
): PRMScore[] {
  const topK = programDb.topK(50);
  const top10Islands = new Set(programDb.topK(10).map(e => e.island));

  return candidates.map(c => {
    const island = PDB.classifyIsland(c.rule_js);

    // Novelty: 1 - max(Jaccard trigram similarity) over top-50 known rules
    const novelty = 1 - (topK.length === 0 ? 0 : Math.max(
      0,
      ...topK.map(k => jaccardNgram(c.rule_js, k.rule_js, 3))
    ));

    // Diversity: extra credit if island is under-represented in current top-10
    const diversity_bonus = top10Islands.has(island) ? 0 : 0.3;

    // Drift penalty: −1 if this is an EXACT duplicate of any known failure
    const drift_penalty = topK.some(k => k.rule_js.trim() === c.rule_js.trim()) ? -1 : 0;

    // Complexity: quadratic terms > linear > constant-like
    const complexity =
      c.rule_js.includes("* i") || c.rule_js.includes("i *") ? 0.3
      : c.rule_js.includes("i") ? 0.1
      : 0;

    const score = Math.max(0, novelty + diversity_bonus + drift_penalty + complexity);
    return { candidate: c, score, novelty, diversity_bonus, drift_penalty, complexity, island };
  }).sort((a, b) => b.score - a.score);
}

// ── Text similarity helpers ───────────────────────────────────────────────────

/**
 * Jaccard similarity on character n-grams of two strings.
 * Returns a value in [0, 1]. 0 = completely dissimilar, 1 = identical.
 */
export function jaccardNgram(a: string, b: string, n: number): number {
  const setA = new Set(extractNgrams(a, n));
  const setB = new Set(extractNgrams(b, n));
  let intersection = 0;
  for (const g of setA) { if (setB.has(g)) intersection++; }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

function extractNgrams(s: string, n: number): string[] {
  if (s.length < n) return [s];
  return Array.from({ length: s.length - n + 1 }, (_, i) => s.slice(i, i + n));
}
