/**
 * Sprint 15: The Conjecturer Pipeline
 *
 * Autonomous mathematical hypothesis generation:
 * 1. Pull recent arXiv literature from LanceDB
 * 2. Prompt Gemini ARCHITECT to synthesize novel Lean 4 theorems
 * 3. Run The Gauntlet: syntax check + triviality spray
 * 4. Queue survivors to open_conjectures.json
 *
 * Usage:
 *   GEMINI_API_KEY=... bun run src/scripts/generate_conjectures.ts
 */

import { ConjecturerAgent } from "../agents/conjecturer";
import { LocalEmbedder } from "../embeddings/embedder";
import { VectorDatabase } from "../embeddings/vector_store";
import { LeanBridge } from "../lean_bridge";
import * as fs from "node:fs/promises";

const QUEUE_FILE = "./data/open_conjectures.json";

async function main() {
  console.log("🔬 Initiating The Conjecturer...\n");

  // ── Validate environment ──
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY not set. Export it before running.");
    process.exit(1);
  }

  // ── Initialize services ──
  const db = new VectorDatabase();
  await db.initialize();
  const embedder = new LocalEmbedder();
  const lean = new LeanBridge();
  const agent = new ConjecturerAgent(apiKey);

  // ── 1. Pull literature from the Librarian ──
  console.log("📚 Querying LanceDB for recent arXiv literature...");

  // Embed a broad mathematical query to pull diverse literature
  const queryVector = await embedder.embed(
    "novel theorems in number theory combinatorics algebraic structures",
  );

  if (queryVector.length === 0) {
    console.error("❌ Failed to embed query. Is Ollama running?");
    process.exit(1);
  }

  const recentPapers = await db.search(queryVector, 10);
  const arxivPapers = recentPapers.filter((p) => p.id.startsWith("arxiv-"));

  if (arxivPapers.length === 0) {
    console.log("⚠️ No arXiv literature found. Run arxiv_fetcher.ts first.");
    return;
  }

  const literatureContext = arxivPapers
    .map((p) => `[${p.theoremSignature}]\n${p.successfulTactic}`)
    .join("\n\n");

  console.log(`  Found ${arxivPapers.length} relevant arXiv chunks.\n`);

  // ── 2. Ideate ──
  console.log("🧠 Prompting Conjecturer to synthesize novel theorems...");
  const rawConjectures = await agent.generateConjectures(literatureContext);
  console.log(`  Generated ${rawConjectures.length} raw candidates.\n`);

  // ── 3. The Gauntlet ──
  console.log("⚔️  Running The Gauntlet...\n");
  const survivors = [];

  for (const conj of rawConjectures) {
    process.stdout.write(`  [${conj.name}] `);

    // Stage 1: Syntax check
    const isValid = await lean.checkSyntax(conj.signature);
    if (!isValid) {
      console.log("❌ Syntax Error — rejected.");
      continue;
    }

    // Stage 2: Triviality spray
    const isEasy = await lean.isTrivial(conj.name, conj.signature);
    if (isEasy) {
      console.log("❌ Trivially True — rejected.");
      continue;
    }

    console.log("✅ Survived!");
    survivors.push(conj);
  }

  // ── 4. Queue survivors ──
  console.log(`\n──────────────────────────────────`);

  if (survivors.length > 0) {
    let existingQueue: any[] = [];
    try {
      const data = await fs.readFile(QUEUE_FILE, "utf-8");
      existingQueue = JSON.parse(data);
    } catch {
      // File doesn't exist yet — start fresh
    }

    const newQueue = [...existingQueue, ...survivors];
    await fs.writeFile(QUEUE_FILE, JSON.stringify(newQueue, null, 2));
    console.log(
      `💾 Saved ${survivors.length} novel conjectures to ${QUEUE_FILE}`,
    );
    console.log(`  Total queue depth: ${newQueue.length}`);
  } else {
    console.log("⚠️ No conjectures survived The Gauntlet.");
  }
}

main().catch((err) => {
  console.error("💥 Conjecturer pipeline failed:", err);
  process.exit(1);
});
