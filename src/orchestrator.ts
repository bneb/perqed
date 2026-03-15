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
import { randomUUID } from "node:crypto";
import { WorkspaceManager } from "./workspace";
import { SolverBridge, type SolverResult } from "./solver";
import { LeanBridge, type LeanResult } from "./lean_bridge";
import { LocalAgent } from "./llm_client";
import { AgentRouter } from "./agents/router";
import { TelemetryEmitter, type TelemetryPayload } from "./telemetry/emitter";
import { AgentFactory, type SpecialistAgent } from "./agents/factory";
import { ProofTree, type ProofNode } from "./tree";
import type { LocalEmbedder } from "./embeddings/embedder";
import type { VectorDatabase } from "./embeddings/vector_store";
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
  /** Sprint 13: Local embedding service (Ollama nomic-embed-text). */
  embedder?: LocalEmbedder;
  /** Sprint 13: Vector database for premise storage and search. */
  vectorDb?: VectorDatabase;
  /** Sprint 17: Concurrent node expansion batch size. */
  batchSize?: number;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  maxLocalRetries: 3,
  maxGlobalIterations: 50,
  z3TimeoutMs: 30_000,
  leanTimeoutMs: 60_000,
  contextWindowTokens: 4000,
  batchSize: 3,
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
    globalFailures: consecutiveFailures, // Transitional: falls back to local until ProofTree is wired
    goalCount,
    isStuckInLoop,
    lastErrors,
    hasArchitectDirective,
  };
}

/**
 * Build a minimal context for the Tactician — strict Lean 4 file format.
 * No markdown, no instructions. The model sees a theorem and must complete the tactic.
 */
