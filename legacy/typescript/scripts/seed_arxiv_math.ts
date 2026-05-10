#!/usr/bin/env bun
/**
 * seed_arxiv_math.ts — Pure Math Offline Ingestion Script
 *
 * Downloads thousands of formal mathematics papers from arXiv (math.CO, math.LO,
 * math.NT, math.DM) and embeds them locally into the LanceDB vectors store.
 * This completely shields the IdeatorAgent from "garbage" CS/telecom papers 
 * that are frequently hallucinated by basic keyword search.
 *
 * Usage:
 *   bun run src/scripts/seed_arxiv_math.ts --max 5000
 */

import { XMLParser } from "fast-xml-parser";
import { LocalEmbedder } from "../embeddings/embedder";
import { VectorDatabase, TABLE_ARXIV, type Premise } from "../embeddings/vector_store";
import { arxivRateLimiter } from "../net/atb_client";
import { parseArgs } from "util";

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    max: {
      type: "string",
      short: "m",
      default: "1000",
    },
  },
  strict: false,
  allowPositionals: true,
});

const MAX_PAPERS = parseInt(values.max as string, 10);
const CHUNK_SIZE = 500; // max allowed by arXiv API
const DB_PATH = "./data/perqed.lancedb";

const embedder = new LocalEmbedder();
const db = new VectorDatabase(DB_PATH, TABLE_ARXIV);
const parser = new XMLParser({ ignoreAttributes: false });

console.log("═══════════════════════════════════════════════");
console.log("  📚 PERQED — Pure Math Offline Seeding");
console.log("═══════════════════════════════════════════════");
console.log(`  Max Papers: ${MAX_PAPERS}`);
console.log(`  DB Path:    ${DB_PATH}`);
console.log("═══════════════════════════════════════════════\n");

async function run() {
  await db.initialize();
  
  if (!(await embedder.isAvailable())) {
    console.error("❌ Ollama not available! Run 'ollama serve' first.");
    process.exit(1);
  }

  let totalIngested = 0;
  let totalSkipped = 0;

  // Search exclusively within mature pure math fields
  const searchQuery = "cat:math.CO+OR+cat:math.LO+OR+cat:math.NT+OR+cat:math.GM";

  for (let start = 0; start < MAX_PAPERS; start += CHUNK_SIZE) {
    const chunk = Math.min(CHUNK_SIZE, MAX_PAPERS - start);
    console.log(`[ArxivMathSeed] Fetching chunk ${start} to ${start + chunk}...`);
    
    const url = `http://export.arxiv.org/api/query?search_query=${searchQuery}&start=${start}&max_results=${chunk}&sortBy=submittedDate&sortOrder=descending`;
    
    let response;
    try {
      response = await arxivRateLimiter.fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) {
        throw new Error(`arXiv API returned ${response.status}`);
      }
    } catch (e: any) {
      console.warn(`[ArxivMathSeed] Chunk fetch failed: ${e.message}`);
      // Retry logic or graceful abort
      break;
    }

    const xml = await response.text();
    const parsed = parser.parse(xml);
    const rawEntries = parsed?.feed?.entry ?? [];
    const entries = Array.isArray(rawEntries) ? rawEntries : (rawEntries ? [rawEntries] : []);

    if (entries.length === 0) {
      console.log(`[ArxivMathSeed] No more papers returned. Reached the end of the query.`);
      break;
    }

    const papers = entries.map((e: any) => ({
      arxivId: String(e.id ?? "").split("/abs/").pop() ?? String(e.id ?? ""),
      title: String(e.title ?? "Untitled").replace(/\s+/g, " ").trim(),
      abstract: String(e.summary ?? "").replace(/\s+/g, " ").trim(),
    })).filter((p: any) => p.abstract.length > 0);

    console.log(`[ArxivMathSeed] Retrieved ${papers.length} valid abstracts. Embedding...`);
    
    // Batch embedding
    const texts = papers.map((p: any) => `${p.title}\n\n${p.abstract}`);
    const vectors = await embedder.embedBatch(texts);

    const premises: Premise[] = [];
    for (let i = 0; i < papers.length; i++) {
      const v = vectors[i];
      if (!v) {
        totalSkipped++;
        continue;
      }
      premises.push({
        id: `arxiv-${papers[i]!.arxivId}`,
        theoremSignature: papers[i]!.title,
        successfulTactic: papers[i]!.abstract.slice(0, 500),
        paperTitle: papers[i]!.title,
        paperAbstract: papers[i]!.abstract.slice(0, 800),
        type: "ARXIV",
        vector: v,
      });
      totalIngested++;
    }

    if (premises.length > 0) {
      await db.addPremises(premises);
    }
    
    console.log(`[ArxivMathSeed] Inserted ${premises.length} vectors into LanceDB.`);
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log(`  ✅ Offline Seeding complete`);
  console.log(`     Papers ingested: ${totalIngested}`);
  console.log(`     Embed failures:  ${totalSkipped}`);
  console.log("═══════════════════════════════════════════════\n");
}

run().catch(console.error);
