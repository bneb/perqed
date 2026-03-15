/**
 * Sprint 13b: Seed Mathlib Pipeline Test (TDD RED → GREEN)
 *
 * Tests the end-to-end seeding pipeline:
 * 1. Embed 5 theorems → store in LanceDB → query returns nearest neighbors
 * 2. Validates that search results are structurally correct
 */

import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { rm } from "node:fs/promises";
import { VectorDatabase, type Premise } from "../src/embeddings/vector_store";

const TEST_DB_PATH = "./tmp_test_seed";

// Simulated embeddings (4-dim) — manually crafted so similarity ordering is predictable
const SEED_DATA = [
  {
    id: "nat_add_zero",
    theoremSignature: "theorem nat_add_zero (n : Nat) : n + 0 = n",
    successfulTactic: "rfl",
    vector: [1.0, 0.0, 0.0, 0.0], // arithmetic identity
  },
  {
    id: "nat_add_succ",
    theoremSignature: "theorem nat_add_succ (n m : Nat) : n + Nat.succ m = Nat.succ (n + m)",
    successfulTactic: "rfl",
    vector: [0.9, 0.1, 0.0, 0.0], // close to add_zero (both addition)
  },
  {
    id: "nat_add_comm",
    theoremSignature: "theorem nat_add_comm (n m : Nat) : n + m = m + n",
    successfulTactic: "induction n with | zero => simp [nat_add_zero] | succ n' ih => simp [nat_add_succ, ih]",
    vector: [0.8, 0.2, 0.0, 0.0], // addition commutativity
  },
  {
    id: "nat_mul_zero",
    theoremSignature: "theorem nat_mul_zero (n : Nat) : n * 0 = 0",
    successfulTactic: "induction n with | zero => rfl | succ n' ih => simp [Nat.mul, ih]",
    vector: [0.0, 0.0, 1.0, 0.0], // multiplication identity
  },
  {
    id: "nat_mul_comm",
    theoremSignature: "theorem nat_mul_comm (n m : Nat) : n * m = m * n",
    successfulTactic: "induction n with | zero => simp [nat_mul_zero] | succ n' ih => simp [Nat.mul, ih, nat_add_comm]",
    vector: [0.1, 0.1, 0.8, 0.0], // multiplication commutativity (close to mul_zero)
  },
];

describe("Seed Mathlib Pipeline", () => {

  beforeEach(async () => {
    await rm(TEST_DB_PATH, { recursive: true, force: true });
  });

  afterAll(async () => {
    await rm(TEST_DB_PATH, { recursive: true, force: true });
  });

  test("seeding stores all 5 premises and they are searchable", async () => {
    const db = new VectorDatabase(TEST_DB_PATH);
    await db.initialize();

    await db.addPremises(SEED_DATA);

    // Search for all — should find all 5
    const allResults = await db.search([0.5, 0.5, 0.5, 0.0], 10);
    expect(allResults.length).toBe(5);
  });

  test("querying with addition-like vector returns addition theorems first", async () => {
    const db = new VectorDatabase(TEST_DB_PATH);
    await db.initialize();

    await db.addPremises(SEED_DATA);

    // Query close to addition theorems
    const results = await db.search([0.95, 0.05, 0.0, 0.0], 3);

    expect(results.length).toBe(3);
    // All 3 should be addition theorems (nat_add_*), not multiplication
    const ids = results.map(r => r.id);
    expect(ids).toContain("nat_add_zero");
    expect(ids).toContain("nat_add_succ");
    expect(ids).toContain("nat_add_comm");
  });

  test("querying with multiplication-like vector returns multiplication theorems first", async () => {
    const db = new VectorDatabase(TEST_DB_PATH);
    await db.initialize();

    await db.addPremises(SEED_DATA);

    // Query close to multiplication theorems
    const results = await db.search([0.0, 0.0, 0.95, 0.05], 2);

    expect(results.length).toBe(2);
    // Top result should be nat_mul_zero (closest to [0,0,1,0])
    expect(results[0]!.id).toBe("nat_mul_zero");
    // Second should be nat_mul_comm
    expect(results[1]!.id).toBe("nat_mul_comm");
  });

  test("search results include correct tactic data", async () => {
    const db = new VectorDatabase(TEST_DB_PATH);
    await db.initialize();

    await db.addPremises(SEED_DATA);

    const results = await db.search([1.0, 0.0, 0.0, 0.0], 1);

    expect(results[0]!.id).toBe("nat_add_zero");
    expect(results[0]!.theoremSignature).toContain("n + 0 = n");
    expect(results[0]!.successfulTactic).toBe("rfl");
  });

  test("search results do not include the vector payload", async () => {
    const db = new VectorDatabase(TEST_DB_PATH);
    await db.initialize();

    await db.addPremises(SEED_DATA);

    const results = await db.search([1.0, 0.0, 0.0, 0.0], 1);
    const result = results[0] as any;

    // The vector field should be stripped from results
    expect(result.vector).toBeUndefined();
  });
});