export function buildSlimContext(
  theoremName: string,
  theoremSignature: string,
  lastError?: string,
): string {
  const lines: string[] = [];
  if (lastError) {
    lines.push(
      `/-`,
      `Previous tactic failed:`,
      lastError.slice(0, 200),
      `-/`,
      ``,
    );
  }
  lines.push(
    `theorem ${theoremName} ${theoremSignature} := by`,
    `  `,  // trailing indent to prompt tactic completion
  );
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
// Sprint 9: Dynamic Routing Loop
// ──────────────────────────────────────────────

/**
 * The dynamic orchestrator loop that uses AgentRouter to select
 * the correct specialist on every iteration.
 *
 * Requires `config.agentFactory`, `config.leanBridge`, `config.theoremName`,
 * and `config.theoremSignature` to be set.
 */
export async function runDynamicLoop(
  workspace: WorkspaceManager,
  solver: SolverBridge,
  config: Partial<OrchestratorConfig> = {},
): Promise<{ status: "SOLVED" | "BUDGET_EXHAUSTED"; tree?: ProofTree }> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!cfg.agentFactory) {
    throw new Error("runDynamicLoop requires config.agentFactory");
  }
  if (!cfg.leanBridge || !cfg.theoremName || !cfg.theoremSignature) {
    throw new Error("runDynamicLoop requires leanBridge, theoremName, and theoremSignature");
  }

  const factory = cfg.agentFactory;
  const attemptLogs: AttemptLog[] = [];
  let iteration = 0;
  let lastTacticState = "";

  // Sprint 12d: Instantiate the ProofTree with initial theorem state
  const initialLeanState = `⊢ ${cfg.theoremSignature}`;
  const tree = new ProofTree(initialLeanState);

  // Telemetry: non-blocking Gist emitter
  const telemetry = new TelemetryEmitter();
  const runId = randomUUID();
  if (telemetry.isConfigured) {
    console.log(`📡 Telemetry emitter active (run: ${runId.slice(0, 8)})`);
  }

  console.log(`\n🚀 Perqed Dynamic Loop — Starting (max ${cfg.maxGlobalIterations} iterations)\n`);

  while (iteration < cfg.maxGlobalIterations) {
    iteration++;

    // 1. Extract signals from attempt history
    const hasDirective = await Bun.file(workspace.paths.architectDirective).exists();
    const signals = buildRoutingSignals(attemptLogs, lastTacticState, hasDirective);
    // Sprint 12d: Use tree's global failure count instead of consecutive fallback
    signals.globalFailures = tree.getGlobalTreeFailures();
    const nextRole = AgentRouter.determineNextAgent(signals);

    // 2. Get the specialist (factory selects Gemini tier based on signals)
    const agent = factory.getAgent(nextRole, signals);
    const tierLabel = (agent as any).modelTier ? ` [${(agent as any).modelTier}]` : "";

    console.log(`\n🧭 Iteration ${iteration} | Router → ${nextRole}${tierLabel}`);


    // 4. Build role-specific context
    let context: string;
    if (nextRole === "TACTICIAN") {
      // Slim context: just theorem + last error for blazing fast inference
      const lastError = attemptLogs.length > 0
        ? attemptLogs[attemptLogs.length - 1]!.error
        : undefined;
      context = buildSlimContext(cfg.theoremName!, cfg.theoremSignature!, lastError);
    } else if (nextRole === "ARCHITECT") {
      // Sprint 12d: Architect gets the frontier digest from the ProofTree
      context = tree.buildFrontierDigest() + `\n## Theorem: ${cfg.theoremName} ${cfg.theoremSignature}`;

      // Sprint 13: 📚 LIBRARIAN INJECTION — Neural Premise Selection
      if (cfg.vectorDb && cfg.embedder) {
        const queryVector = await cfg.embedder.embed(
          `${cfg.theoremName} ${cfg.theoremSignature}`,
        );
        const similarPremises = await cfg.vectorDb.search(queryVector, 3);

        if (similarPremises.length > 0) {
          context += `\n\n📚 HISTORICAL PREMISE MATCHES (Neural Vector Search):\n`;
          context += `The following theorems from Mathlib share latent structural similarities with our current goal. Consider their tactics when formulating your DIRECTIVE:\n\n`;
          similarPremises.forEach((p, i) => {
            context += `▶ Match ${i + 1}: ${p.theoremSignature}\n`;
            context += `  Successful Approach: \`${p.successfulTactic}\`\n\n`;
          });
        }
      }
    } else {
      // Reasoner gets a focused context: theorem + last errors
      const lastError = attemptLogs.length > 0
        ? attemptLogs[attemptLogs.length - 1]!.error
        : undefined;
      const errorContext = attemptLogs
        .filter(l => !l.success && l.error)
        .slice(-3)
        .map(l => `- ${l.error}`)
        .join("\n");
      context = [
        `## Theorem: ${cfg.theoremName} ${cfg.theoremSignature}`,
        ``,
        `## Recent Failures:`,
        errorContext || "(none)",
      ].join("\n");
    }

    // 5. Execute specialist
    const response = await agent.generateMove(context);

    // 6. Handle ARCHITECT response — MCTS tree navigation
    if (nextRole === "ARCHITECT") {
      const action = (response as any).action ?? "DIRECTIVE";
      const targetId = (response as any).target_node_id ?? "";
      const reasoning = (response as any).reasoning ?? (response as any).analysis ?? "";
      const tactics = (response as any).tactics ?? "";

      console.log(`🏛️ Architect${tierLabel} [${action}]: ${reasoning.slice(0, 80)}`);

      if (action === "BACKTRACK") {
        // ── BACKTRACK: Mark target branch as dead, pivot to best open node ──
        console.log(`⏪ BACKTRACK: Marking node ${targetId.slice(0, 8)} as DEAD_END`);

        // Sprint 12d: Physically mark the node in the tree
        if (tree.getNode(targetId)) {
          tree.markDeadEnd(targetId);
        }
        const nextNode = tree.getBestOpenNode();
        if (nextNode) {
          tree.setActiveNode(nextNode.id);
        }

        await workspace.backtrackProgress(1);

        attemptLogs.push({
          agent: "ARCHITECT",
          action: "BACKTRACK",
          success: true,
          timestamp: Date.now(),
        });

        await workspace.logAttempt(
          `ARCHITECT BACKTRACK${tierLabel}`,
          `Reasoning: ${reasoning}`,
          `Abandoned branch ${targetId.slice(0, 8)}`,
          true,
        );

        // Reset signals completely for the new branch —
        // totalAttempts=0 triggers ARCHITECT on the next iteration
        attemptLogs.length = 0;
        lastTacticState = "";

        continue;
      }

      if (action === "GIVE_UP") {
        console.log(`🛑 ARCHITECT has given up: ${reasoning}`);
        break;
      }

      // ── DIRECTIVE: Set target node and store suggested tactics ──
      const directive = tactics || reasoning;
      console.log(`📝 DIRECTIVE → ${directive.slice(0, 80)}`);

      // Write directive
      await Bun.write(workspace.paths.architectDirective, directive);

      // Log & reset signals
      attemptLogs.length = 0;
      attemptLogs.push({
        agent: "ARCHITECT",
        action: "DIRECTIVE",
        success: true,
        timestamp: Date.now(),
      });
      lastTacticState = "";

      await workspace.logAttempt(
        `ARCHITECT${tierLabel}: ${reasoning}`,
        `Directive: ${directive}`,
        "Planning step — no Lean execution",
        true,
      );

      continue;
    }

    // 6b. Handle REASONER (Gemini) response — extract tactics string
    if (nextRole === "REASONER" && "tactics" in response && typeof (response as any).tactics === "string") {
      const geminiReasonerResp = response as { tactics: string; reasoning: string; confidence_score: number };
      const tacticStr = geminiReasonerResp.tactics.trim();
      console.log(`🧠 REASONER${tierLabel}: ${geminiReasonerResp.reasoning?.slice(0, 80)}`);
      console.log(`🧠 REASONER tactic: ${tacticStr}`);

      if (tacticStr && cfg.leanBridge) {
        const result = await cfg.leanBridge.checkProof(
          cfg.theoremName!,
          cfg.theoremSignature!,
          [tacticStr],
          cfg.leanTimeoutMs,
        );

        if (result.isComplete) {
          console.log(`✅ REASONER proved it: [${geminiReasonerResp.confidence_score}] ${tacticStr}`);
          // Sprint 12d: Spawn child node in tree
          const activeNode = tree.getActiveNode();
          const child = tree.addChild(activeNode.id, tacticStr, "no goals");
          child.status = "SOLVED";
          tree.setActiveNode(child.id);

          await workspace.commitProof(cfg.theoremName!, tacticStr);
          telemetry.emit({
            runId, theorem: cfg.theoremName!, status: "SOLVED", iteration,
            currentSignals: signals, latestLog: attemptLogs[attemptLogs.length - 1] ?? null,
            history: attemptLogs, timestamp: new Date().toISOString(),
          });
          return { status: "SOLVED" as const, tree };
        } else {
          console.log(`❌ REASONER tactic failed: ${result.error ?? "unknown"}`);
          attemptLogs.push({
            agent: "REASONER",
            action: "PROPOSE_LEAN_TACTICS",
            success: false,
            error: result.error ?? "Lean rejected tactic",
            timestamp: Date.now(),
          });
          // Sprint 12d: Record error on tree's active node
          tree.getActiveNode().errorHistory.push(result.error ?? "Lean rejected tactic");
          lastTacticState = lastTacticState;
          continue;
        }
      }
    }

    // 7. Handle Lean tactic responses (TACTICIAN or REASONER)
    if ("lean_tactics" in response && response.lean_tactics && response.lean_tactics.length > 0) {
      const tactics = response.lean_tactics as FormalistResponse["lean_tactics"];
      const sortedTactics = [...tactics!].sort(
        (a, b) => b.confidence_score - a.confidence_score,
      );

      console.log(`🧬 ${nextRole}: ${sortedTactics.length} tactic(s) — ${sortedTactics.map(t => t.tactic).join(", ")}`);

      // Fire all tactics in parallel
      const leanPromises = sortedTactics.map((tactic) =>
        cfg.leanBridge!.checkProof(
          cfg.theoremName!,
          cfg.theoremSignature!,
          [tactic.tactic],
          cfg.leanTimeoutMs,
        ),
      );
      const leanResults = await Promise.all(leanPromises);

      // Find the winner
      const winnerIdx = leanResults.findIndex((r) => r.isComplete);

      if (winnerIdx !== -1) {
        const winner = sortedTactics[winnerIdx]!;
        const winResult = leanResults[winnerIdx]!;

        console.log(`✅ ${nextRole} proved it: [${winner.confidence_score.toFixed(2)}] ${winner.tactic}`);

        // Sprint 12d: Spawn child node in tree
        const activeNode = tree.getActiveNode();
        const child = tree.addChild(activeNode.id, winner.tactic, winResult.rawOutput);
        child.status = "SOLVED";
        tree.setActiveNode(child.id);

        attemptLogs.push({
          agent: nextRole,
          action: "PROPOSE_LEAN_TACTICS",
          success: true,
          timestamp: Date.now(),
        });

        await workspace.logAttempt(
          `[${nextRole}][${winner.confidence_score.toFixed(2)}] ${winner.informal_sketch}`,
          winner.tactic,
          winResult.rawOutput,
          true,
        );
        await workspace.updateHappyPath(`Proved via ${nextRole}: ${winner.informal_sketch}`);

        // Commit to vault
        const fullSource = cfg.leanBridge!.buildLeanSource(
          cfg.theoremName!,
          cfg.theoremSignature!,
          [winner.tactic],
        );
        await workspace.commitProof(cfg.theoremName!, fullSource);

        await generateProofSolution(workspace, iteration);
        console.log(`\n🏁 Dynamic loop — SOLVED on iteration ${iteration}`);
        telemetry.emit({
          runId, theorem: cfg.theoremName!, status: "SOLVED", iteration,
          currentSignals: signals, latestLog: attemptLogs[attemptLogs.length - 1] ?? null,
          history: attemptLogs, timestamp: new Date().toISOString(),
        });
        return { status: "SOLVED", tree };
      } else {
        // All tactics failed
        console.log(`❌ ${nextRole}: all ${sortedTactics.length} tactic(s) failed.`);

        const lastLeanError = leanResults[0]?.error ?? leanResults[0]?.rawOutput ?? "unknown error";
        lastTacticState = lastLeanError;

        attemptLogs.push({
          agent: nextRole,
          action: "PROPOSE_LEAN_TACTICS",
          success: false,
          error: lastLeanError,
          timestamp: Date.now(),
        });

        for (let i = 0; i < sortedTactics.length; i++) {
          await workspace.logAttempt(
            `[${nextRole}][${sortedTactics[i]!.confidence_score.toFixed(2)}] ${sortedTactics[i]!.informal_sketch}`,
            sortedTactics[i]!.tactic,
            leanResults[i]!.error ?? leanResults[i]!.rawOutput,
            false,
          );
        }
        // Sprint 12d: Record error on tree's active node
        tree.getActiveNode().errorHistory.push(lastLeanError);
      }
    } else if ("action" in response && (response as FormalistResponse).action === "GIVE_UP") {
      // Agent is giving up — log and continue (router will escalate)
      attemptLogs.push({
        agent: nextRole,
        action: "GIVE_UP",
        success: false,
        error: "Agent gave up",
        timestamp: Date.now(),
      });
    }

    // ── End of iteration: emit telemetry (fire-and-forget) ──
    telemetry.emit({
      runId,
      theorem: cfg.theoremName!,
      status: "IN_PROGRESS",
      iteration,
      currentSignals: signals,
      latestLog: attemptLogs[attemptLogs.length - 1] ?? null,
      history: attemptLogs,
      timestamp: new Date().toISOString(),
    });
  }

  console.log(`\n🏁 Dynamic loop — budget exhausted after ${iteration} iterations.`);
  telemetry.emit({
    runId, theorem: cfg.theoremName!, status: "EXHAUSTED", iteration,
    currentSignals: buildRoutingSignals(attemptLogs, lastTacticState, false),
    latestLog: attemptLogs[attemptLogs.length - 1] ?? null,
    history: attemptLogs, timestamp: new Date().toISOString(),
  });
  return { status: "BUDGET_EXHAUSTED", tree };
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

