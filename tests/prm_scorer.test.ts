/**
 * prm_scorer.test.ts — TDD tests for the Process Reward Model scorer.
 *
 * Red-to-green workflow: specify the contract first, implement to pass.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { scoreCandidates, jaccardNgram } from "../src/agents/prm_scorer";
import { ProgramDatabase } from "../src/search/program_database";

const TMP_DB = "/tmp/test_prm_db.jsonl";

// Wipe the temp DB before each test
beforeEach(() => {
  try { require("fs").unlinkSync(TMP_DB); } catch {}
});

// ── jaccardNgram ──────────────────────────────────────────────────────────────

describe("jaccardNgram", () => {
  it("identical strings → 1.0", () => {
    expect(jaccardNgram("return i % 6;", "return i % 6;", 3)).toBeCloseTo(1.0);
  });

  it("empty vs empty → 1.0", () => {
    expect(jaccardNgram("", "", 3)).toBeCloseTo(1.0);
  });

  it("completely different strings → 0.0 (near)", () => {
    const score = jaccardNgram("aaaaaaa", "bbbbbbb", 3);
    expect(score).toBeCloseTo(0.0);
  });

  it("shared prefix increases similarity", () => {
    const sim1 = jaccardNgram("return i % 6;", "return i % 7;", 3);
    const sim2 = jaccardNgram("return i % 6;", "xyz abc 123.", 3);
    expect(sim1).toBeGreaterThan(sim2);
  });
});

// ── scoreCandidates ───────────────────────────────────────────────────────────

describe("scoreCandidates — empty database", () => {
  it("single candidate gets positive score (novelty=1, nothing to compare against)", () => {
    const db = new ProgramDatabase(TMP_DB);
    const scored = scoreCandidates([{ rule_js: "return i % 6;", description: "simple" }], db);
    expect(scored).toHaveLength(1);
    expect(scored[0]!.score).toBeGreaterThan(0);
    expect(scored[0]!.novelty).toBeCloseTo(1.0);
  });

  it("quadratic candidate scores higher than linear (complexity bonus)", () => {
    const db = new ProgramDatabase(TMP_DB);
    const scored = scoreCandidates([
      { rule_js: "return (i * i + 1) % 13 % 6;", description: "quad" },
      { rule_js: "return i % 6;", description: "linear" },
    ], db);
    const quad = scored.find(s => s.candidate.description === "quad")!;
    const linear = scored.find(s => s.candidate.description === "linear")!;
    expect(quad.complexity).toBeGreaterThan(linear.complexity);
    expect(quad.score).toBeGreaterThan(linear.score);
  });
});

describe("scoreCandidates — duplicate penalty", () => {
  it("exact duplicate of known failure gets score ≤ 0", () => {
    const db = new ProgramDatabase(TMP_DB);
    db.record({ rule_js: "return i % 6;", energy: 1980, description: "known bad", domain_size: 537, num_partitions: 6 });
    const scored = scoreCandidates([{ rule_js: "return i % 6;", description: "dup" }], db);
    expect(scored[0]!.drift_penalty).toBe(-1);
    expect(scored[0]!.score).toBeLessThanOrEqual(0);
  });

  it("near-duplicate (same rule, different spacing) does NOT get penalty", () => {
    const db = new ProgramDatabase(TMP_DB);
    db.record({ rule_js: "return i % 6;", energy: 1980, description: "known bad", domain_size: 537, num_partitions: 6 });
    // Different rule (extra space)
    const scored = scoreCandidates([{ rule_js: "return  i % 6;", description: "almost-dup" }], db);
    expect(scored[0]!.drift_penalty).toBe(0); // no exact match
  });
});

describe("scoreCandidates — island diversity", () => {
  it("candidate from under-represented island gets diversity bonus", () => {
    const db = new ProgramDatabase(TMP_DB);
    // Fill top-10 with modular rules
    for (let i = 0; i < 10; i++) {
      db.record({ rule_js: `return (i + ${i}) % 6;`, energy: 100 + i, description: `mod${i}`, domain_size: 537, num_partitions: 6 });
    }
    // A lookup_table candidate gets diversity bonus (not in top-10 islands)
    const scored = scoreCandidates([
      { rule_js: "return [0,1,2,3,4,5][i % 6];", description: "lookup" },
    ], db);
    expect(scored[0]!.diversity_bonus).toBe(0.3);
  });

  it("candidate from already-represented island gets no diversity bonus", () => {
    const db = new ProgramDatabase(TMP_DB);
    db.record({ rule_js: "return i % 6;", energy: 1000, description: "mod", domain_size: 537, num_partitions: 6 });
    // Another modular rule — island already in top-10
    const scored = scoreCandidates([{ rule_js: "return (i + 1) % 6;", description: "mod2" }], db);
    expect(scored[0]!.diversity_bonus).toBe(0);
  });
});

describe("scoreCandidates — ordering", () => {
  it("returns candidates sorted descending by score", () => {
    const db = new ProgramDatabase(TMP_DB);
    const scored = scoreCandidates([
      { rule_js: "return (i * i + 1) % 13 % 6;", description: "quad" },
      { rule_js: "return i % 6;", description: "linear" },
      { rule_js: "return [0,1,2,3,4,5][i % 6];", description: "lookup" },
    ], db);
    for (let i = 1; i < scored.length; i++) {
      expect(scored[i - 1]!.score).toBeGreaterThanOrEqual(scored[i]!.score);
    }
  });
});
