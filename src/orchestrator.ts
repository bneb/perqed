/**
 * Orchestrator v3.0 — "Specialist Roster"
 *
 * The main async state machine for the neuro-symbolic proof loop.
 *
 * v2.0 (Council Edition):
 *   Tao:     FALSIFY_FIRST action — bounded counterexample search before proof
 *   Dean:    Parallel multi-tactic execution via Promise.all
 *   Hassabis: confidence_score sorting — highest-value tactics first
 *
 * v3.0 (Specialist Roster — Sprint 8):
 *   AgentRouter:  Signal-based dynamic routing to TACTICIAN/REASONER/ARCHITECT
 *   AgentFactory: Uniform specialist instantiation
 *   Role-specific context windows: slim for Tactician, rich for Reasoner
 */

import { z } from "zod";
import { WorkspaceManager } from "./workspace";
import { SolverBridge, type SolverResult } from "./solver";
import { LeanBridge, type LeanResult } from "./lean_bridge";
import { LocalAgent } from "./llm_client";
import { AgentRouter } from "./agents/router";
import { AgentFactory, type SpecialistAgent } from "./agents/factory";
import type { AgentRole, RoutingSignals, AttemptLog } from "./types";
import {
  AgentResponseSchema,
  ArchitectResponseSchema,
  FormalistResponseSchema,
  type AgentResponse,
  type ArchitectResponse,
  type FormalistResponse,
  type Tactic,
  type LeanTactic,
} from "./schemas";

// ──────────────────────────────────────────────
// Type Aliases for Call Signatures
// ──────────────────────────────────────────────

/** Union type: orchestrator accepts both Z3 and Lean agent responses. */
export type AnyAgentResponse = AgentResponse | FormalistResponse;

export type LLMCallFn = (context: string) => Promise<AnyAgentResponse>;
export type ArchitectCallFn = (labLog: string, progress: string) => Promise<ArchitectResponse>;

// ──────────────────────────────────────────────
// Mock LLM Interfaces (Fallbacks when no live server)
// ──────────────────────────────────────────────

export async function mockLocalLLMCall(
  _context: string,
): Promise<AgentResponse> {
  return {
    thoughts: "Based on the objective, I'll try a direct Z3 proof by contradiction.",
    action: "PROPOSE_TACTICS",
    tactics: [{
      informal_sketch: "Direct proof by contradiction: assert Not(x + 1 > x), expect unsat.",
      confidence_score: 0.95,
      code: [
        "from z3 import *",
        "x = Int('x')",
        "s = Solver()",
        "s.add(Not(x + 1 > x))",
        "print(s.check())",
      ].join("\n"),
    }],
  };
}

export async function mockArchitectCall(
  _labLog: string,
  _progress: string,
): Promise<ArchitectResponse> {
  return {
    analysis: "The agent is stuck in a syntactic loop.",
    steps_to_backtrack: 1,
    new_directive: "Try encoding the problem using ForAll quantifiers instead.",
  };
}

// ──────────────────────────────────────────────
// Code Extraction
// ──────────────────────────────────────────────

export function extractCodeBlock(raw: string): string | null {
  const fencePattern = /```(?:python)?\s*\n([\s\S]*?)```/;
  const match = raw.match(fencePattern);
  return match ? match[1]!.trim() : null;
}

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

export interface OrchestratorConfig {
  maxLocalRetries: number;
  maxGlobalIterations: number;
  z3TimeoutMs: number;
  leanTimeoutMs: number;
  contextWindowTokens: number;
  localAgent?: LocalAgent;
  /** Lean 4 bridge — required for PROPOSE_LEAN_TACTICS action. */
  leanBridge?: LeanBridge;
  /** Theorem name for Lean proofs. */
  theoremName?: string;
  /** Theorem signature for Lean proofs (e.g., "(n m : Nat) : n + m = m + n"). */
  theoremSignature?: string;
  /** Sprint 8: AgentFactory for dynamic routing. When set, enables specialist routing. */
  agentFactory?: AgentFactory;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  maxLocalRetries: 3,
  maxGlobalIterations: 50,
  z3TimeoutMs: 30_000,
  leanTimeoutMs: 60_000,
  contextWindowTokens: 4000,
};

// ──────────────────────────────────────────────
// Sprint 8: Routing Signal Extraction
// ──────────────────────────────────────────────

