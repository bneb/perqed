/**
 * Sprint 16: The Publishing Pipeline
 *
 * Tests the Scribe in isolation using a mocked winning path.
 * In the future, this will be called automatically after a successful proof.
 *
 * Usage:
 *   GEMINI_API_KEY=... bun run src/scripts/publish.ts
 */

import { ScribeAgent } from "../agents/scribe";
import { ProofTree } from "../tree";
import { DatasetExtractor } from "../ml/dataset_extractor";
import * as fs from "node:fs/promises";

async function main() {
  console.log("✍️  Initiating The Scribe...\n");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY not set.");
    process.exit(1);
  }

  // Mock a solved tree for testing the Scribe
  const tree = new ProofTree("⊢ (n m : Nat) : n + m = m + n");
  const step1 = tree.addChild(
    tree.rootId,
    "induction n with | zero => simp | succ n ih => simp [ih, Nat.add_succ]",
    "no goals",
  );
  tree.nodes.get(step1.id)!.status = "SOLVED";

  // Sprint 18: Harvest safe SFT training data
  console.log("🔄 Harvesting safe SFT training data...");
  const extractor = new DatasetExtractor();
  await extractor.extractAndSave(tree, step1.id);

  const winningPath = tree.getWinningPath(step1.id);
  console.log(`\n📜 Winning path: ${winningPath.length} steps\n`);

  const scribe = new ScribeAgent(apiKey);
  console.log("🧠 Translating Lean 4 trace to AMS-LaTeX...");

  const latexOutput = await scribe.draftResearchPaper({
    plan: { prompt: "", seed_paper: { title: "nat_add_comm", arxivId: "", abstract: "" }, extension_hypothesis: "n + m = m + n", domains_to_probe: [], lean_target_sketch: "theorem nat_add_comm (n m : Nat) : n + m = m + n" },
    evidence: { hypothesis: "", results: [], synthesis: "", anomalies: [], kills: [] },
    approvedConjecture: { signature: "theorem nat_add_comm (n m : Nat) : n + m = m + n", description: "Commutativity of addition" },
    redTeamHistory: [],
    proofStatus: "PROVED",
    winningPath,
  });

  // Ensure data directory exists
  await fs.mkdir("./data", { recursive: true });
  const outputPath = "./data/draft_paper.tex";
  await fs.writeFile(outputPath, latexOutput, "utf-8");

  console.log(`\n✅ LaTeX draft written to ${outputPath}`);
  console.log(`   ${latexOutput.split("\n").length} lines of AMS-LaTeX`);
}

main().catch((err) => {
  console.error("💥 Scribe pipeline failed:", err);
  process.exit(1);
});