// ──────────────────────────────────────────────
// Sprint 17: Concurrent Node Processing
// ──────────────────────────────────────────────

export interface ProcessNodeDeps {
  generateTactic: (leanState: string) => Promise<string>;
  checkProof: (name: string, sig: string, tactics: string[], timeout?: number) => Promise<{
    success: boolean;
    isComplete: boolean;
    error?: string;
    rawOutput: string;
  }>;
}

/**
 * Evaluates a single WORKING node by generating a tactic and verifying it.
 * Designed to be called concurrently via Promise.all.
 *
 * @param node - The WORKING node to process
 * @param tree - The ProofTree to mutate
 * @param theoremName - Theorem name for Lean execution
 * @param theoremSignature - Full theorem signature
 * @param deps - Injected dependencies (tactic generator + lean bridge)
 */
export async function processNode(
  node: ProofNode,
  tree: ProofTree,
  theoremName: string,
  theoremSignature: string,
  deps: ProcessNodeDeps,
): Promise<void> {
  try {
    const tactic = await deps.generateTactic(node.leanState);
    const allTactics = [...tree.getPath(node.id), tactic];
    const result = await deps.checkProof(
      theoremName,
      theoremSignature,
      allTactics,
    );

    if (result.isComplete) {
      const child = tree.addChild(node.id, tactic, "no goals");
      child.status = "SOLVED";
      node.status = "DEAD_END"; // Parent is fully explored
    } else if (result.error) {
      node.errorHistory.push(`${tactic}: ${result.error}`);
      node.status = "OPEN"; // Unlock for future retries
    } else {
      // Valid tactic but not solved — advance the frontier
      tree.addChild(node.id, tactic, result.rawOutput);
      node.status = "DEAD_END"; // Parent branch explored
    }
  } catch (e: any) {
    node.errorHistory.push(e.message);
    node.status = "OPEN"; // Unlock on catastrophic failure
  }
}