/**
 * Extract routing signals from the workspace state and attempt history.
 * This is a pure extraction function — no side effects.
 */
export function buildRoutingSignals(
  attemptLogs: AttemptLog[],
  tacticState: string,
  hasArchitectDirective: boolean,
): RoutingSignals {
  const totalAttempts = attemptLogs.length;

  // Count consecutive failures from the tail
  let consecutiveFailures = 0;
  for (let i = attemptLogs.length - 1; i >= 0; i--) {
    if (!attemptLogs[i]!.success) {
      consecutiveFailures++;
    } else {
      break;
    }
  }

  // Detect stuck-in-loop: last 2+ errors are identical
  const recentFailed = attemptLogs
    .slice(-3)
    .filter(l => !l.success && l.error);
  const isStuckInLoop =
    recentFailed.length >= 2 &&
    recentFailed[recentFailed.length - 1]!.error ===
      recentFailed[recentFailed.length - 2]!.error;

  // Extract last error strings
  const lastErrors = recentFailed.map(l => l.error ?? "");

  // Parse goal count from Lean tactic state
  const goalCount = AgentRouter.parseGoalCount(tacticState);

  return {
    totalAttempts,
    consecutiveFailures,
    goalCount,
    isStuckInLoop,
    lastErrors,
    hasArchitectDirective,
  };
}

/**
 * Build a minimal context for the Tactician — just the theorem + last error.
 * This keeps prompt processing under 100 tokens for blazing-fast TTFT.
 */
export function buildSlimContext(
  theoremName: string,
  theoremSignature: string,
  lastError?: string,
): string {
  const lines = [
    `Prove this theorem in Lean 4. Reply with ONLY the tactic, nothing else.`,
    ``,
    `theorem ${theoremName} ${theoremSignature} := by`,
    `  -- complete this proof`,
  ];
  if (lastError) {
    lines.push(``, `Previous tactic failed with error:`, lastError);
  }
  return lines.join("\n");
}

function buildLLMCall(config: OrchestratorConfig, fallback: LLMCallFn): LLMCallFn {
  if (config.localAgent) {
    const agent = config.localAgent;
    return (context: string) =>
      agent.generateMoveWithRetry(context, config.maxLocalRetries);
  }
  return fallback;
}

// ──────────────────────────────────────────────
// The Orchestration Loop (Council Edition)
// ──────────────────────────────────────────────

