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
import { join } from "node:path";
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

  /** Path to the JSON sidecar that persists ingestion metadata. */
  private get metaPath(): string {
    return join(this.cfg.dbPath, "librarian_meta.json");
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
          // Populate arXiv-specific fields with clear labeling (Bug 2)
          paperTitle: papers[i]!.title,
          paperAbstract: papers[i]!.abstract.slice(0, 800),
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

    // Write metadata sidecar so count() doesn't need Ollama or zero-vector search
    const meta = {
      totalIngested: ingested,
      lastSeeded: new Date().toISOString(),
    };
    await Bun.write(this.metaPath, JSON.stringify(meta, null, 2));

    return { ingested, skipped };
  }

  /**
   * Counts ingested premises using the sidecar metadata file.
   *
   * Bug 3 fix: the previous implementation searched LanceDB with a zero
   * vector (unreliable, Ollama-dependent, returns magic sentinel 999).
   * We now write a simple JSON sidecar at the end of every run() and read
   * it here — zero network calls, zero Ollama dependency, exact count.
   *
   * @returns Number of premises ingested in the last run(), or 0 on first run.
   */
  async count(): Promise<number> {
    try {
      const f = Bun.file(this.metaPath);
      if (!(await f.exists())) return 0;
      const meta = await f.json() as { totalIngested: number; lastSeeded: string };
      if (typeof meta.totalIngested !== "number") return 0;
      return meta.totalIngested;
    } catch {
      return 0;
    }
  }

  /** Returns true when the DB is sparse enough to warrant background re-seeding. */
  async needsSeeding(minPremises = 50, maxAgeDays = 7): Promise<boolean> {
    try {
      const f = Bun.file(this.metaPath);
      if (!(await f.exists())) return true;
      const meta = await f.json() as { totalIngested: number; lastSeeded: string };
      if ((meta.totalIngested ?? 0) < minPremises) return true;
      const ageMs = Date.now() - new Date(meta.lastSeeded).getTime();
      return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
    } catch {
      return true;
    }
  }

  /** Search the embedded arXiv database using the LocalEmbedder */
  async searchDatabase(query: string, options: { limit?: number } = {}): Promise<Omit<Premise, "vector">[]> {
    await this.db.initialize();
    
    // Safety check: is Ollama alive?
    const available = await this.embedder.isAvailable();
    if (!available) {
      console.warn("[Librarian] Ollama not available — falling back to empty search results");
      return [];
    }

    const queryVector = await this.embedder.embed(query);
    if (queryVector.length === 0) return [];
    
    return this.db.search(queryVector, options.limit ?? 5);
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
