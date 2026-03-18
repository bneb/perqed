/**
 * VectorDatabase — Dual-Table LanceDB Wrapper
 *
 * Manages two separate LanceDB tables:
 *   - `arxiv_papers`    — informal literature from arXiv (type: "ARXIV")
 *   - `mathlib_premises` — formal Lean 4 theorem signatures (type: "MATHLIB")
 *
 * Backward compatibility:
 *   - The default `tableName` constructor argument is `"mathlib_premises"`, so
 *     all existing callers (seed_mathlib.test.ts, old addPremises calls) are unchanged.
 *   - New callers create a second `VectorDatabase` instance with a different tableName
 *     or use the high-level `addMathlibPremises()` / `searchMathlib()` helpers.
 */

import * as lancedb from "vectordb";

export interface Premise {
  id: string;
  theoremSignature: string;
  successfulTactic: string;
  type?: "MATHLIB" | "ARXIV";
  vector: number[];
}

// ── Table name constants ──────────────────────────────────────────────────

export const TABLE_ARXIV      = "arxiv_papers" as const;
export const TABLE_MATHLIB    = "mathlib_premises" as const;

// ─────────────────────────────────────────────────────────────────────────

export class VectorDatabase {
  private db: lancedb.Connection | null = null;
  private readonly dbPath: string;
  /** Primary table this instance operates on (default: mathlib_premises). */
  readonly tableName: string;

  constructor(dbPath = "./data/perqed.lancedb", tableName: string = TABLE_MATHLIB) {
    this.dbPath = dbPath;
    this.tableName = tableName;
  }

  /**
   * Connects to the local LanceDB directory.
   * Creates the directory if it doesn't exist.
   */
  async initialize(): Promise<void> {
    this.db = await lancedb.connect(this.dbPath);
  }

  // ── Generic table operations ────────────────────────────────────────────

  /**
   * Upserts premises into this instance's primary table.
   * Creates the table on first insert, appends to it on subsequent calls.
   */
  async addPremises(premises: Premise[]): Promise<void> {
    await this._addToTable(this.tableName, premises);
  }

  /**
   * Finds the top K most similar premises using vector search
   * against this instance's primary table.
   *
   * @param queryVector - Dense vector to search against
   * @param k           - Number of results to return (default: 3)
   * @returns Matching premises (without the heavy vector payload)
   */
  async search(
    queryVector: number[],
    k: number = 3,
  ): Promise<Omit<Premise, "vector">[]> {
    return this._searchTable(this.tableName, queryVector, k);
  }

  // ── Mathlib-specific helpers ────────────────────────────────────────────

  /**
   * Upserts formal Lean 4 premises into the `mathlib_premises` table.
   * Equivalent to calling `addPremises` on an instance created with TABLE_MATHLIB.
   */
  async addMathlibPremises(premises: Premise[]): Promise<void> {
    await this._addToTable(TABLE_MATHLIB, premises);
  }

  /**
   * Vector-searches the `mathlib_premises` table for formal Lean 4 theorems.
   *
   * @param queryVector - Dense embedding to search against
   * @param k           - Top-k results (default: 5)
   */
  async searchMathlib(
    queryVector: number[],
    k: number = 5,
  ): Promise<Omit<Premise, "vector">[]> {
    return this._searchTable(TABLE_MATHLIB, queryVector, k);
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async _addToTable(tableName: string, premises: Premise[]): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    if (premises.length === 0) return;

    const tableNames = await this.db.tableNames();
    if (tableNames.includes(tableName)) {
      const table = await this.db.openTable(tableName);
      await table.add(premises);
    } else {
      await this.db.createTable(tableName, premises);
    }
  }

  private async _searchTable(
    tableName: string,
    queryVector: number[],
    k: number,
  ): Promise<Omit<Premise, "vector">[]> {
    if (!this.db || queryVector.length === 0) return [];

    try {
      const tableNames = await this.db.tableNames();
      if (!tableNames.includes(tableName)) return [];

      const table = await this.db.openTable(tableName);

      // Try with type column select; fall back if column doesn't exist (legacy tables)
      let results;
      try {
        results = await table
          .search(queryVector)
          .select(["id", "theoremSignature", "successfulTactic", "type"])
          .limit(k)
          .execute();
      } catch {
        results = await table.search(queryVector).limit(k).execute();
      }

      return results.map((r) => ({
        id: r.id as string,
        theoremSignature: r.theoremSignature as string,
        successfulTactic: r.successfulTactic as string,
        ...(r.type != null ? { type: r.type as "MATHLIB" | "ARXIV" } : {}),
      }));
    } catch (error: any) {
      console.error(`[VectorDB] Search on "${tableName}" failed:`, error.message);
      return [];
    }
  }
}