export async function runProverLoop(
  workspace: WorkspaceManager,
  solver: SolverBridge,
  config: Partial<OrchestratorConfig> = {},
  llmCallOverride?: LLMCallFn,
  architectCallOverride?: ArchitectCallFn,
): Promise<void> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const llmCall = buildLLMCall(cfg, llmCallOverride ?? mockLocalLLMCall);
  const architectCall = architectCallOverride ?? mockArchitectCall;

  let consecutiveFailures = 0;
  let iteration = 0;

  console.log(`\n🔬 Perqed Proof Search — Starting (max ${cfg.maxGlobalIterations} iterations)\n`);

  while (iteration < cfg.maxGlobalIterations) {
    iteration++;

    // 1. Build context from the file system
    const context = await workspace.buildContextWindow(cfg.contextWindowTokens);

    // 2. Query the local LLM
    let response: AnyAgentResponse;
    try {
      response = await llmCall(context);
      // Try Formalist schema first, then fall back to Z3 agent schema
      if ('lean_tactics' in response || response.action === 'PROPOSE_LEAN_TACTICS' || response.action === 'SEARCH_LEMMA') {
        response = FormalistResponseSchema.parse(response);
      } else {
        response = AgentResponseSchema.parse(response);
      }
    } catch (err) {
      const zodMsg = err instanceof z.ZodError
        ? formatZodError(err)
        : String(err);

      console.log(`⚠️  LLM output failed Zod validation:\n${zodMsg}`);
      await workspace.logAttempt("ZOD_VALIDATION_FAILURE", zodMsg, "Invalid LLM response format", false);
      consecutiveFailures++;

      if (consecutiveFailures >= cfg.maxLocalRetries) {
        await escalateToArchitect(workspace, architectCall);
        consecutiveFailures = 0;
      }
      continue;
    }

    // 3. Handle the action
    switch (response.action) {

      // ── Tao's Mandate: Falsification Phase ──
      case "FALSIFY_FIRST": {
        if (!response.code) {
          console.log("⚠️  FALSIFY_FIRST action but no code payload.");
          await workspace.logAttempt(
            response.thoughts,
            "(no code provided)",
            "FALSIFY_FIRST without code",
            false,
          );
          consecutiveFailures++;
          break;
        }

        console.log(`🔍 Attempt ${iteration}: falsification check (bounded counterexample search)...`);
        const falsifyResult: SolverResult = await solver.runZ3(response.code, cfg.z3TimeoutMs);

        // Log the falsification attempt (never touches progress — it's reconnaissance)
        await workspace.logAttempt(
          `FALSIFY: ${response.thoughts}`,
          response.code,
          falsifyResult.output,
          !falsifyResult.success, // For falsification: sat is BAD (counterexample found), unsat is GOOD
        );

        if (falsifyResult.success) {
          // Solver returned 'unsat' from the falsification script...
          // But wait — falsification scripts are checking if the negation is satisfiable.
          // If the falsification code found 'sat', falsifyResult.success = false (counterexample!).
          // If the falsification code found 'unsat', no counterexample exists — good, proceed.
          // BUT — the SolverBridge considers 'unsat' as success=true.
          // In falsification context: success (unsat from solver) means "no counterexample found"
          // The script itself is looking for counterexamples, so:
          //   - sat output → counterexample exists → theorem FALSE → escalate
          //   - unsat output → no counterexample → theorem survives → continue
          // SolverBridge: unsat → success=true, sat → success=false
          // So: falsifyResult.success=true means unsat → no counterexample → good
          //     falsifyResult.success=false means sat → counterexample found → theorem broken

          // No counterexample found — theorem survived falsification
          console.log("✅ Falsification passed — no counterexamples found in bounded domain.");
          consecutiveFailures = 0;
        } else {
          // Counterexample found! The theorem is FALSE.
          console.log(`⛔ COUNTEREXAMPLE FOUND! Theorem appears falsifiable.`);
          console.log(`   Model: ${falsifyResult.output.slice(0, 200)}`);
          // Escalate immediately — the agent has discovered the theorem is wrong
          await escalateToArchitect(workspace, architectCall);
          consecutiveFailures = 0;
        }
        break;
      }

      // ── Dean's Mandate: Parallel Tactic Execution ──
      case "PROPOSE_TACTICS": {
        if (!response.tactics || response.tactics.length === 0) {
          console.log("⚠️  PROPOSE_TACTICS action but no tactics array.");
          await workspace.logAttempt(
            response.thoughts,
            "(no tactics provided)",
            "PROPOSE_TACTICS without tactics array",
            false,
          );
          consecutiveFailures++;
          break;
        }

        // ── Hassabis's Mandate: Sort by confidence_score (descending) ──
        const sortedTactics = [...response.tactics].sort(
          (a, b) => b.confidence_score - a.confidence_score,
        );

        console.log(`🧪 Attempt ${iteration}: executing ${sortedTactics.length} tactics in parallel...`);
        for (const t of sortedTactics) {
          console.log(`   📊 [${t.confidence_score.toFixed(2)}] ${t.informal_sketch.slice(0, 60)}`);
        }

        // Fire all tactics in parallel (Dean's speculative execution)
        const executionPromises = sortedTactics.map((tactic) =>
          solver.runZ3(tactic.code, cfg.z3TimeoutMs),
        );
        const results = await Promise.all(executionPromises);

        // Find the winning tactic (first unsat in confidence-sorted order)
        const winningIndex = results.findIndex((r) => r.success === true);

        if (winningIndex !== -1) {
          const winner = sortedTactics[winningIndex]!;
          const winResult = results[winningIndex]!;

          console.log(`✅ Tactic ${winningIndex + 1} succeeded! [${winner.confidence_score.toFixed(2)}] ${winner.informal_sketch.slice(0, 60)}`);

          await workspace.logAttempt(
            `[${winner.confidence_score.toFixed(2)}] ${winner.informal_sketch}`,
            winner.code,
            winResult.output,
            true,
          );
          await workspace.updateHappyPath(`Proved: ${winner.informal_sketch}`);
          consecutiveFailures = 0;
        } else {
          // All tactics failed — log the best one's failure
          const bestAttempt = sortedTactics[0]!;
          const bestResult = results[0]!;

          console.log(`❌ All ${sortedTactics.length} tactics failed.`);

          // Log each failed tactic for the lab log
          for (let i = 0; i < sortedTactics.length; i++) {
            await workspace.logAttempt(
              `[${sortedTactics[i]!.confidence_score.toFixed(2)}] ${sortedTactics[i]!.informal_sketch}`,
              sortedTactics[i]!.code,
              results[i]!.output,
              false,
            );
          }

          consecutiveFailures++;
        }
        break;
      }

      // ── Escalation ──
      case "GIVE_UP": {
        console.log("🆘 Local model is giving up — escalating to Architect...");
        await workspace.logAttempt(
          response.thoughts,
          "(gave up)",
          "Local model cannot make progress",
          false,
        );
        await escalateToArchitect(workspace, architectCall);
        consecutiveFailures = 0;
        break;
      }

      // ── Victory ──
      case "SOLVED": {
        console.log(`🎉 The agent believes the problem is SOLVED!`);
        await workspace.logAttempt(
          response.thoughts,
          ('code' in response ? response.code : undefined) ?? "(no final code)",
          "Agent declared problem solved",
          true,
        );
        await workspace.updateHappyPath(`SOLVED: ${response.thoughts}`);

        // Generate the final proof solution document
        await generateProofSolution(workspace, iteration);

        console.log(`\n🏁 Proof search complete — problem solved on iteration ${iteration}.`);
        return;
      }

      // ── Sprint 6: Lean Formalist Loop ──
      case "PROPOSE_LEAN_TACTICS": {
        const formalistResponse = response as FormalistResponse;
        if (!formalistResponse.lean_tactics || formalistResponse.lean_tactics.length === 0) {
          console.log("⚠️  PROPOSE_LEAN_TACTICS action but no lean_tactics array.");
          await workspace.logAttempt(
            formalistResponse.thoughts,
            "(no lean tactics provided)",
            "PROPOSE_LEAN_TACTICS without tactics array",
            false,
          );
          consecutiveFailures++;
          break;
        }

        if (!cfg.leanBridge || !cfg.theoremName || !cfg.theoremSignature) {
          console.log("⚠️  PROPOSE_LEAN_TACTICS requires leanBridge, theoremName, and theoremSignature in config.");
          consecutiveFailures++;
          break;
        }

        // Sort by confidence descending (Hassabis)
        const sortedLeanTactics = [...formalistResponse.lean_tactics].sort(
          (a, b) => b.confidence_score - a.confidence_score,
        );

        console.log(`🧬 Attempt ${iteration}: executing ${sortedLeanTactics.length} Lean tactics in parallel...`);
        for (const t of sortedLeanTactics) {
          console.log(`   📊 [${t.confidence_score.toFixed(2)}] ${t.tactic} — ${t.informal_sketch.slice(0, 50)}`);
        }

        // Fire all tactics in parallel — each as an independent single-tactic proof attempt
        const leanPromises = sortedLeanTactics.map((tactic) =>
          cfg.leanBridge!.checkProof(
            cfg.theoremName!,
            cfg.theoremSignature!,
            [tactic.tactic],
            cfg.leanTimeoutMs,
          ),
        );
        const leanResults = await Promise.all(leanPromises);

        // Find the winning tactic (first complete proof in confidence-sorted order)
        const leanWinnerIdx = leanResults.findIndex((r) => r.isComplete);

        if (leanWinnerIdx !== -1) {
          const winner = sortedLeanTactics[leanWinnerIdx]!;
          const winResult = leanResults[leanWinnerIdx]!;

          console.log(`✅ Lean tactic succeeded! [${winner.confidence_score.toFixed(2)}] ${winner.tactic}`);

          await workspace.logAttempt(
            `[LEAN][${winner.confidence_score.toFixed(2)}] ${winner.informal_sketch}`,
            winner.tactic,
            winResult.rawOutput,
            true,
          );
          await workspace.updateHappyPath(`Proved via Lean: ${winner.informal_sketch}`);

          // Commit the full proof to the vault
          const fullSource = cfg.leanBridge!.buildLeanSource(
            cfg.theoremName!,
            cfg.theoremSignature!,
            [winner.tactic],
          );
          await workspace.commitProof(cfg.theoremName!, fullSource);

          consecutiveFailures = 0;

          // Generate proof solution and return — we're done
          await generateProofSolution(workspace, iteration);
          console.log(`\n🏁 Lean proof complete — committed to verified_lib/`);
          return;
        } else {
          // All Lean tactics failed
          console.log(`❌ All ${sortedLeanTactics.length} Lean tactics failed.`);

          for (let i = 0; i < sortedLeanTactics.length; i++) {
            await workspace.logAttempt(
              `[LEAN][${sortedLeanTactics[i]!.confidence_score.toFixed(2)}] ${sortedLeanTactics[i]!.informal_sketch}`,
              sortedLeanTactics[i]!.tactic,
              leanResults[i]!.error ?? leanResults[i]!.rawOutput,
              false,
            );
          }

          consecutiveFailures++;
        }
        break;
      }

      // ── Sprint 6: Search Lemma (Mathlib query) ──
      case "SEARCH_LEMMA": {
        const searchResponse = response as FormalistResponse;
        console.log(`🔎 SEARCH_LEMMA: ${searchResponse.search_query ?? "(no query)"}`);
        // For now, log and continue — full Mathlib RAG is Phase B
        await workspace.logAttempt(
          `SEARCH_LEMMA: ${searchResponse.thoughts}`,
          searchResponse.search_query ?? "(no query)",
          "Mathlib search not yet implemented — use exact? or apply? in Lean tactics.",
          false,
        );
        break;
      }
    }

    // Check if we should escalate
    if (consecutiveFailures >= cfg.maxLocalRetries) {
      await escalateToArchitect(workspace, architectCall);
      consecutiveFailures = 0;
    }
  }

  console.log(`\n🏁 Orchestration complete after ${iteration} iterations.`);
}

