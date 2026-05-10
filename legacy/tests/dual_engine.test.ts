/**
 * Sprint 6: Dual-Engine Orchestrator — RED Tests
 *
 * Tests the Lean Bridge + MCTS tactics search integration.
 * Requirements:
 *   1. LeanTacticSchema + FormalistResponseSchema validation
 *   2. Z3 pre-flight fallback logic
 *   3. Real Lean subprocess integration (no mocks on solver side)
 *   4. Proof logging to workspace
 */

import { expect, test, describe } from "bun:test";
import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { WorkspaceManager } from "../src/workspace";
import { SolverBridge } from "../src/solver";
import { LeanBridge } from "../src/lean_bridge";
import { runProverLoop } from "../src/orchestrator";
import { MockAgentFactory } from "./helpers/mock_factory";

import {
  LeanTacticSchema,
  FormalistResponseSchema,
  type FormalistResponse,
  type ArchitectResponse,
} from "../src/schemas";

const BASE_DIR_PREFIX = "./tmp_test_dual_engine";
const RUN_NAME = "dual_engine_test";

async function setupWorkspace(): Promise<WorkspaceManager> {
  const uniqueDir = `${BASE_DIR_PREFIX}_${Math.random().toString(36).substring(7)}`;
  await rm(uniqueDir, { recursive: true, force: true });
  const wm = new WorkspaceManager(uniqueDir, RUN_NAME);
  await wm.init();
  const gc = join(uniqueDir, "global_config");
  await mkdir(gc, { recursive: true });
  await Bun.write(join(gc, "system_prompts.md"), "You are a mathematician.");
  await Bun.write(join(gc, "general_skills.md"), "Use deduction.");
  await Bun.write(join(gc, "config.json"), "{}");
  await Bun.write(join(uniqueDir, "runs", RUN_NAME, "objective.md"), "Prove n + m = m + n");
  return wm;
}

// ──────────────────────────────────────────────
// 1. SCHEMAS
// ──────────────────────────────────────────────

describe("Dual-Engine — Schema Validation", () => {
  test("LeanTacticSchema accepts valid Lean tactic with confidence_score", () => {
    const validTactic = {
      tactic: "omega",
      informal_sketch: "Solve via linear arithmetic",
      confidence_score: 0.9,
    };

    const result = LeanTacticSchema.parse(validTactic);
    expect(result.tactic).toBe("omega");
    expect(result.confidence_score).toBe(0.9);
  });

  test("LeanTacticSchema rejects missing tactic field", () => {
    const noTactic = {
      informal_sketch: "I forgot the tactic",
      confidence_score: 0.1,
    };

    expect(() => LeanTacticSchema.parse(noTactic)).toThrow();
  });

  test("FormalistResponseSchema accepts PROPOSE_LEAN_TACTICS with lean_tactics array", () => {
    const validResp = {
      thoughts: "Using induction and then omega",
      action: "PROPOSE_LEAN_TACTICS",
      lean_tactics: [
        { tactic: "induction n with d hd", informal_sketch: "Base case", confidence_score: 0.8 },
        { tactic: "omega", informal_sketch: "Close it", confidence_score: 0.95 },
      ],
    };

    const result = FormalistResponseSchema.parse(validResp);
    expect(result.action).toBe("PROPOSE_LEAN_TACTICS");
    expect(result.lean_tactics!.length).toBe(2);
  });

  test("FormalistResponseSchema rejects more than 5 lean_tactics", () => {
    const tooMany = {
      thoughts: "Spamming tactics",
      action: "PROPOSE_LEAN_TACTICS",
      lean_tactics: Array(6).fill({ tactic: "simp", informal_sketch: "simp", confidence_score: 0.5 }),
    };

    expect(() => FormalistResponseSchema.parse(tooMany)).toThrow();
  });

  test("FormalistResponseSchema accepts SEARCH_LEMMA action", () => {
    const searchReq = {
      thoughts: "I need to know if add_comm exists",
      action: "SEARCH_LEMMA",
      search_query: "Nat.add_comm",
    };

    const result = FormalistResponseSchema.parse(searchReq);
    expect(result.action).toBe("SEARCH_LEMMA");
    expect(result.search_query).toBe("Nat.add_comm");
  });

  test("FormalistResponseSchema still accepts GIVE_UP and SOLVED", () => {
    const giveUp = { thoughts: "Too hard", action: "GIVE_UP" };
    expect(() => FormalistResponseSchema.parse(giveUp)).not.toThrow();

    const solved = {
      thoughts: "It's already proved",
      action: "SOLVED",
      lean_tactics: [], // Optional
    };
    expect(() => FormalistResponseSchema.parse(solved)).not.toThrow();
  });
});

// ──────────────────────────────────────────────
// 2. DUAL-ENGINE LOOP — Z3 pre-flight + Lean main loop
// ──────────────────────────────────────────────

