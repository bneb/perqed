/**
 * Perqed CLI — Entry point for the autonomous proof search engine.
 *
 * Usage:
 *   bun run src/cli.ts <run_name>                    # Mock mode (no LLM needed)
 *   bun run src/cli.ts <run_name> --live              # Live mode (requires Ollama)
 *
 * Environment variables:
 *   PERQED_WORKSPACE   Base workspace dir (default: ./agent_workspace)
 *   OLLAMA_ENDPOINT    Ollama API URL (default: http://localhost:11434/api/chat)
 *   OLLAMA_MODEL       Model name (default: qwen2.5-coder)
 *   GEMINI_API_KEY     Gemini API key for Architect escalation
 */

import { WorkspaceManager } from "./workspace";
import { SolverBridge } from "./solver";
import { LocalAgent, type LocalAgentConfig } from "./llm_client";
import { ArchitectClient } from "./architect_client";
import { runProverLoop } from "./orchestrator";
import type { AgentResponse, ArchitectResponse } from "./schemas";

async function main() {
  const workspaceBase = process.env["PERQED_WORKSPACE"] ?? "./agent_workspace";
  const runName = process.argv[2] ?? "default_run";
  const liveMode = process.argv.includes("--live");

  console.log("╔══════════════════════════════════════════╗");
  console.log("║         🔬 Perqed Proof Engine           ║");
  console.log("║    Neuro-Symbolic Orchestration v1.0.0   ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`\n  Workspace: ${workspaceBase}`);
  console.log(`  Run:       ${runName}`);
  console.log(`  Mode:      ${liveMode ? "🟢 LIVE (Ollama)" : "🟡 MOCK (no LLM)"}\n`);

  // Initialize workspace (idempotent — preserves existing state)
  const workspace = new WorkspaceManager(workspaceBase, runName);
  await workspace.init();

  // Write default objective if none exists
  const objectiveFile = Bun.file(workspace.paths.objective);
  if (!(await objectiveFile.exists())) {
    await Bun.write(
      workspace.paths.objective,
      "# Objective\n\nProve that for all integers x, x + 1 > x.\n",
    );
    console.log("  📝 Created default objective.md — edit this file to set your proof goal.\n");
  }

  // Initialize solver bridge
  const solver = new SolverBridge();

  // Configure LLM and Architect based on mode
  const config: Parameters<typeof runProverLoop>[2] = {
    maxLocalRetries: 3,
    maxGlobalIterations: liveMode ? 100 : 10,
    z3TimeoutMs: 30_000,
    contextWindowTokens: liveMode ? 8000 : 4000,
  };

  if (liveMode) {
    // Wire up live LocalAgent via Ollama
    const agentConfig: LocalAgentConfig = {
      endpoint: process.env["OLLAMA_ENDPOINT"] ?? "http://localhost:11434/api/chat",
      model: process.env["OLLAMA_MODEL"] ?? "qwen2.5-coder",
      temperature: 0.2,
    };

    console.log(`  🤖 Local model: ${agentConfig.model}`);
    console.log(`  🔗 Endpoint:    ${agentConfig.endpoint}\n`);

    config.localAgent = new LocalAgent(agentConfig);

    // Wire Architect if API key is available
    const geminiKey = process.env["GEMINI_API_KEY"];
    if (geminiKey) {
      const architect = new ArchitectClient({
        apiKey: geminiKey,
        model: "gemini-2.5-pro",
      });
      console.log("  🏛️  Architect:   Gemini 2.5 Pro (escalation enabled)\n");

      // Run with live architect
      await runProverLoop(workspace, solver, config, undefined, async (labLog, progress) => {
        const context = `## LAB LOG\n${labLog}\n\n## CURRENT PROGRESS\n${progress}`;
        return architect.escalate(context);
      });
    } else {
      console.log("  🏛️  Architect:   MOCK (set GEMINI_API_KEY for live escalation)\n");
      await runProverLoop(workspace, solver, config);
    }
  } else {
    // Mock mode
    await runProverLoop(workspace, solver, config);
  }

  // Graceful shutdown
  console.log("\n  Done. Inspect your workspace:");
  console.log(`    Lab log:   ${workspace.paths.labLog}`);
  console.log(`    Progress:  ${workspace.paths.progress}`);

  const solutionFile = Bun.file(workspace.paths.proofSolution);
  if (await solutionFile.exists()) {
    console.log(`    Solution:  ${workspace.paths.proofSolution} ✅`);
  }
}

// Graceful SIGINT handler
process.on("SIGINT", () => {
  console.log("\n\n⚠️  SIGINT received — shutting down gracefully...");
  console.log("  State has been flushed to disk. Run again with the same run_name to resume.");
  process.exit(0);
});

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
