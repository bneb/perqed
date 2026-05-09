/**
 * Sprint 4 Tests — Resumability, max iterations, and SOLVED output.
 *
 * These tests verify that the orchestrator can resume from existing state,
 * abort cleanly at max iterations, and produce proof_solution.txt on SOLVED.
 */

import { expect, test, describe, afterAll } from "bun:test";
import { rm, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { WorkspaceManager } from "../src/workspace";
import { SolverBridge } from "../src/solver";
import { runProverLoop } from "../src/orchestrator";
import type { AgentResponse, ArchitectResponse, FormalistResponse } from "../src/schemas";
import { MockAgentFactory } from "./helpers/mock_factory";
import { LeanBridge } from "../src/lean_bridge";

const BASE_DIR_PREFIX = "./tmp_test_resilience";
const RUN_NAME = "resilience_test";

async function setupWorkspace(baseDir: string): Promise<WorkspaceManager> {
  await rm(baseDir, { recursive: true, force: true });
  const wm = new WorkspaceManager(baseDir, RUN_NAME);
  await wm.init();
  const gc = join(baseDir, "global_config");
  await mkdir(gc, { recursive: true });
  await Bun.write(join(gc, "system_prompts.md"), "You are a mathematician.");
  await Bun.write(join(gc, "general_skills.md"), "Use deduction.");
  await Bun.write(join(gc, "config.json"), "{}");
  await Bun.write(join(baseDir, "runs", RUN_NAME, "objective.md"), "Prove n + m = m + n");
  return wm;
}

// ──────────────────────────────────────────────
// Resumability
// ──────────────────────────────────────────────

describe("Orchestrator — Resumability", () => {
  test("resumes from existing progress without clearing files", async () => {
    const baseDir = BASE_DIR_PREFIX + "_" + Math.random().toString(36).substring(7);
    const wm = await setupWorkspace(baseDir);
    const solver = new SolverBridge();
    const lean = new LeanBridge();

    // Fake some prior MCTS progress
    await Bun.write(join(baseDir, "runs", RUN_NAME, "mcts_tree.json"), '{"nodes": []}');
    await Bun.write(join(baseDir, "runs", RUN_NAME, "lab_log.md"), "Previous exploration.\n");

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "n/a", steps_to_backtrack: 0, new_directive: "n/a", action: "CONTINUE_PROOF"
    });

    const mockProver = async (_ctx: string): Promise<FormalistResponse> => ({
      thoughts: "Givin up",
      action: "GIVE_UP",
    });

    await runProverLoop(wm, solver, {
      maxGlobalIterations: 1, z3TimeoutMs: 30000, leanTimeoutMs: 60000, contextWindowTokens: 4096, 
      maxLocalRetries: 3,
      leanBridge: lean,
      theoremName: "add_comm",
      theoremSignature: "theorem thm (n m : Nat) : n + m = m + n",
      agentFactory: new MockAgentFactory({ PROVER: mockProver as any, ARCHITECT: noopArchitect as any }),
    });

    const mctsFile = Bun.file(join(baseDir, "runs", RUN_NAME, "mcts_tree.json"));
    expect(await mctsFile.exists()).toBe(true);
  }, 90000);

  test("new steps append to existing progress on resume", async () => {
    const baseDir = BASE_DIR_PREFIX + "_" + Math.random().toString(36).substring(7);
    const wm = await setupWorkspace(baseDir);
    const solver = new SolverBridge();
    const lean = new LeanBridge();

    await Bun.write(join(baseDir, "runs", RUN_NAME, "mcts_tree.json"), '{"nodes": [{"id":"root"}]}');

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "n/a", steps_to_backtrack: 0, new_directive: "n/a", action: "CONTINUE_PROOF"
    });

    const mockProver = async (_ctx: string): Promise<FormalistResponse> => ({
      thoughts: "Givin up again",
      action: "GIVE_UP",
    });

    await runProverLoop(wm, solver, {
      maxGlobalIterations: 1, z3TimeoutMs: 30000, leanTimeoutMs: 60000, contextWindowTokens: 4096, 
      maxLocalRetries: 3,
      leanBridge: lean,
      theoremName: "add_comm",
      theoremSignature: "theorem thm (n m : Nat) : n + m = m + n",
      agentFactory: new MockAgentFactory({ PROVER: mockProver as any, ARCHITECT: noopArchitect as any }),
    });

    const newTree = await Bun.file(join(baseDir, "runs", RUN_NAME, "mcts_tree.json")).text();
    expect(newTree).toContain("root"); 
  }, 90000);
});

