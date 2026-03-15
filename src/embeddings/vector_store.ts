/**
 * VectorDatabase — LanceDB Wrapper for Premise Storage & Vector Search
 *
 * Manages a local LanceDB instance for storing and retrieving
 * historically successful proof premises via vector similarity.
 */

import * as lancedb from "vectordb";

export interface Premise {
  id: string;
  theoremSignature: string;
  successfulTactic: string;
  type?: "MATHLIB" | "ARXIV";
  vector: number[];
}

export class VectorDatabase {
  private db: lancedb.Connection | null = null;
  private readonly tableName = "mathlib_premises";
  private readonly dbPath: string;

  constructor(dbPath = "./data/perqed.lancedb") {
    this.dbPath = dbPath;
  }

  /**
   * Connects to the local LanceDB directory.
   * Creates the directory if it doesn't exist.
   */
  async initialize(): Promise<void> {
    this.db = await lancedb.connect(this.dbPath);
  }

  /**
   * Upserts premises into the LanceDB table.
   * Creates the table on first insert, appends to it on subsequent calls.
   */
  async addPremises(premises: Premise[]): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    if (premises.length === 0) return;

    const tableNames = await this.db.tableNames();
    if (tableNames.includes(this.tableName)) {
      const table = await this.db.openTable(this.tableName);
      await table.add(premises);
    } else {
      await this.db.createTable(this.tableName, premises);
    }
  }

  /**
   * Finds the top K most similar premises using vector search.
   *
   * @param queryVector - Dense vector to search against
   * @param k - Number of results to return (default: 3)
   * @returns Matching premises (without the heavy vector payload)
   */
  async search(
    queryVector: number[],
    k: number = 3,
  ): Promise<Omit<Premise, "vector">[]> {
    if (!this.db || queryVector.length === 0) return [];

    try {
      const tableNames = await this.db.tableNames();
      if (!tableNames.includes(this.tableName)) return [];

      const table = await this.db.openTable(this.tableName);

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
      console.error("[VectorDB] Search failed:", error.message);
      return [];
    }
  }
}
