/**
 * orchestration/runner.ts — Public API for the Research State Machine
 *
 * Creates an XState actor, subscribes to state transitions for logging,
 * and returns a Promise<ResearchResult> when the machine reaches a final state.
 *
 * Usage:
 *   const result = await runResearchMachine("find bounds for R(4,6)", {
 *     apiKey: process.env.GEMINI_API_KEY!,
 *     workspaceDir: "./workspace",
 *   });
 */

import { createActor } from "xstate";
import { researchMachine } from "./machine";
import type { ResearchResult, ResearchMachineConfig } from "./types";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export async function runResearchMachine(
  prompt: string,
  config: ResearchMachineConfig,
): Promise<ResearchResult> {
  const runId = `run_${Date.now()}`;
  const outputDir = join(config.workspaceDir, runId);
  mkdirSync(outputDir, { recursive: true });

  const verbose = config.verbose ?? true;

  const actor = createActor(researchMachine);

  // Track visited states for diagnostics
  const visitedStates: string[] = [];

  actor.subscribe((snapshot) => {
    const stateValue = snapshot.value as string;
    if (!visitedStates.includes(stateValue)) {
      visitedStates.push(stateValue);
    }

    if (verbose) {
      const ctx = snapshot.context;
      const prefix = getStateEmoji(stateValue);
      console.log(`${prefix} [${stateValue}] retries: idea=${ctx.ideationRetries} proof=${ctx.proofRetries}`);
    }
  });

  actor.start();

  if (verbose) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`  🔬 Perqed v3.0 — XState Research Machine`);
    console.log(`  Prompt: "${prompt}"`);
    console.log(`  Output: ${outputDir}`);
    console.log(`${"═".repeat(60)}\n`);
  }

  // Send the START event with runtime config
  actor.send({
    type: "START",
    prompt,
    apiKey: config.apiKey,
    workspaceDir: config.workspaceDir,
    outputDir,
  });

  // Wait for the machine to reach a final state
  return new Promise<ResearchResult>((resolve) => {
    actor.subscribe((snapshot) => {
      if (snapshot.status === "done") {
        const ctx = snapshot.context;
        const finalState = snapshot.value as string;

        resolve({
          plan: ctx.plan,
          evidence: ctx.evidence,
          approvedConjecture: ctx.approvedConjecture,
          redTeamHistory: ctx.redTeamHistory,
          proofStatus: ctx.proofStatus ?? "SKIPPED",
          outputDir,
          finalState,
        });
      }
    });
  });
}

function getStateEmoji(state: string): string {
  const emojis: Record<string, string> = {
    Idle: "⏸️ ",
    Ideation: "💡",
    Validation: "🔍",
    EmpiricalSandbox: "🧪",
    SMT_Resolution: "⚡",
    FalsificationFork: "⚔️ ",
    FormalVerification: "🧬",
    ErrorCorrection: "🔧",
    ScribeReport: "📝",
    Done: "✅",
    ExitGracefully: "👋",
    TerminalFailure: "💀",
  };
  return emojis[state] ?? "❓";
}
