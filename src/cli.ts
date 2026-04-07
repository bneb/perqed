#!/usr/bin/env bun
/**
 * Perqed CLI — Entry point for the autonomous proof search engine.
 *
 * Usage:
 *   bun run src/cli.ts <run_name>                    # Mock mode (no LLM needed)
 *   bun run src/cli.ts <run_name> --live              # Live mode (requires Ollama)
 *   bun run src/cli.ts prompt="<research prompt>"    # Autonomous research pipeline
 *
 * Environment variables:
 *   PERQED_WORKSPACE   Base workspace dir (default: ./agent_workspace)
 *   OLLAMA_ENDPOINT    Ollama API URL (default: http://127.0.0.1:11434/api/chat)
 *   OLLAMA_MODEL       Model name (default: qwen2.5-coder)
 *   GEMINI_API_KEY     Gemini API key (required for research pipeline + Architect)
 */

import { WorkspaceManager } from "./workspace";
import { SolverBridge } from "./solver";
import { LocalAgent, type LocalAgentConfig } from "./llm_client";
import { ArchitectClient } from "./architect_client";
import { runProverLoop } from "./orchestrator";
import { runResearchMachine } from "./orchestration/runner";
import type { AgentResponse, ArchitectResponse } from "./schemas";
import { getAgencyRegistry } from "./agency";

// ── Argument parsing ─────────────────────────────────────────────────────────

function parseArgs(): { prompt: string | null; runName: string; liveMode: boolean; dryRun: boolean; crossPollinate: boolean; publishable: boolean } {
  const args = process.argv.slice(2);

  const dryRun = args.includes("--dry-run");
  const crossPollinate = args.includes("--cross-pollinate");
  const publishable = args.includes("--publishable");
  const interactive = args.includes("--interactive");
  (global as any).INTERACTIVE_MODE = interactive;

  // Look for prompt="..." or prompt=...
  const promptArg = args.find((a) => a.startsWith("prompt="));
  if (promptArg) {
    const prompt = promptArg.slice("prompt=".length).replace(/^["']|["']$/g, "");
    return { prompt, runName: "research", liveMode: true, dryRun, crossPollinate, publishable };
  }

  // If the user just typed `perqed --cross-pollinate` without a prompt, supply a global discovery prompt
  if (crossPollinate && !promptArg) {
    return { prompt: "Discover a profound, novel mathematical synthesis between distinct domains", runName: "research", liveMode: true, dryRun, crossPollinate, publishable };
  }

  return {
    prompt: null,
    runName: args[0] ?? "default_run",
    liveMode: args.includes("--live"),
    dryRun,
    crossPollinate,
    publishable,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const workspaceBase = process.env["PERQED_WORKSPACE"] ?? "./agent_workspace";
  const { prompt, runName, liveMode, dryRun, crossPollinate, publishable } = parseArgs();

  console.log("╔══════════════════════════════════════════╗");
  console.log("║         🔬 Perqed Proof Engine           ║");
  console.log("║    Neuro-Symbolic Orchestration v3.0.0   ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`\n  Workspace: ${workspaceBase}`);

  // ── Research pipeline mode (XState v5) ──────────────────────────────────
  if (prompt) {
    console.log(`  Mode:      🤖 AUTONOMOUS RESEARCH PIPELINE (XState v5)\n`);

    const geminiKey = process.env["GEMINI_API_KEY"];
    if (!geminiKey) {
      console.error("  ❌ GEMINI_API_KEY is required for the research pipeline.");
      console.error("     Copy .env.example to .env and add your key.\n");
      process.exit(1);
    }

    const result = await runResearchMachine(prompt, {
      apiKey: geminiKey,
      workspaceDir: workspaceBase,
      verbose: true,
      publishableMode: publishable,
      crossPollinate: crossPollinate,
    });

    console.log(`\n  📁 Artifacts written to: ${result.outputDir}`);
    console.log(`  🏁 Final state: ${result.finalState}`);
    console.log(`  📊 Proof status: ${result.proofStatus}`);
    if (result.proofStatus === "PROVED") {
      console.log("     proof/              — verified Lean 4 proof ✅");
    }
    return;
  }

  // ── Classic proof search mode (backward compatible) ───────────────────────
  console.log(`  Run:       ${runName}`);
  console.log(`  Mode:      ${liveMode ? "🟢 LIVE (Ollama)" : "🟡 MOCK (no LLM)"}\n`);

  const workspace = new WorkspaceManager(workspaceBase, runName);
  await workspace.init();

  const objectiveFile = Bun.file(workspace.paths.objective);
  if (!(await objectiveFile.exists())) {
    await Bun.write(
      workspace.paths.objective,
      "# Objective\n\nProve that for all integers x, x + 1 > x.\n",
    );
    console.log("  📝 Created default objective.md — edit this file to set your proof goal.\n");
  }

  const solver = new SolverBridge();

  const config: Parameters<typeof runProverLoop>[2] = {
    maxLocalRetries: 3,
    maxGlobalIterations: liveMode ? 100 : 10,
    z3TimeoutMs: 30_000,
    contextWindowTokens: liveMode ? 8000 : 4000,
  };

  if (liveMode) {
    const defaultLocal = getAgencyRegistry().resolveProvider("lean4", true);
    const agentConfig: LocalAgentConfig = {
      endpoint: process.env["OLLAMA_ENDPOINT"] ?? defaultLocal.endpoint ?? "http://127.0.0.1:11434/api/chat",
      model: process.env["OLLAMA_MODEL"] ?? defaultLocal.model,
      temperature: 0.2,
    };

    console.log(`  🤖 Local model: ${agentConfig.model}`);
    console.log(`  🔗 Endpoint:    ${agentConfig.endpoint}\n`);

    config.localAgent = new LocalAgent(agentConfig);

    const geminiKey = process.env["GEMINI_API_KEY"];
    if (geminiKey) {
      const architectModel = getAgencyRegistry().resolveProvider("reasoning").model;
      const architect = new ArchitectClient({ apiKey: geminiKey, model: architectModel });
      console.log(`  🏛️  Architect:   ${architectModel} (escalation enabled)\n`);

      await runProverLoop(workspace, solver, config, undefined, async (labLog, progress) => {
        const context = `## LAB LOG\n${labLog}\n\n## CURRENT PROGRESS\n${progress}`;
        return architect.escalate(context);
      });
    } else {
      console.log("  🏛️  Architect:   MOCK (set GEMINI_API_KEY for live escalation)\n");
      await runProverLoop(workspace, solver, config);
    }
  } else {
    await runProverLoop(workspace, solver, config);
  }

  console.log("\n  Done. Inspect your workspace:");
  console.log(`    Lab log:   ${workspace.paths.labLog}`);
  console.log(`    Progress:  ${workspace.paths.progress}`);

  const solutionFile = Bun.file(workspace.paths.proofSolution);
  if (await solutionFile.exists()) {
    console.log(`    Solution:  ${workspace.paths.proofSolution} ✅`);
  }
}

// ── Signals ───────────────────────────────────────────────────────────────────

process.on("SIGINT", () => {
  console.log("\n\n⚠️  SIGINT received — shutting down gracefully...");
  console.log("  State has been flushed to disk. Run again with the same run_name to resume.");
  process.exit(0);
});

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
