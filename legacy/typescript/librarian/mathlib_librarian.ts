/**
 * MathlibLibrarian — Formal Lean 4 Premise Ingestion Pipeline
 *
 * Accepts a JSON array of Lean 4 theorem definitions, embeds their docstrings
 * (or signatures when no docstring is present), and stores them in the
 * `mathlib_premises` LanceDB table via VectorDatabase.addMathlibPremises().
 *
 * Designed for:
 *   - Bootstrap seeding from a curated JSON file of fundamental theorems
 *   - Incremental updates as new Lean proofs are verified by Perqed
 *   - Mid-proof RAG: the DAG `mathlib_query` node retrieves from this table
 *
 * Graceful degradation: if Ollama is unavailable, ingestion is skipped
 * (returns {ingested:0, skipped:0}) — never throws.
 */

import { LocalEmbedder } from "../embeddings/embedder";
import { VectorDatabase, TABLE_MATHLIB, type Premise } from "../embeddings/vector_store";

// ──────────────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────────────

/** A Lean 4 theorem definition accepted by MathlibLibrarian. */
export interface MathlibPremise {
  name: string;
  signature: string;
  dependencies: string[]; // List of theorems this premise depends on
  ast_hash: string;       // Structural hash
  docstring?: string;
  module?: string;
  embedding?: number[];
}

export interface MathlibLibrarianConfig {
  dbPath: string;
  /** Maximum number of theorems to process per batch (default: 32) */
  batchSize?: number;
}

export interface MathlibIngestionResult {
  ingested: number;
  skipped: number;
}

// ──────────────────────────────────────────────────────────────────────────
// MathlibLibrarian
// ──────────────────────────────────────────────────────────────────────────

export class MathlibLibrarian {
  private readonly embedder: LocalEmbedder;
  private readonly db: VectorDatabase;
  private readonly batchSize: number;

  constructor(private readonly cfg: MathlibLibrarianConfig) {
    this.embedder = new LocalEmbedder();
    // Always use the mathlib_premises table regardless of default
    this.db = new VectorDatabase(cfg.dbPath, TABLE_MATHLIB);
    this.batchSize = cfg.batchSize ?? 32;
  }

  /**
   * Ingests an array of Lean 4 theorem definitions into the mathlib_premises table.
   *
   * @param theorems - Array of Lean 4 definitions to embed and store
   * @returns {ingested, skipped} counts
   */
  async ingest(theorems: MathlibPremise[]): Promise<MathlibIngestionResult> {
    await this.db.initialize();

    const available = await this.embedder.isAvailable();
    if (!available) {
      console.warn("[MathlibLibrarian] Ollama not available — skipping ingestion");
      return { ingested: 0, skipped: 0 };
    }

    let ingested = 0;
    let skipped = 0;

    // Process in batches to avoid memory pressure on large theorem sets
    for (let batchStart = 0; batchStart < theorems.length; batchStart += this.batchSize) {
      const batch = theorems.slice(batchStart, batchStart + this.batchSize);
      // Embed AST structure and dependencies instead of raw docstrings
      const texts = batch.map((t) => `${t.signature}\nDependencies: ${t.dependencies.join(", ")}\nAST Hash: ${t.ast_hash}`);

      const vectors = await this.embedder.embedBatch(texts);
      const premises: Premise[] = [];

      for (let i = 0; i < batch.length; i++) {
        const v = vectors[i];
        const t = batch[i]!;

        if (!v) {
          skipped++;
          console.warn(`[MathlibLibrarian] Embed failed for "${t.name}" — skipping`);
          continue;
        }

        premises.push({
          id: `mathlib-${t.name}`,
          theoremSignature: t.signature,
          successfulTactic: JSON.stringify({ deps: t.dependencies, ast_hash: t.ast_hash }),
          type: "MATHLIB",
          vector: v,
        });
        ingested++;
      }

      if (premises.length > 0) {
        await this.db.addMathlibPremises(premises);
      }
    }

    console.log(`[MathlibLibrarian] Ingestion complete: ${ingested} stored, ${skipped} skipped`);
    return { ingested, skipped };
    }
    }

    export async function getStructuralContext(targetConcept: string) {
    // 1. Vector search for targetConcept
    // 2. Fetch immediate dependencies of the top results to provide deep structural context.
    return `Structural context for ${targetConcept} (Implementation pending RAG expansion)`;
    }
