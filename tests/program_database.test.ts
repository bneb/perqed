/**
 * program_database.test.ts — RED-to-GREEN tests for the FunSearch Program Database.
 *
 * Tests:
 *   1. record + topK: insert programs, retrieve sorted by energy
 *   2. classifyIsland: modular, logarithmic, lookup, digit_sum, bitwise, hybrid
 *   3. topKDiverse: returns best-per-island, not N from the same family
 *   4. formatFewShot: output contains energy, rule, and description
 *   5. Deduplication: same rule text is not stored twice
 *   6. JSONL persistence: write, reload, data survives
 */
import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { ProgramDatabase, type ProgramEntry } from "../src/search/program_database";
import { existsSync, unlinkSync } from "node:fs";

const TEST_DB_PATH = "/tmp/test_program_database.jsonl";

function cleanup() {
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
}

// ── Test data ──

const PROGRAMS: Omit<ProgramEntry, "timestamp" | "island">[] = [
  { rule_js: "return (i - 1) % 6;", energy: 1980, description: "Simple mod-6", domain_size: 537, num_partitions: 6 },
  { rule_js: "return Math.floor(Math.log2(i)) % 6;", energy: 1432, description: "Log2 mod 6", domain_size: 537, num_partitions: 6 },
  { rule_js: "return Math.log2(i & -i) % 6;", energy: 1093, description: "2-adic valuation", domain_size: 537, num_partitions: 6 },
  { rule_js: "return [0,1,2,3,4,5,0,1,2,4,5,3,0,2,1,4,5,3][(i-1) % 18];", energy: 407, description: "Period-18 lookup", domain_size: 537, num_partitions: 6 },
  { rule_js: "let s=0,t=i;while(t>0){s+=t%3;t=Math.floor(t/3);}return s%6;", energy: 1980, description: "Digit-sum base 3", domain_size: 537, num_partitions: 6 },
];

// ── 1. record + topK ──

describe("ProgramDatabase — record + topK", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("returns programs sorted by energy (ascending)", () => {
    const db = new ProgramDatabase(TEST_DB_PATH);
    for (const p of PROGRAMS) db.record(p);

    const top3 = db.topK(3);
    expect(top3).toHaveLength(3);
    expect(top3[0].energy).toBe(407);      // Period-18 lookup
    expect(top3[1].energy).toBe(1093);     // 2-adic
    expect(top3[2].energy).toBe(1432);     // Log2
  });

  it("topK returns all entries when k > total entries", () => {
    const db = new ProgramDatabase(TEST_DB_PATH);
    for (const p of PROGRAMS) db.record(p);
    const all = db.topK(100);
    expect(all.length).toBe(PROGRAMS.length);
  });
});

// ── 2. classifyIsland ──

describe("ProgramDatabase — classifyIsland", () => {
  it("classifies modular rules", () => {
    expect(ProgramDatabase.classifyIsland("return (i - 1) % 6;")).toBe("modular");
  });

  it("classifies logarithmic rules", () => {
    expect(ProgramDatabase.classifyIsland("return Math.floor(Math.log2(i)) % 6;")).toBe("logarithmic");
  });

  it("classifies lookup table rules", () => {
    expect(ProgramDatabase.classifyIsland("return [0,1,2,3,4,5][(i-1) % 6];")).toBe("lookup_table");
  });

  it("classifies digit-sum (while + % pattern) rules", () => {
    expect(ProgramDatabase.classifyIsland("let s=0,t=i;while(t>0){s+=t%3;t=Math.floor(t/3);}return s%6;")).toBe("digit_sum");
  });

  it("classifies bitwise rules", () => {
    expect(ProgramDatabase.classifyIsland("return (i & 0xFF) >> 2;")).toBe("bitwise");
  });

  it("classifies unknown patterns as hybrid", () => {
    expect(ProgramDatabase.classifyIsland("if (i < 100) return 0; return 5;")).toBe("hybrid");
  });
});

// ── 3. topKDiverse ──

describe("ProgramDatabase — topKDiverse", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("returns at most one program per island", () => {
    const db = new ProgramDatabase(TEST_DB_PATH);
    for (const p of PROGRAMS) db.record(p);

    const diverse = db.topKDiverse(10);
    const islands = diverse.map((p: ProgramEntry) => p.island);
    const uniqueIslands = new Set(islands);
    expect(uniqueIslands.size).toBe(islands.length); // no duplicates
  });

  it("selects the best energy from each island", () => {
    const db = new ProgramDatabase(TEST_DB_PATH);
    // Two modular rules with different energies
    db.record({ rule_js: "return i % 6;", energy: 2000, description: "mod 6a", domain_size: 537, num_partitions: 6 });
    db.record({ rule_js: "return (i - 1) % 6;", energy: 1980, description: "mod 6b", domain_size: 537, num_partitions: 6 });

    const diverse = db.topKDiverse(10);
    const modular = diverse.find((p: ProgramEntry) => p.island === "modular");
    expect(modular).toBeDefined();
    expect(modular!.energy).toBe(1980); // the better one
  });
});

// ── 4. formatFewShot ──

describe("ProgramDatabase — formatFewShot", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("includes energy, rule, and description in few-shot block", () => {
    const db = new ProgramDatabase(TEST_DB_PATH);
    for (const p of PROGRAMS) db.record(p);

    const block = db.formatFewShot(3);
    expect(block).toContain("E=407");
    expect(block).toContain("Period-18 lookup");
    expect(block).toContain("[0,1,2,3,4,5,0,1,2,4,5,3,0,2,1,4,5,3]");
  });

  it("returns empty string when database is empty", () => {
    const db = new ProgramDatabase(TEST_DB_PATH);
    expect(db.formatFewShot(5)).toBe("");
  });
});

// ── 5. Deduplication ──

describe("ProgramDatabase — deduplication", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("does not store the same rule twice", () => {
    const db = new ProgramDatabase(TEST_DB_PATH);
    db.record({ rule_js: "return i % 6;", energy: 2000, description: "first", domain_size: 537, num_partitions: 6 });
    db.record({ rule_js: "return i % 6;", energy: 1500, description: "second", domain_size: 537, num_partitions: 6 });

    const all = db.topK(100);
    expect(all).toHaveLength(1);
  });

  it("keeps the lower energy when a duplicate has better score", () => {
    const db = new ProgramDatabase(TEST_DB_PATH);
    db.record({ rule_js: "return i % 6;", energy: 2000, description: "first", domain_size: 537, num_partitions: 6 });
    db.record({ rule_js: "return i % 6;", energy: 1500, description: "improved", domain_size: 537, num_partitions: 6 });

    const all = db.topK(100);
    expect(all[0].energy).toBe(1500);
  });
});

// ── 6. JSONL Persistence ──

describe("ProgramDatabase — JSONL persistence", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("survives destruction and reconstruction", () => {
    // Write
    const db1 = new ProgramDatabase(TEST_DB_PATH);
    for (const p of PROGRAMS) db1.record(p);

    // Reload
    const db2 = new ProgramDatabase(TEST_DB_PATH);
    const top = db2.topK(3);
    expect(top).toHaveLength(3);
    expect(top[0].energy).toBe(407);
  });

  it("appends to existing file on subsequent records", () => {
    const db1 = new ProgramDatabase(TEST_DB_PATH);
    db1.record(PROGRAMS[0]);

    // Separate instance appends
    const db2 = new ProgramDatabase(TEST_DB_PATH);
    db2.record(PROGRAMS[1]);

    // Third instance reads all
    const db3 = new ProgramDatabase(TEST_DB_PATH);
    expect(db3.topK(100)).toHaveLength(2);
  });
});
