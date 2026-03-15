/**
 * Sprint 13: VectorDatabase Tests (TDD RED → GREEN)
 *
 * Tests the LanceDB wrapper for premise storage and vector search.
 * Uses a temp directory for the database to avoid polluting the workspace.
 */

import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { rm } from "node:fs/promises";
import { VectorDatabase, type Premise } from "../src/embeddings/vector_store";

const TEST_DB_PATH = "./tmp_test_vector_db";

describe("VectorDatabase", () => {

  beforeEach(async () => {
    await rm(TEST_DB_PATH, { recursive: true, force: true });
  });

  afterAll(async () => {
    await rm(TEST_DB_PATH, { recursive: true, force: true });
  });

  test("initializes without error", async () => {
    const db = new VectorDatabase(TEST_DB_PATH);
    await db.initialize();
    // If we get here without throwing, initialization succeeded
    expect(true).toBe(true);
  });

  test("addPremises stores premises and search retrieves them", async () => {
    const db = new VectorDatabase(TEST_DB_PATH);
    await db.initialize();

    const premises: Premise[] = [
      {
        id: "nat_add_comm",
        theoremSignature: "(n m : Nat) : n + m = m + n",
        successfulTactic: "induction n; simp; ring",
        vector: [1.0, 0.0, 0.0, 0.0],
      },
      {
        id: "nat_add_zero",
        theoremSignature: "(n : Nat) : n + 0 = n",
        successfulTactic: "simp",
        vector: [0.0, 1.0, 0.0, 0.0],
      },
    ];

    await db.addPremises(premises);

    // Search with a vector close to nat_add_comm
    const results = await db.search([0.9, 0.1, 0.0, 0.0], 1);
    expect(results.length).toBe(1);
    expect(results[0]!.id).toBe("nat_add_comm");
    expect(results[0]!.theoremSignature).toContain("n + m = m + n");
    expect(results[0]!.successfulTactic).toBe("induction n; simp; ring");
  });

  test("search returns top K results ordered by similarity", async () => {
    const db = new VectorDatabase(TEST_DB_PATH);
    await db.initialize();

    const premises: Premise[] = [
      { id: "a", theoremSignature: "thm_a", successfulTactic: "tac_a", vector: [1, 0, 0, 0] },
      { id: "b", theoremSignature: "thm_b", successfulTactic: "tac_b", vector: [0, 1, 0, 0] },
      { id: "c", theoremSignature: "thm_c", successfulTactic: "tac_c", vector: [0, 0, 1, 0] },
    ];

    await db.addPremises(premises);

    // Query close to "a"
    const results = await db.search([0.9, 0.05, 0.05, 0.0], 2);
    expect(results.length).toBe(2);
    // First result should be the most similar (closest to query)
    expect(results[0]!.id).toBe("a");
  });

  test("search returns [] when table does not exist", async () => {
    const db = new VectorDatabase(TEST_DB_PATH);
    await db.initialize();

    const results = await db.search([1, 0, 0], 3);
    expect(results).toEqual([]);
  });

  test("search returns [] when queryVector is empty", async () => {
    const db = new VectorDatabase(TEST_DB_PATH);
    await db.initialize();

    const results = await db.search([], 3);
    expect(results).toEqual([]);
  });

  test("addPremises with empty array is a no-op", async () => {
    const db = new VectorDatabase(TEST_DB_PATH);
    await db.initialize();

    // Should not throw
    await db.addPremises([]);
    expect(true).toBe(true);
  });

  test("addPremises appends to existing table", async () => {
    const db = new VectorDatabase(TEST_DB_PATH);
    await db.initialize();

    await db.addPremises([
      { id: "first", theoremSignature: "thm_1", successfulTactic: "t1", vector: [1, 0, 0, 0] },
    ]);

    await db.addPremises([
      { id: "second", theoremSignature: "thm_2", successfulTactic: "t2", vector: [0, 1, 0, 0] },
    ]);

    // Both should be searchable
    const results = await db.search([0.5, 0.5, 0, 0], 5);
    expect(results.length).toBe(2);
  });
});