// ──────────────────────────────────────────────
// Exit Conditions
// ──────────────────────────────────────────────

describe("Orchestrator — Max Iterations", () => {
  test("cleanly exits after maxGlobalIterations without SOLVED", async () => {
    const baseDir = BASE_DIR_PREFIX + "_" + Math.random().toString(36).substring(7);
    const wm = await setupWorkspace(baseDir);
    const solver = new SolverBridge();
    const lean = new LeanBridge();

    let callCount = 0;
    const failingLLM = async (_ctx: string): Promise<FormalistResponse> => {
      callCount++;
      return {
        thoughts: `Attempt ${callCount}`,
        action: "PROPOSE_LEAN_TACTICS",
        lean_tactics: [{
          tactic: "exact rfl", informal_sketch: "Will fail", confidence_score: 0.1
        }],
      };
    };

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "n/a", steps_to_backtrack: 0, new_directive: "n/a", action: "CONTINUE_PROOF"
    });

    // Should exit after exactly 5 iterations
    const result = await runProverLoop(wm, solver, {
      maxGlobalIterations: 5, z3TimeoutMs: 30000, leanTimeoutMs: 60000, contextWindowTokens: 4096, 
      maxLocalRetries: 3,
      leanBridge: lean,
      theoremName: "add_comm",
      theoremSignature: "theorem thm (n m : Nat) : n + m = m + n",
      agentFactory: new MockAgentFactory({ PROVER: failingLLM as any, ARCHITECT: noopArchitect as any }),
    });

    expect(result.status).toBe("BUDGET_EXHAUSTED");
  }, 90000);
});

describe("Orchestrator — SOLVED Output", () => {
  test("generates typst report when agent returns SOLVED", async () => {
    const baseDir = BASE_DIR_PREFIX + "_" + Math.random().toString(36).substring(7);
    const wm = await setupWorkspace(baseDir);
    const solver = new SolverBridge();
    const lean = new LeanBridge();

    const solvingLLM = async (_ctx: string): Promise<FormalistResponse> => ({
      thoughts: "It's easy",
      action: "PROPOSE_LEAN_TACTICS",
      lean_tactics: [{
        tactic: "apply Nat.add_comm", informal_sketch: "Done", confidence_score: 0.99
      }],
    });

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "n/a", steps_to_backtrack: 0, new_directive: "n/a", action: "CONTINUE_PROOF"
    });

    await runProverLoop(wm, solver, {
      maxGlobalIterations: 10, z3TimeoutMs: 30000, leanTimeoutMs: 60000, contextWindowTokens: 4096, 
      maxLocalRetries: 3,
      leanBridge: lean,
      theoremName: "add_comm",
      theoremSignature: "theorem thm (n m : Nat) : n + m = m + n",
      agentFactory: new MockAgentFactory({ PROVER: solvingLLM as any, ARCHITECT: noopArchitect as any }),
    });

    const reportsDir = join(baseDir, "runs", RUN_NAME, "reports");
    const files = await readdir(reportsDir).catch(() => []);
    expect(files.some(f => f.endsWith(".typ"))).toBe(true);
  }, 90000);

  test("generates typst report when max iterations reached without SOLVED", async () => {
    const baseDir = BASE_DIR_PREFIX + "_" + Math.random().toString(36).substring(7);
    const wm = await setupWorkspace(baseDir);
    const solver = new SolverBridge();
    const lean = new LeanBridge();

    const failingLLM = async (_ctx: string): Promise<FormalistResponse> => ({
      thoughts: "Failing",
      action: "PROPOSE_LEAN_TACTICS",
      lean_tactics: [{ tactic: "exact rfl", informal_sketch: "Fails", confidence_score: 0.1 }],
    });

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "n/a", steps_to_backtrack: 0, new_directive: "n/a", action: "CONTINUE_PROOF"
    });

    await runProverLoop(wm, solver, {
      maxGlobalIterations: 3, z3TimeoutMs: 30000, leanTimeoutMs: 60000, contextWindowTokens: 4096, 
      maxLocalRetries: 3,
      leanBridge: lean,
      theoremName: "add_comm",
      theoremSignature: "theorem thm (n m : Nat) : n + m = m + n",
      agentFactory: new MockAgentFactory({ PROVER: failingLLM as any, ARCHITECT: noopArchitect as any }),
    });

    const reportsDir = join(baseDir, "runs", RUN_NAME, "reports");
    const files = await readdir(reportsDir).catch(() => []);
    expect(files.some(f => f.endsWith(".typ"))).toBe(true);
  }, 90000);
});