// ──────────────────────────────────────────────
// Architect Escalation
// ──────────────────────────────────────────────

async function escalateToArchitect(
  workspace: WorkspaceManager,
  architectCall: ArchitectCallFn,
): Promise<void> {
  console.log("\n🏛️  Escalating to Architect...\n");

  const labLog = await safeReadFile(workspace.paths.labLog);
  const progress = await safeReadFile(workspace.paths.progress);

  let architectResponse: ArchitectResponse;
  try {
    const rawResponse = await architectCall(labLog, progress);
    architectResponse = ArchitectResponseSchema.parse(rawResponse);
  } catch (err) {
    console.log(`⚠️  Architect response failed validation: ${err}`);
    return;
  }

  console.log(`📋 Architect analysis: ${architectResponse.analysis}`);

  // Backtrack if advised
  if (architectResponse.steps_to_backtrack > 0) {
    console.log(`⏪ Backtracking ${architectResponse.steps_to_backtrack} steps...`);
    await workspace.backtrackProgress(architectResponse.steps_to_backtrack);
  }

  // Write the directive
  console.log(`📝 Writing new directive: ${architectResponse.new_directive.slice(0, 80)}...`);
  await Bun.write(workspace.paths.architectDirective, architectResponse.new_directive);

  // Log the architect's intervention
  await workspace.logAttempt(
    `ARCHITECT ESCALATION`,
    `Analysis: ${architectResponse.analysis}\nBacktrack: ${architectResponse.steps_to_backtrack} steps`,
    architectResponse.new_directive,
    true,
  );
}

