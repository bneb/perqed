/**
 * Grand Finale: Full Integration Boss Fight
 *
 * The autonomous proof pipeline using the complete MCTS architecture:
 *   LIBRARIAN   (LanceDB + nomic-embed-text)       — RAG premise retrieval
 *   ARCHITECT   (Gemini Pro, cloud)                 — proof planner
 *   TACTICIAN   (Prover-V2 Q8_0, local)            — tactic generation
 *   SCORER      (TreeScorer)                        — AND/OR backpropagation
 *   HARVESTER   (DatasetExtractor)                  — SFT data extraction
 *   SCRIBE      (Gemini Pro, cloud)                 — LaTeX paper generation
 *
 * Target: theorem list_append_nil (l : List α) : l ++ [] = l
 *   → Forces `induction l` → AND split (nil case + cons case)
 *   → Exercises the full AND/OR backpropagating TreeScorer
 *
 * Usage:
 *   GEMINI_API_KEY=... bun run src/scripts/live_fire.ts
 *
 * Prerequisites:
 *   - Ollama running: `ollama serve`
 *   - Models: deepseek-prover-v2:7b-q8
 *   - Lean 4 installed: `elan` in PATH
 *   - Gemini API key in .env: GEMINI_API_KEY=AIza...
 */

import { join } from "node:path";
import * as fs from "node:fs/promises";
import { WorkspaceManager } from "../workspace";
import { SolverBridge } from "../solver";
import { LeanBridge } from "../lean_bridge";
import { AgentFactory } from "../agents/factory";
import { runDynamicLoop } from "../orchestrator";
import { TreePrinter } from "../utils/tree_printer";
import { LocalEmbedder } from "../embeddings/embedder";
import { VectorDatabase } from "../embeddings/vector_store";
import { TreeScorer } from "../ml/tree_scorer";
import { DatasetExtractor } from "../ml/dataset_extractor";
import { ScribeAgent } from "../agents/scribe";

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

const THEOREM_NAME = "erdos_gyarfas_n4";
const THEOREM_SIGNATURE = `(g : Fin 4 → Fin 4 → Bool)
  (hnoloop : ∀ i, g i i = false)
  (hsym : ∀ i j, g i j = g j i)
  (hdeg : ∀ v : Fin 4, ∃ a b c : Fin 4,
    a ≠ v ∧ b ≠ v ∧ c ≠ v ∧ a ≠ b ∧ a ≠ c ∧ b ≠ c ∧
    g v a = true ∧ g v b = true ∧ g v c = true) :
  ∃ a b c d : Fin 4, a ≠ b ∧ b ≠ c ∧ c ≠ d ∧ d ≠ a ∧
    g a b = true ∧ g b c = true ∧ g c d = true ∧ g d a = true`;
