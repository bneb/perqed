#!/usr/bin/env bun
/**
 * perqed run — Execute a proof search from a run_config.json
 *
 * Reads the config produced by `perqed --prompt=...`, sets up the
 * workspace, and runs the dynamic MCTS proof loop.
 *
 * Usage:
 *   GEMINI_API_KEY=... bun run src/cli/run.ts --config=agent_workspace/runs/<id>/run_config.json
 */

import { join, dirname } from "node:path";
import { WorkspaceManager } from "../workspace";
import { SolverBridge } from "../solver";
import { LeanBridge } from "../lean_bridge";
import { AgentFactory } from "../agents/factory";
import { runDynamicLoop } from "../orchestrator";
import { TreePrinter } from "../utils/tree_printer";
import type { RunConfig } from "./perqed";

// ──────────────────────────────────────────────
// CLI Argument Parsing
// ──────────────────────────────────────────────

function parseArgs(): { configPath: string } {
  const args = process.argv.slice(2);
  const configArg = args.find((a) => a.startsWith("--config="));

  if (!configArg) {
    console.error("Usage: bun run src/cli/run.ts --config=<path/to/run_config.json>");
    process.exit(1);
  }

  return { configPath: configArg.replace("--config=", "") };
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

async function main() {
  const { configPath } = parseArgs();

  // 1. Load config
  const configFile = Bun.file(configPath);
  if (!(await configFile.exists())) {
    console.error(`❌ Config not found: ${configPath}`);
    console.error("   Run 'perqed --prompt=...' first to generate a config.");
    process.exit(1);
  }
  const config: RunConfig = await configFile.json();

  console.log("═══════════════════════════════════════════════");
  console.log("  🔥 PERQED — Proof Search Execution");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Problem:   ${config.problem_description}`);
  console.log(`  Theorem:   ${config.theorem_name}`);
  console.log(`  Budget:    ${config.max_iterations} iterations`);
  console.log("═══════════════════════════════════════════════\n");

  // 2. Get Gemini API key
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error("❌ GEMINI_API_KEY not set.");
    process.exit(1);
  }

  // 3. Initialize workspace
  const workspaceBase = join(process.cwd(), "agent_workspace");
  const workspace = new WorkspaceManager(workspaceBase, config.run_name);
  await workspace.init();

  // Write objective
  await Bun.write(workspace.paths.objective, config.objective_md);

  // Write domain skills
  const skillsPath = join(workspace.paths.domainSkills, "problem_context.md");
  await Bun.write(skillsPath, config.domain_skills_md);

  console.log(`📁 Workspace: ${workspace.paths.runDir}`);

  // 3.5. Ollama readiness check
  // The ARCHITECT's DAG always starts with a literature node (RAG lookup via
  // nomic-embed-text). Without Ollama, that node silently returns a stub and
  // the ARCHITECT gets degraded context for its very first strategy decision.
  // Poll for up to 30s so that `ollama serve` started just before the run has
  // time to finish loading rather than being skipped on the first attempt.
  {
    const { LocalEmbedder } = await import("../embeddings/embedder");
    const embedder = new LocalEmbedder();
    const POLL_INTERVAL_MS = 2_000;
    const TIMEOUT_MS = 30_000;
    const deadline = Date.now() + TIMEOUT_MS;
    let ollamaReady = await embedder.isAvailable();

    if (!ollamaReady) {
      process.stdout.write("⏳ Waiting for Ollama (literature RAG)");
      while (!ollamaReady && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const remaining = Math.ceil((deadline - Date.now()) / 1000);
        process.stdout.write(` ${remaining}s`);
        ollamaReady = await embedder.isAvailable();
      }
      process.stdout.write("\n");
    }

    if (ollamaReady) {
      console.log("✅ Ollama ready — literature nodes will use live RAG context");
    } else {
      console.log("⚠️  Ollama unavailable after 30s — literature nodes will use stubs");
      console.log("   The SA search and ARCHITECT will still run normally.");
      console.log("   To enable RAG: `ollama serve` and `ollama pull nomic-embed-text`");
    }
  }

  // 4. Initialize agents
  let ollamaModel: string | undefined;
  try {
    const gc = await Bun.file(join(workspaceBase, "global_config/config.json")).json();
    ollamaModel = gc?.models?.tactician?.name;
  } catch {}
  const factory = new AgentFactory({ geminiApiKey: geminiKey, ollamaModel });
  const solver = new SolverBridge();
  const lean = new LeanBridge();


  // 5. Run
  console.log("🔬 Starting proof search...\n");
  const startTime = Date.now();

  const result = await runDynamicLoop(workspace, solver, {
    maxGlobalIterations: config.max_iterations,
    maxLocalRetries: 3,
    leanBridge: lean,
    theoremName: config.theorem_name,
    theoremSignature: config.theorem_signature,
    agentFactory: factory,
    batchSize: 3,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // 6. Report
  console.log("\n══════════════════════════════════════════════");
  if (result.status === "SOLVED") {
    console.log(`  🏆 SUCCESS: ${config.theorem_name} proved in ${elapsed}s`);

    const proofPath = join(workspace.paths.verifiedLib, `${config.theorem_name}.lean`);
    const proofFile = Bun.file(proofPath);
    if (await proofFile.exists()) {
      console.log(`\n📜 Verified proof:\n${await proofFile.text()}`);
    }
  } else {
    console.log(`  ❌ BUDGET EXHAUSTED after ${elapsed}s (${config.max_iterations} iters)`);
    console.log(`  Lab log: ${workspace.paths.labLog}`);
  }

  if (result.tree) {
    console.log(TreePrinter.print(result.tree));
  }
  console.log("══════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("💥 Perqed run failed:", err);
  process.exit(1);
});