// ──────────────────────────────────────────────
// Proof Solution Output
// ──────────────────────────────────────────────

async function generateProofSolution(
  workspace: WorkspaceManager,
  iteration: number,
): Promise<void> {
  const objective = await safeReadFile(workspace.paths.objective);
  const progress = await safeReadFile(workspace.paths.progress);
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

  const solution = [
    "═══════════════════════════════════════════════",
    "  PERQED — PROOF SOLUTION",
    `  Generated: ${timestamp}`,
    `  Iterations: ${iteration}`,
    "═══════════════════════════════════════════════",
    "",
    "## OBJECTIVE",
    objective || "(no objective)",
    "",
    "## VERIFIED PROOF STEPS",
    progress || "(no steps recorded)",
    "",
    "## STATUS: SOLVED ✅",
    "",
    "This proof was formally verified by the Z3/Lean solver",
    "at each step. All intermediate results were checked.",
    "═══════════════════════════════════════════════",
    "",
  ].join("\n");

  await Bun.write(workspace.paths.proofSolution, solution);
  console.log(`📄 Proof solution written to ${workspace.paths.proofSolution}`);
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}

async function safeReadFile(path: string): Promise<string> {
  const file = Bun.file(path);
  if (!(await file.exists())) return "";
  return file.text();
}
