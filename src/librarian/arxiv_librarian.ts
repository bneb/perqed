/**
 * ArxivLibrarian — Keyword-based arXiv ingestion for domain seeding.
 *
 * Unlike ArxivIngester (category-based), this class takes a list of
 * free-text keyword queries and calls the arXiv search API directly,
 * making it well-suited for targeted domain seeding (e.g., Ramsey theory).
 *
 * Gracefully handles Ollama unavailability — returns {ingested:0, skipped:0}
 * with a single structured warning rather than per-item error spam.
 */

import { XMLParser } from "fast-xml-parser";
import { LocalEmbedder } from "../embeddings/embedder";
import { VectorDatabase, type Premise } from "../embeddings/vector_store";

export interface LibrarianConfig {
  /** Free-text arXiv search queries (e.g. "Ramsey number lower bound Exoo") */
  queries: string[];
  /** Maximum results to fetch per query (default: 20) */
  maxPerQuery: number;
  /** Path to LanceDB directory */
  dbPath: string;
}

export interface LibrarianResult {
  ingested: number;
  skipped: number;
}

interface ArxivPaper {
  arxivId: string;
  title: string;
  abstract: string;
}

export class ArxivLibrarian {
  private readonly embedder: LocalEmbedder;
  private readonly db: VectorDatabase;
  private readonly parser = new XMLParser({ ignoreAttributes: false });
  private readonly baseUrl = "http://export.arxiv.org/api/query";

  constructor(private readonly cfg: LibrarianConfig) {
    this.embedder = new LocalEmbedder();
    this.db = new VectorDatabase(cfg.dbPath);
  }

  /**
   * Runs the ingestion pipeline.
   *
   * 1. Checks Ollama availability (single check, not per-paper).
   * 2. For each query, fetches arXiv metadata via keyword search.
   * 3. Embeds title + abstract pairs via embedBatch().
   * 4. Upserts into LanceDB (skips null embeddings).
   */
  async run(): Promise<LibrarianResult> {
    await this.db.initialize();

    const available = await this.embedder.isAvailable();
    if (!available) {
      console.warn("[Librarian] Ollama not available — skipping embedding pass");
      return { ingested: 0, skipped: 0 };
    }

    let ingested = 0;
    let skipped = 0;

    for (const query of this.cfg.queries) {
      let papers: ArxivPaper[];
      try {
        papers = await this.fetchPapers(query, this.cfg.maxPerQuery);
      } catch (err: any) {
        console.warn(`[Librarian] arXiv fetch failed for "${query}": ${err.message}`);
        continue;
      }

      if (papers.length === 0) continue;

      const texts = papers.map((p) => `${p.title}\n\n${p.abstract}`);
      const vectors = await this.embedder.embedBatch(texts);

      const premises: Premise[] = [];
      for (let i = 0; i < papers.length; i++) {
        const v = vectors[i];
        if (!v) {
          skipped++;
          continue;
        }
        premises.push({
          id: `arxiv-${papers[i]!.arxivId}`,
          theoremSignature: papers[i]!.title,
          successfulTactic: papers[i]!.abstract.slice(0, 500),
          type: "ARXIV",
          vector: v,
        });
        ingested++;
      }

      if (premises.length > 0) {
        await this.db.addPremises(premises);
      }
      console.log(`[Librarian] "${query}": +${premises.length} papers (${papers.length - premises.length} skipped)`);
    }

    return { ingested, skipped };
  }

  /**
   * Counts the number of premises currently in the vector store.
   * Used by perqed.ts to decide whether background seeding is needed.
   */
  async count(): Promise<number> {
    await this.db.initialize();
    // Use a zero-dim query that returns 0 results to check table existence,
    // then fall through to a tiny dummy query.
    try {
      // Embed a dummy string — if Ollama is down, this returns [].
      // We can't (easily) count rows in LanceDB without a search,
      // so we use a 1-NN search on a zero vector as a proxy.
      const dummyVec = new Array(768).fill(0) as number[];
      const results = await this.db.search(dummyVec, 1);
      // If any results come back, there are rows in the table.
      return results.length > 0 ? 999 : 0; // 999 = "enough, don't seed"
    } catch {
      return 0;
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async fetchPapers(query: string, maxResults: number): Promise<ArxivPaper[]> {
    const encoded = encodeURIComponent(query);
    const url = `${this.baseUrl}?search_query=all:${encoded}&max_results=${maxResults}&sortBy=relevance`;
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      throw new Error(`arXiv API returned ${response.status}`);
    }

    const xml = await response.text();
    const parsed = this.parser.parse(xml);
    const rawEntries = parsed?.feed?.entry ?? [];
    const entries = Array.isArray(rawEntries) ? rawEntries : [rawEntries];

    return entries
      .map((e: any) => ({
        arxivId: String(e.id ?? "").split("/abs/").pop() ?? String(e.id ?? ""),
        title: String(e.title ?? "Untitled").replace(/\s+/g, " ").trim(),
        abstract: String(e.summary ?? "").replace(/\s+/g, " ").trim(),
      }))
      .filter((p: ArxivPaper) => p.abstract.length > 0);
  }
}