const WORKSPACE_BASE = join(import.meta.dir, "../../agent_workspace");
const RUN_NAME = "erdos_gyarfas_n4_01";
const MAX_ITERATIONS = 20;
const BATCH_SIZE = 3;

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  🔥 PERQED — GRAND FINALE BOSS FIGHT 🔥");
  console.log("  Architecture: AND/OR MCTS + Value Backpropagation");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Theorem:    ${THEOREM_NAME}`);
  console.log(`  Signature:  ${THEOREM_SIGNATURE}`);
  console.log(`  Budget:     ${MAX_ITERATIONS} iterations`);
  console.log(`  Batch Size: ${BATCH_SIZE} concurrent nodes`);
  console.log("═══════════════════════════════════════════════\n");

  // 1. Initialize MCTS workspace
  console.log("📁 Initializing MCTS workspace...");
  const workspace = new WorkspaceManager(WORKSPACE_BASE, RUN_NAME);
  await workspace.init();
  await Bun.write(
    workspace.paths.objective,
    [
      `# Objective`,
      ``,
      `Prove the following theorem in Lean 4:`,
      ``,
      `\`\`\`lean`,
      `theorem ${THEOREM_NAME} ${THEOREM_SIGNATURE} := by`,
      `  -- Your tactics here`,
      `\`\`\``,
      ``,
      `This theorem states that every simple graph on 4 vertices with minimum`,
      `degree at least 3 must contain a 4-cycle. Since the only such graph is K_4,`,
      `the complete graph, the 4-cycle 0→1→2→3→0 exists.`,
      `The proof requires extracting edge witnesses from the degree hypothesis`,
      `for Fin 4 and constructing an explicit 4-cycle.`,
    ].join("\n"),
  );

  // 2. Initialize Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error("❌ ERROR: GEMINI_API_KEY is missing from .env");
    console.error("   Set it: export GEMINI_API_KEY=AIza...\n");
    process.exit(1);
  }
  console.log("🔑 Gemini API key loaded from environment.");
  const factory = new AgentFactory({ geminiApiKey: geminiKey });

  // 3. Initialize bridges
  console.log("🔌 Initializing Lean 4 + Z3 + RAG bridges...");
  const solver = new SolverBridge();
  const lean = new LeanBridge();

  // Sprint 13: Initialize the Librarian (RAG)
  const embedder = new LocalEmbedder();
  const vectorDb = new VectorDatabase();
  await vectorDb.initialize();
  console.log("📚 Librarian ready (LanceDB + nomic-embed-text)");

  // Sprint 20: Initialize TreeScorer
  const scorer = new TreeScorer();
  console.log("🧮 TreeScorer ready (AND/OR backpropagation)");

  // Sprint 18: Initialize DatasetExtractor
  const extractor = new DatasetExtractor();
  console.log("📊 DatasetExtractor ready (SFT harvester)\n");

  // 4. Execute the MCTS search
  console.log("🔬 Starting MCTS Proof Search...\n");
  const startTime = Date.now();

  const result = await runDynamicLoop(workspace, solver, {
    maxGlobalIterations: MAX_ITERATIONS,
    maxLocalRetries: 3,
    leanBridge: lean,
    theoremName: THEOREM_NAME,
    theoremSignature: THEOREM_SIGNATURE,
    agentFactory: factory,
    embedder,
    vectorDb,
    batchSize: BATCH_SIZE,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // 5. Post-search: Score the tree
  if (result.tree) {
    scorer.backpropagate(result.tree);
    console.log("\n🧮 Tree values recalculated (AND/OR backpropagation).");
    const rootValue = result.tree.nodes.get(result.tree.rootId)?.value;
    console.log(`   Root value: ${rootValue?.toFixed(4)}`);
  }

  // 6. Report final status
  console.log("\n══════════════════════════════════════════════");
  if (result.status === "SOLVED") {
    console.log(`  🏆 SUCCESS: ${THEOREM_NAME} proved in ${elapsed}s`);

    // Show the verified proof
    const proofPath = join(workspace.paths.verifiedLib, `${THEOREM_NAME}.lean`);
    const proofFile = Bun.file(proofPath);
    if (await proofFile.exists()) {
      const proof = await proofFile.text();
      console.log(`\n📜 Verified proof:\n${proof}`);
    }

    // Sprint 18: Harvest SFT training data
    if (result.tree) {
      const solvedNode = Array.from(result.tree.nodes.values()).find(
        (n) => n.status === "SOLVED",
      );
      if (solvedNode) {
        console.log("\n🔄 Harvesting safe SFT training data...");
        await extractor.extractAndSave(result.tree, solvedNode.id);

        // Show the JSONL contents
        try {
          const sftContent = await fs.readFile("./data/sft_dataset.jsonl", "utf-8");
          const lines = sftContent.trim().split("\n").filter((l) => l.length > 0);
          console.log(`\n📊 SFT Dataset: ${lines.length} total training pairs`);
          for (const line of lines.slice(-5)) {
            const { prompt, completion } = JSON.parse(line);
            const statePreview = prompt.split("\n")[1]?.slice(0, 50) ?? "...";
            console.log(`   ${statePreview} → ${completion}`);
          }
        } catch {
          console.log("   (No SFT data file found)");
        }
      }
    }

    // Sprint 16: Generate AMS-LaTeX paper
    if (result.tree) {
      const solvedNode = Array.from(result.tree.nodes.values()).find(
        (n) => n.status === "SOLVED",
      );
      if (solvedNode) {
        console.log("\n✍️  The Scribe is translating to AMS-LaTeX...");
        try {
          const scribe = new ScribeAgent(geminiKey);
          const winningPath = result.tree.getWinningPath(solvedNode.id);
          const latex = await scribe.draftPaper(
            `theorem ${THEOREM_NAME} ${THEOREM_SIGNATURE}`,
            winningPath,
          );
          await fs.mkdir("./data", { recursive: true });
          await fs.writeFile("./data/draft_paper.tex", latex, "utf-8");
          console.log(`   📄 LaTeX draft: ./data/draft_paper.tex (${latex.split("\n").length} lines)`);
        } catch (e: any) {
          console.log(`   ⚠️  Scribe failed: ${e.message}`);
        }
      }
    }
  } else {
    console.log(`  ❌ BUDGET EXHAUSTED after ${elapsed}s (${MAX_ITERATIONS} iterations)`);
    console.log(`  Check: ${workspace.paths.labLog}`);
  }

  // 7. Print the MCTS Tree Visualization
  if (result.tree) {
    console.log(TreePrinter.print(result.tree));
  }

  // 8. Print the Routing Trace
  console.log("📊 ROUTING TRACE:");
  const labLogFile = Bun.file(workspace.paths.labLog);
  if (await labLogFile.exists()) {
    const labLog = await labLogFile.text();
    const entries = labLog.split("\n---\n").filter((e) => e.trim());
    entries.forEach((entry, i) => {
      const agentMatch = entry.match(/\[(ARCHITECT|REASONER|TACTICIAN)/);
      const agent = agentMatch?.[1] ?? "UNKNOWN";
      const icon =
        agent === "ARCHITECT" ? "🏛️" : agent === "REASONER" ? "🧠" : "🔫";
      const success =
        entry.includes("✅") || entry.toLowerCase().includes("success");
      const status = success ? "✅" : "❌";
      const firstLine = entry.trim().split("\n")[0]?.slice(0, 80) ?? "";
      console.log(
        `  [${i + 1}] ${icon} ${agent.padEnd(10)} | ${status} | ${firstLine}`,
      );
    });
  }
  console.log("══════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("💥 Grand Finale Boss Fight failed:", err);
  process.exit(1);
});
