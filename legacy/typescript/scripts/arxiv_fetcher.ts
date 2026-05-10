/**
 * ArxivIngester — arXiv API Ingestion Engine
 *
 * Fetches papers from the arXiv Atom API, parses XML, chunks abstracts,
 * embeds them via LocalEmbedder, and batch-upserts to VectorDatabase.
 */

import { XMLParser } from "fast-xml-parser";
import { LocalEmbedder } from "../embeddings/embedder";
import { VectorDatabase, type Premise } from "../embeddings/vector_store";
import { TextChunker } from "../utils/chunker";

export class ArxivIngester {
  private baseUrl = "http://export.arxiv.org/api/query";
  private parser = new XMLParser({ ignoreAttributes: false });

  constructor(
    private embedder: LocalEmbedder,
    private db: VectorDatabase,
  ) {}

  /**
   * Fetches papers from a specific arXiv category and ingests them.
   *
   * @param category - arXiv category (e.g., "math.NT", "math.CO")
   * @param maxResults - Number of papers to fetch (default: 50)
   */
  public async ingestCategory(
    category: string,
    maxResults: number = 50,
  ): Promise<void> {
    console.log(
      `📡 Fetching ${maxResults} papers from arXiv category: ${category}...`,
    );

    const url = `${this.baseUrl}?search_query=cat:${category}&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`arXiv API failed: ${response.status}`);

    const xmlData = await response.text();
    const parsed = this.parser.parse(xmlData);
    const entries = parsed.feed?.entry || [];

    // Ensure entries is an array even if API returns 1 result
    const papers = Array.isArray(entries) ? entries : [entries];
    const premisesToInsert: Premise[] = [];

    console.log(
      `🧠 Processing and embedding ${papers.length} papers...`,
    );

    for (const paper of papers) {
      const rawId = typeof paper.id === "string" ? paper.id : String(paper.id);
      const paperId = rawId.split("/abs/").pop() || rawId;
      const title = String(paper.title ?? "Untitled")
        .replace(/\n/g, " ")
        .trim();
      const abstract = String(paper.summary ?? "")
        .replace(/\n/g, " ")
        .trim();

      if (!abstract) continue;

      const chunks = TextChunker.chunkAbstract(abstract);

      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i]!;
        const vector = await this.embedder.embed(chunkText);

        if (vector.length > 0) {
          premisesToInsert.push({
            id: `arxiv-${paperId}-chunk${i}`,
            theoremSignature: `[arXiv: ${category}] ${title}`,
            successfulTactic: chunkText,
            type: "ARXIV",
            vector,
          });
        }
      }
    }

    if (premisesToInsert.length > 0) {
      console.log(
        `💾 Writing ${premisesToInsert.length} embedded chunks to LanceDB...`,
      );
      await this.db.addPremises(premisesToInsert);
    } else {
      console.log("⚠️ No valid embeddings generated.");
    }
  }
}

// ──────────────────────────────────────────────
// Execution entry point (when run directly)
// ──────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const embedder = new LocalEmbedder();
    const db = new VectorDatabase();
    await db.initialize();

    const ingester = new ArxivIngester(embedder, db);

    // Start with Number Theory and Combinatorics
    await ingester.ingestCategory("math.NT", 20);
    await ingester.ingestCategory("math.CO", 20);

    console.log("✅ arXiv ingestion complete.");
  })();
}