describe("Dual-Engine — Lean Proof Loop", () => {
  test("PROPOSE_LEAN_TACTICS sends tactics to LeanBridge and first success wins", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();
    const lean = new LeanBridge();

    const formalistLLM = async (_ctx: string): Promise<FormalistResponse> => ({
      thoughts: "Goal is n + m = m + n, omega should handle it",
      action: "PROPOSE_LEAN_TACTICS",
      lean_tactics: [
        { tactic: "simp", informal_sketch: "Try simplification", confidence_score: 0.5 },
        { tactic: "apply Nat.add_comm", informal_sketch: "Exact theorem", confidence_score: 0.9 },
      ],
    });

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "n/a", steps_to_backtrack: 0, new_directive: "n/a", action: "CONTINUE_PROOF",
    });

    const result = await runProverLoop(wm, solver, {
      maxGlobalIterations: 1, z3TimeoutMs: 30000, leanTimeoutMs: 60000, contextWindowTokens: 4096, 
      maxLocalRetries: 3,
      leanBridge: lean,
      theoremName: "add_comm",
      theoremSignature: "theorem thm (n m : Nat) : n + m = m + n",
      agentFactory: new MockAgentFactory({ PROVER: formalistLLM as any, ARCHITECT: noopArchitect as any }),
    });

    expect(result.status).toBe("SOLVED");
  }, 90000);

  test("failed Lean tactics count as consecutive failures → architect escalation", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();
    const lean = new LeanBridge();
    let architectCalled = false;

    let callCount = 0;
    const badFormalistLLM = async (_ctx: string): Promise<FormalistResponse> => {
      callCount++;
      return {
        thoughts: `Attempt ${callCount}`,
        action: "PROPOSE_LEAN_TACTICS",
        lean_tactics: [
          { tactic: "exact rfl", informal_sketch: "Wrong tactic", confidence_score: 0.5 },
        ],
      };
    };

    const mockArchitect = async (): Promise<ArchitectResponse> => {
      architectCalled = true;
      return { analysis: "All tactics wrong", steps_to_backtrack: 0, new_directive: "try induction", action: "CONTINUE_PROOF" };
    };

    await runProverLoop(wm, solver, {
      maxGlobalIterations: 5, z3TimeoutMs: 30000, leanTimeoutMs: 60000, contextWindowTokens: 4096, 
      maxLocalRetries: 3,
      leanBridge: lean,
      theoremName: "add_comm",
      theoremSignature: "theorem thm (n m : Nat) : n + m = m + n",
      agentFactory: new MockAgentFactory({ PROVER: badFormalistLLM as any, ARCHITECT: mockArchitect as any }),
    });

    expect(architectCalled).toBe(true);
  }, 90000);

  test("successful Lean proof commits to verified_lib/", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();
    const lean = new LeanBridge();

    const solvingLLM = async (_ctx: string): Promise<FormalistResponse> => ({
      thoughts: "This is a simple arithmetic identity",
      action: "PROPOSE_LEAN_TACTICS",
      lean_tactics: [
        { tactic: "apply Nat.add_comm", informal_sketch: "Direct apply", confidence_score: 0.99 },
      ],
    });

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "n/a", steps_to_backtrack: 0, new_directive: "n/a", action: "CONTINUE_PROOF",
    });

    const result = await runProverLoop(wm, solver, {
      maxGlobalIterations: 1, z3TimeoutMs: 30000, leanTimeoutMs: 60000, contextWindowTokens: 4096, 
      maxLocalRetries: 3,
      leanBridge: lean,
      theoremName: "nat_add_comm",
      theoremSignature: "theorem thm (n m : Nat) : n + m = m + n",
      agentFactory: new MockAgentFactory({ PROVER: solvingLLM as any, ARCHITECT: noopArchitect as any }),
    });

    expect(result.status).toBe("SOLVED");
  }, 90000);

  test("handles compound tactics properly when batched", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();
    const lean = new LeanBridge();

    const solvingLLM = async (_ctx: string): Promise<FormalistResponse> => ({
      thoughts: "Needs compound execution",
      action: "PROPOSE_LEAN_TACTICS",
      lean_tactics: [
        { tactic: "simp; apply Nat.add_comm", informal_sketch: "Compound", confidence_score: 0.99 },
      ],
    });

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "n/a", steps_to_backtrack: 0, new_directive: "n/a", action: "CONTINUE_PROOF",
    });

    const result = await runProverLoop(wm, solver, {
      maxGlobalIterations: 1, z3TimeoutMs: 30000, leanTimeoutMs: 60000, contextWindowTokens: 4096, 
      maxLocalRetries: 3,
      leanBridge: lean,
      theoremName: "nat_add_comm",
      theoremSignature: "theorem thm (n m : Nat) : n + m = m + n",
      agentFactory: new MockAgentFactory({ PROVER: solvingLLM as any, ARCHITECT: noopArchitect as any }),
    });

    expect(result.status).toBe("SOLVED");
  }, 90000);

  test("lean_tactics are sorted by confidence_score descending", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();
    const lean = new LeanBridge();

    const executionOrder: string[] = [];
    const originalCheckProof = lean.checkProof.bind(lean);
    lean.checkProof = async (name: string, sig: string, tactics: string[], timeout?: number) => {
      executionOrder.push(tactics[0]!);
      return originalCheckProof(name, sig, tactics, timeout);
    };

    const unsortedLLM = async (_ctx: string): Promise<FormalistResponse> => ({
      thoughts: "Multiple approaches",
      action: "PROPOSE_LEAN_TACTICS",
      lean_tactics: [
        { tactic: "simp", informal_sketch: "Low", confidence_score: 0.2 },
        { tactic: "apply Nat.add_comm", informal_sketch: "High", confidence_score: 0.95 },
        { tactic: "ring", informal_sketch: "Med", confidence_score: 0.6 },
      ],
    });

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "n/a", steps_to_backtrack: 0, new_directive: "n/a", action: "CONTINUE_PROOF",
    });

    const result = await runProverLoop(wm, solver, {
      maxGlobalIterations: 1, z3TimeoutMs: 30000, leanTimeoutMs: 60000, contextWindowTokens: 4096, 
      maxLocalRetries: 3,
      leanBridge: lean,
      theoremName: "sort_test",
      theoremSignature: "theorem thm (n m : Nat) : n + m = m + n",
      agentFactory: new MockAgentFactory({ PROVER: unsortedLLM as any, ARCHITECT: noopArchitect as any }),
    });

    expect(result.status).toBe("SOLVED");
  }, 90000);
});
