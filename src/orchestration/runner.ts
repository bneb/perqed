/**
 * orchestration/runner.ts — Public API for the Research State Machine
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
  const outputDir = join(config.workspaceDir, "runs", runId);
  mkdirSync(outputDir, { recursive: true });

  const verbose = config.verbose ?? true;

  if (verbose) {
    console.log(`  Target: "${prompt}"`);
    console.log(`  Output: ${outputDir}`);
  }

  const actor = createActor(researchMachine);

  actor.subscribe((snapshot) => {
    const stateValue = snapshot.value as string;
    if (verbose && (snapshot as any).changed) {
       console.log(`\n  [XState] Transitioned to: ${stateValue.toUpperCase()}`);
    }
  });

  actor.start();

  actor.send({
    type: "START",
    prompt,
    apiKey: config.apiKey,
    workspaceDir: config.workspaceDir,
    outputDir,
    publishableMode: config.publishableMode ?? false,
  });

  return new Promise<ResearchResult>((resolve) => {
    actor.subscribe((snapshot) => {
      console.log(`[XState] Snapshot changed. State: ${JSON.stringify(snapshot.value)}`);
      if (snapshot.status === "done") {
        const ctx = snapshot.context;
        resolve({
          plan: ctx.plan,
          evidence: ctx.evidence,
          approvedConjecture: ctx.approvedConjecture,
          redTeamHistory: ctx.redTeamHistory,
          proofStatus: ctx.proofStatus ?? "SKIPPED",
          proofTree: ctx.proofTree,
          outputDir,
          finalState: String(snapshot.value),
        });
      }
    });
  });
}

/**
 * runFormalVerificationOnly — Shim for legacy loop redirection.
 * Skips ideation/sandbox and starts the machine at FormalVerification.
 */
export async function runFormalVerificationOnly(
  prompt: string,
  config: ResearchMachineConfig & {
    signature?: string;
    objective?: string;
    maxIterations?: number;
    problemClass?: string;
    agentFactory?: any;
  }
): Promise<ResearchResult> {
  const runId = `run_${Date.now()}_formal`;
  const outputDir = join(config.workspaceDir, "runs", runId);
  mkdirSync(outputDir, { recursive: true });

  let activeSignature = config.signature;
  if (!activeSignature) {
    console.log(`[Runner] No signature provided. Auto-formalizing prompt: "${prompt}"...`);
    const { AutoformalizerAgent } = await import("../agents/autoformalizer");
    const { LeanBridge } = await import("../lean_bridge");
    const lean = new LeanBridge(undefined, config.workspaceDir);
    const formalizer = new AutoformalizerAgent({ apiKey: config.apiKey, leanBridge: lean });
    activeSignature = await formalizer.formalize(prompt);
    console.log(`[Runner] Auto-formalization complete: ${activeSignature}`);
  }

  const actor = createActor(researchMachine);

  actor.start();

  actor.send({
    type: "WAKE_AT_FORMAL",
    prompt,
    apiKey: config.apiKey,
    workspaceDir: config.workspaceDir,
    outputDir,
    signature: activeSignature,
    objective: config.objective,
    maxIterations: config.maxIterations,
    problemClass: config.problemClass,
    agentFactory: config.agentFactory,
  });

  return new Promise<ResearchResult>((resolve) => {
    actor.subscribe((snapshot) => {
      console.log(`[XState] Snapshot changed. State: ${JSON.stringify(snapshot.value)}`);
      if (snapshot.status === "done") {
        const ctx = snapshot.context;
        resolve({
          plan: ctx.plan,
          evidence: ctx.evidence,
          approvedConjecture: ctx.approvedConjecture,
          redTeamHistory: ctx.redTeamHistory,
          proofStatus: ctx.proofStatus ?? "SKIPPED",
          proofTree: ctx.proofTree,
          outputDir,
          finalState: String(snapshot.value),
        });
      }
    });
  });
}
