/**
 * Sprint 7: Live Fire Exercise
 *
 * The first end-to-end proof using a real local LLM (DeepSeek-R1:8b)
 * driving the Lean 4 proof loop.
 *
 * Target theorem: n + m = m + n (natural number addition commutativity)
 *
 * Usage:
 *   bun run src/scripts/live_fire.ts
 *
 * Prerequisites:
 *   - Ollama running: `ollama serve`
 *   - Model pulled: `ollama pull deepseek-r1:8b`
 *   - Lean 4 installed: `elan` in PATH
 */

import { join } from "node:path";
import { WorkspaceManager } from "../workspace";
import { SolverBridge } from "../solver";
import { LeanBridge } from "../lean_bridge";
import { FormalistAgent } from "../agents/formalist";
import { runProverLoop } from "../orchestrator";
import type { FormalistResponse, ArchitectResponse } from "../schemas";

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

const THEOREM_NAME = "nat_add_comm";
const THEOREM_SIGNATURE = "(n m : Nat) : n + m = m + n";
const WORKSPACE_BASE = join(import.meta.dir, "../../agent_workspace");

// Parse CLI flags
const USE_PROVER = process.argv.includes("--prover");
const MODEL = USE_PROVER ? "deepseek-prover-v2:7b-q8" : "deepseek-r1:8b";
const RUN_NAME = USE_PROVER ? "live_fire_prover" : "live_fire_01";

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  🚀 PERQED — Sprint 7: Live Fire Exercise");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Theorem: ${THEOREM_NAME}`);
  console.log(`  Signature: ${THEOREM_SIGNATURE}`);
  console.log(`  Model: ${MODEL} (chat mode)`);
  console.log("═══════════════════════════════════════════════\n");

  // 1. Initialize workspace
  console.log("📁 Initializing workspace...");
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
      `This is the commutativity of natural number addition.`,
    ].join("\n"),
  );

  // 2. Load system prompt
  let systemPrompt: string;
  if (USE_PROVER) {
    // Prover models need a minimal Lean-specific prompt, not JSON schema instructions
    systemPrompt = "You are a Lean 4 theorem prover. When given a theorem, output ONLY the tactic(s) to complete the proof. No explanations. No markdown. Just the tactic code.";
    console.log("🧠 Using minimal prover system prompt...");
  } else {
    console.log("🧠 Loading system prompt...");
    systemPrompt = await Bun.file(workspace.paths.systemPrompts).text();
  }

  // 3. Initialize bridges
  console.log(`🔌 Connecting to Ollama (${MODEL})...`);
  const solver = new SolverBridge();
  const lean = new LeanBridge();

  // 4. Initialize FormalistAgent
  const formalist = new FormalistAgent({
    model: MODEL,
    temperature: USE_PROVER ? 0.3 : 0.6,
    systemPrompt,
    mode: "chat",
    numPredict: USE_PROVER ? 256 : 4096,
  });

  // 5. Create the LLM call wrapper for the orchestrator
  let lastLeanError = "";
  const formalistLLM = async (context: string): Promise<FormalistResponse> => {
    console.log("\n📤 Sending context to FormalistAgent...");

    // For prover models: strip orchestrator's rich context down to Lean-only prompt
    let effectiveContext = context;
    if (USE_PROVER) {
      const lines = [
        `Prove this theorem in Lean 4. Reply with ONLY the tactic, nothing else.`,
        ``,
        `theorem ${THEOREM_NAME} ${THEOREM_SIGNATURE} := by`,
        `  -- complete this proof`,
      ];
      if (lastLeanError) {
        lines.push(``, `Previous tactic failed with error:`, lastLeanError);
      }
      effectiveContext = lines.join("\n");
      console.log(`   📎 [prover mode] Slim context: ${effectiveContext.length} chars`);
    }

    const move = await formalist.generateMove(effectiveContext, 3);

    // Log the thinking for telemetry
    if (formalist.lastThinking) {
      console.log(`\n💭 Model's thinking:`);
      console.log(`   ${formalist.lastThinking.slice(0, 200)}...`);
    }

    console.log(`📥 Action: ${move.action}`);
    if (move.lean_tactics) {
      for (const t of move.lean_tactics) {
        console.log(`   🎯 [${t.confidence_score.toFixed(2)}] ${t.tactic} — ${t.informal_sketch}`);
        // Capture errors from previous tactic attempts for feedback loop
      }
    }

    return move;
  };

  // 6. Mock architect (Gemini not wired yet)
  const mockArchitect = async (
    _labLog: string,
    _progress: string,
  ): Promise<ArchitectResponse> => {
    console.log("\n🏛️  Architect escalation (mock — try omega)");
    return {
      analysis: "The formalist should try omega for linear arithmetic goals.",
      steps_to_backtrack: 0,
      new_directive: "Use the omega tactic. It handles natural number addition commutativity directly.",
    };
  };

  // 7. Run the loop!
  console.log("\n🔬 Starting proof loop...\n");
  const startTime = Date.now();

  await runProverLoop(workspace, solver, {
    maxGlobalIterations: 10,
    maxLocalRetries: 3,
    leanBridge: lean,
    theoremName: THEOREM_NAME,
    theoremSignature: THEOREM_SIGNATURE,
  }, formalistLLM, mockArchitect);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️  Total elapsed: ${elapsed}s`);

  // 8. Report results
  const proofs = await workspace.getVerifiedProofs();
  if (proofs.includes(THEOREM_NAME)) {
    console.log(`\n🏆 SUCCESS: ${THEOREM_NAME} committed to verified_lib/`);
    const proofContent = await Bun.file(
      join(workspace.paths.verifiedLib, `${THEOREM_NAME}.lean`),
    ).text();
    console.log(`\n📜 Verified proof:\n${proofContent}`);
  } else {
    console.log(`\n❌ FAILED: Could not prove ${THEOREM_NAME} within iteration limit.`);
    console.log(`   Check ${workspace.paths.labLog} for diagnostics.`);
  }
}

main().catch((err) => {
  console.error("💥 Live fire failed:", err);
  process.exit(1);
});
