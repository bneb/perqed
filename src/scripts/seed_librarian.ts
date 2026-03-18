#!/usr/bin/env bun
/**
 * seed_librarian.ts — Domain seeding script.
 *
 * Fetches and embeds domain-relevant arXiv papers (Ramsey theory,
 * SA graph coloring, flag algebras, Lean 4 verification) into LanceDB
 * so the ARCHITECT has RAG context from the first run.
 *
 * Prerequisites:
 *   - Ollama running with nomic-embed-text pulled:
 *       ollama serve && ollama pull nomic-embed-text
 *
 * Usage:
 *   bun run src/scripts/seed_librarian.ts
 */

import { ArxivLibrarian } from "../librarian/arxiv_librarian";
import { DOMAIN_SEED_QUERIES } from "../librarian/seed_queries";

const DB_PATH = "./data/perqed.lancedb";

console.log("═══════════════════════════════════════════════");
console.log("  📚 PERQED — Domain Librarian Seeding");
console.log("═══════════════════════════════════════════════");
console.log(`  Queries:  ${DOMAIN_SEED_QUERIES.length}`);
console.log(`  DB Path:  ${DB_PATH}`);
console.log("═══════════════════════════════════════════════\n");

const librarian = new ArxivLibrarian({
  queries: DOMAIN_SEED_QUERIES,
  maxPerQuery: 15,
  dbPath: DB_PATH,
});

const { ingested, skipped } = await librarian.run();

console.log("\n═══════════════════════════════════════════════");
console.log(`  ✅ Seeding complete`);
console.log(`     Papers ingested: ${ingested}`);
console.log(`     Embed failures:  ${skipped}`);
console.log("═══════════════════════════════════════════════\n");
