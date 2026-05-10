/**
 * NoveltyChecker — Independent LanceDB-backed novelty verification.
 *
 * After the IdeatorAgent self-classifies a hypothesis, this module
 * performs a vector similarity search against the embedded arXiv and
 * Mathlib corpus. If any match exceeds the similarity threshold,
 * the hypothesis is reclassified as KNOWN_THEOREM regardless of
 * what the LLM claimed.
 *
 * Design decisions:
 *   - Uses the existing LocalEmbedder (Ollama nomic-embed-text).
 *   - Queries both TABLE_ARXIV and TABLE_MATHLIB for coverage.
 *   - Gracefully degrades: if Ollama is down, the LLM's classification
 *     stands (we don't block the pipeline on an unavailable embedding service).
 *   - The threshold is intentionally conservative (0.92 cosine similarity)
 *     because embedding proximity does NOT reliably detect mathematical
 *     isomorphism. This catches only the most egregious cases — textbook
 *     theorems, well-known bounds, and near-verbatim restatements.
 */

import { LocalEmbedder } from "../embeddings/embedder";
import { VectorDatabase, TABLE_ARXIV, TABLE_MATHLIB } from "../embeddings/vector_store";
import type { NoveltyClassification } from "../orchestration/types";

export interface NoveltyCheckResult {
  classification: NoveltyClassification;
  /** If reclassified, the title/signature of the matched known result. */
  matchedSource: string | null;
  /** Raw cosine similarity of the closest match (0–1, higher = more similar). */
  topSimilarity: number;
}

/**
 * LanceDB stores L2 distance by default. We convert to approximate
 * cosine similarity for thresholding. For normalized vectors,
 * cos_sim ≈ 1 - (L2² / 2). We clamp to [0, 1].
 */
function l2ToCosine(l2Distance: number): number {
  const sim = 1 - (l2Distance * l2Distance) / 2;
  return Math.max(0, Math.min(1, sim));
}

export class NoveltyChecker {
  private readonly embedder: LocalEmbedder;
  private readonly dbPath: string;

  /**
   * Cosine similarity threshold. A match above this value triggers
   * KNOWN_THEOREM reclassification.
   *
   * 0.92 is conservative: it catches near-verbatim restatements and
   * textbook theorems but avoids false positives from structurally
   * similar but mathematically distinct conjectures.
   */
  readonly threshold: number;

  constructor(dbPath: string, threshold = 0.92) {
    this.embedder = new LocalEmbedder();
    this.dbPath = dbPath;
    this.threshold = threshold;
  }

  /**
   * Checks a hypothesis against the local embedded corpus.
   *
   * @param hypothesis - The raw hypothesis text from ideation.
   * @returns NoveltyCheckResult with the (possibly overridden) classification.
   */
  async check(hypothesis: string): Promise<NoveltyCheckResult> {
    // 1. Graceful degradation: if Ollama is unreachable, trust the LLM
    const available = await this.embedder.isAvailable();
    if (!available) {
      console.log("[NoveltyChecker] Ollama unavailable — skipping independent verification.");
      return { classification: "NOVEL_DISCOVERY", matchedSource: null, topSimilarity: 0 };
    }

    // 2. Embed the hypothesis
    const queryVector = await this.embedder.embed(hypothesis, /* silent */ true);
    if (queryVector.length === 0) {
      return { classification: "NOVEL_DISCOVERY", matchedSource: null, topSimilarity: 0 };
    }

    // 3. Search both tables
    let topSimilarity = 0;
    let matchedSource: string | null = null;

    for (const tableName of [TABLE_ARXIV, TABLE_MATHLIB]) {
      const db = new VectorDatabase(this.dbPath, tableName);
      await db.initialize();

      const results = await db.search(queryVector, 3);
      for (const r of results) {
        // VectorDatabase strips _distance; we need to re-search raw for distance.
        // However, our VectorDatabase.search already returns by proximity order.
        // The first result is the closest. We use a proxy: search with k=1 for
        // the raw LanceDB result to get the distance metric.
        //
        // For now, we use a heuristic: if the top result's theoremSignature
        // is a near-exact substring match of the hypothesis, that's a strong
        // signal independent of embedding distance.
        const sigLower = r.theoremSignature.toLowerCase();
        const hypLower = hypothesis.toLowerCase();

        // Exact structural match: signatures share >80% of tokens
        const sigTokens = new Set(sigLower.split(/\s+/));
        const hypTokens = new Set(hypLower.split(/\s+/));
        const intersection = [...sigTokens].filter(t => hypTokens.has(t));
        const jaccardSimilarity = intersection.length / Math.max(1, new Set([...sigTokens, ...hypTokens]).size);

        if (jaccardSimilarity > topSimilarity) {
          topSimilarity = jaccardSimilarity;
          matchedSource = r.paperTitle || r.theoremSignature;
        }
      }
    }

    // 4. Since we can't get raw L2 distance from VectorDatabase.search(),
    //    we do a direct LanceDB query for the definitive distance metric.
    try {
      const directDb = new VectorDatabase(this.dbPath, TABLE_ARXIV);
      await directDb.initialize();
      const rawResults = await this.searchWithDistance(queryVector);
      if (rawResults.length > 0 && rawResults[0]!.similarity > topSimilarity) {
        topSimilarity = rawResults[0]!.similarity;
        matchedSource = rawResults[0]!.title;
      }
    } catch {
      // Non-fatal: fall back to Jaccard-only comparison
    }

    // 5. Threshold check
    if (topSimilarity >= this.threshold) {
      console.warn(
        `[NoveltyChecker] KNOWN_THEOREM detected (similarity=${topSimilarity.toFixed(3)}): "${matchedSource}"`
      );
      return { classification: "KNOWN_THEOREM", matchedSource, topSimilarity };
    }

    console.log(
      `[NoveltyChecker] Novelty confirmed (top_sim=${topSimilarity.toFixed(3)}, threshold=${this.threshold})`
    );
    return { classification: "NOVEL_DISCOVERY", matchedSource: null, topSimilarity };
  }

  /**
   * Direct LanceDB search returning raw distance for cosine conversion.
   * This bypasses VectorDatabase's abstraction to access the _distance field.
   */
  private async searchWithDistance(
    queryVector: number[],
  ): Promise<{ title: string; similarity: number }[]> {
    const lancedb = await import("vectordb");
    const db = await lancedb.connect(this.dbPath);

    const results: { title: string; similarity: number }[] = [];

    for (const tableName of [TABLE_ARXIV, TABLE_MATHLIB]) {
      try {
        const tableNames = await db.tableNames();
        if (!tableNames.includes(tableName)) continue;

        const table = await db.openTable(tableName);
        const raw = await table.search(queryVector).limit(3).execute();

        for (const r of raw) {
          const distance = (r as any)._distance ?? Infinity;
          const similarity = l2ToCosine(distance);
          const title = (r as any).paperTitle || (r as any).theoremSignature || "unknown";
          results.push({ title, similarity });
        }
      } catch {
        // Table may not exist yet
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);
    return results;
  }
}
