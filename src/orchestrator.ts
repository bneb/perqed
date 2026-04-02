/**
 * Orchestrator v3.0 — "Specialist Roster" Utilities
 * 
 * This file now contains the shared logic for the neuro-symbolic proof loop,
 * which is orchestrated by the XState machine in machine.ts.
 *
 * v3.0 logic:
 *   AgentRouter:  Signal-based dynamic routing to TACTICIAN/REASONER/ARCHITECT
 *   AgentFactory: Uniform specialist instantiation
 */

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { WorkspaceManager } from "./workspace";
import { SolverBridge } from "./solver";
import { AgentRouter } from "./agents/router";
import { AgentFactory } from "./agents/factory";
import { ProofTree, type ProofNode } from "./tree";
import { LocalAgent } from "./llm_client";
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
  leanBridge?: any; 
  /** Theorem name for Lean proofs. */
  theoremName?: string;
  /** Theorem signature for Lean proofs (e.g., "(n m : Nat) : n + m = m + n"). */
  theoremSignature?: string;
  /** Full problem description/objective markdown to ground the Agent's reasoning. */
  objective?: string;
  /** Sprint 8: AgentFactory for dynamic routing. When set, enables specialist routing. */
  agentFactory?: AgentFactory;
  /** Sprint 13: Local embedding service (Ollama nomic-embed-text). */
  embedder?: LocalEmbedder;
  /** Sprint 13: Vector database for premise storage and search. */
  vectorDb?: VectorDatabase;
  /** Sprint 17: Concurrent node expansion batch size. */
  batchSize?: number;
}

export const DEFAULT_CONFIG: OrchestratorConfig = {
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

  // Middle-Out: count consecutive identical errors from the tail
  let identicalErrorCount = 0;
  if (attemptLogs.length > 0) {
    const lastLog = attemptLogs[attemptLogs.length - 1]!;
    if (!lastLog.success && lastLog.error) {
      identicalErrorCount = 1;
      for (let i = attemptLogs.length - 2; i >= 0; i--) {
        const log = attemptLogs[i]!;
        if (!log.success && log.error === lastLog.error) {
          identicalErrorCount++;
        } else {
          break;
        }
      }
    }
  }

  // Middle-Out: count total TACTICIAN invocations
  const totalTacticianCalls = attemptLogs.filter(
    (l) => l.agent === "TACTICIAN",
  ).length;

  return {
    totalAttempts,
    consecutiveFailures,
    globalFailures: consecutiveFailures, // Transitional: falls back to local until ProofTree is wired
    goalCount,
    isStuckInLoop,
    lastErrors,
    hasArchitectDirective,
    identicalErrorCount,
    totalTacticianCalls,
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

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}

export async function safeReadFile(path: string): Promise<string> {
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

// ──────────────────────────────────────────────
// BACKWARD COMPATIBILITY SHIMS (XState v5)
// ──────────────────────────────────────────────

import { runFormalVerificationOnly } from "./orchestration/runner";

/**
 * runDynamicLoop — DEPRECATED shim for legacy MCTS proof search.
 * Now redirects to the XState FormalVerification machine.
 */
export async function runDynamicLoop(
  workspace: WorkspaceManager,
  _solver: SolverBridge,
  config: OrchestratorConfig,
): Promise<{ status: "SOLVED" | "BUDGET_EXHAUSTED"; tree?: ProofTree }> {
  console.log("\n  ⚠️  LEGACY API: runDynamicLoop is redirecting to XState v5...");

  const result = await runFormalVerificationOnly(config.objective || "Legacy run", {
    apiKey: process.env.GEMINI_API_KEY!,
    workspaceDir: workspace.paths.runDir,
    signature: config.theoremSignature || "",
    objective: config.objective,
    maxIterations: config.maxGlobalIterations,
    verbose: true,
  });

  return {
    status: result.proofStatus === "PROVED" ? "SOLVED" : "BUDGET_EXHAUSTED",
    tree: result.proofTree || undefined,
  };
}

/**
 * runProverLoop — DEPRECATED shim for classic backward-compatible search.
 * Now redirects to the XState FormalVerification machine.
 */
export async function runProverLoop(
  workspace: WorkspaceManager,
  _solver: SolverBridge,
  config: OrchestratorConfig,
): Promise<{ status: "SOLVED" | "BUDGET_EXHAUSTED" }> {
  console.log("\n  ⚠️  LEGACY API: runProverLoop is redirecting to XState v5...");

  const result = await runFormalVerificationOnly("Classic Proof Search", {
    apiKey: process.env.GEMINI_API_KEY!,
    workspaceDir: workspace.paths.runDir,
    signature: config.theoremSignature || "",
    objective: config.objective,
    maxIterations: config.maxGlobalIterations,
    verbose: true,
  });

  return {
    status: result.proofStatus === "PROVED" ? "SOLVED" : "BUDGET_EXHAUSTED",
  };
}
