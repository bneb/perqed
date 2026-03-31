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
 *   OLLAMA_ENDPOINT    Ollama API URL (default: http://localhost:11434/api/chat)
 *   OLLAMA_MODEL       Model name (default: qwen2.5-coder)
 *   GEMINI_API_KEY     Gemini API key (required for research pipeline + Architect)
 */

import { WorkspaceManager } from "./workspace";
import { SolverBridge } from "./solver";
import { LocalAgent, type LocalAgentConfig } from "./llm_client";
import { ArchitectClient } from "./architect_client";
import { runProverLoop } from "./orchestrator";
import { ResearchDirector } from "./agents/research_director";
import type { AgentResponse, ArchitectResponse } from "./schemas";

// ── Argument parsing ─────────────────────────────────────────────────────────

function parseArgs(): { prompt: string | null; runName: string; liveMode: boolean; dryRun: boolean } {
  const args = process.argv.slice(2);

  const dryRun = args.includes("--dry-run");

  // Look for prompt="..." or prompt=...
  const promptArg = args.find((a) => a.startsWith("prompt="));
  if (promptArg) {
    const prompt = promptArg.slice("prompt=".length).replace(/^["']|["']$/g, "");
    return { prompt, runName: "research", liveMode: true, dryRun };
  }

  return {
    prompt: null,
    runName: args[0] ?? "default_run",
    liveMode: args.includes("--live"),
    dryRun,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const workspaceBase = process.env["PERQED_WORKSPACE"] ?? "./agent_workspace";
  const { prompt, runName, liveMode, dryRun } = parseArgs();

  console.log("╔══════════════════════════════════════════╗");
  console.log("║         🔬 Perqed Proof Engine           ║");
  console.log("║    Neuro-Symbolic Orchestration v2.0.0   ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`\n  Workspace: ${workspaceBase}`);

  // ── Research pipeline mode ────────────────────────────────────────────────
  if (prompt) {
    console.log(`  Mode:      🤖 AUTONOMOUS RESEARCH PIPELINE\n`);

    const geminiKey = process.env["GEMINI_API_KEY"];
    if (!geminiKey) {
      console.error("  ❌ GEMINI_API_KEY is required for the research pipeline.");
      console.error("     Copy .env.example to .env and add your key.\n");
      process.exit(1);
    }

    const director = new ResearchDirector({
      apiKey: geminiKey,
      workspaceDir: workspaceBase,
      domainDepth: 7,
      attemptProof: !dryRun,
      verbose: true,
    });

    const result = await director.run(prompt);

    console.log("\n  📁 Artifacts written to:", result.outputDir);
    console.log("     research_plan.json  — seed paper + domains");
    console.log("     evidence_report.json — empirical investigation results");
    console.log("     conjectures.json    — generated Lean 4 candidates");
    console.log("     red_team_history.json — audit trail");
    console.log("     summary.md          — human-readable summary");
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
    const agentConfig: LocalAgentConfig = {
      endpoint: process.env["OLLAMA_ENDPOINT"] ?? "http://localhost:11434/api/chat",
      model: process.env["OLLAMA_MODEL"] ?? "qwen2.5-coder",
      temperature: 0.2,
    };

    console.log(`  🤖 Local model: ${agentConfig.model}`);
    console.log(`  🔗 Endpoint:    ${agentConfig.endpoint}\n`);

    config.localAgent = new LocalAgent(agentConfig);

    const geminiKey = process.env["GEMINI_API_KEY"];
    if (geminiKey) {
      const architect = new ArchitectClient({ apiKey: geminiKey, model: "gemini-2.5-pro" });
      console.log("  🏛️  Architect:   Gemini 2.5 Pro (escalation enabled)\n");

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
