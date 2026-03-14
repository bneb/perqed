/**
 * Sprint 6: Dual-Engine Orchestrator — RED Tests
 *
 * Tests the Lean-as-DSL architecture:
 *   1. LeanTacticSchema + FormalistResponseSchema validation
 *   2. Z3 pre-flight (FALSIFY_FIRST) → Lean main loop (PROPOSE_LEAN_TACTICS)
 *   3. Lean proof success → commit to verified_lib/
 *   4. Lean failure escalation chain
 *   5. Real Lean subprocess integration (no mocks on solver side)
 */

import { expect, test, describe, afterAll } from "bun:test";
import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { WorkspaceManager } from "../src/workspace";
import { SolverBridge } from "../src/solver";
import { LeanBridge } from "../src/lean_bridge";
import { runProverLoop } from "../src/orchestrator";

// Sprint 6 imports — these DO NOT exist yet (RED: import error)
import {
  LeanTacticSchema,
  FormalistResponseSchema,
  type FormalistResponse,
  type ArchitectResponse,
} from "../src/schemas";

const BASE_DIR = "./tmp_test_dual_engine";
const RUN_NAME = "dual_engine_test";

async function setupWorkspace(): Promise<WorkspaceManager> {
  await rm(BASE_DIR, { recursive: true, force: true });
  const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
  await wm.init();
  const gc = join(BASE_DIR, "global_config");
  await mkdir(gc, { recursive: true });
  await Bun.write(join(gc, "system_prompts.md"), "You are a mathematician.");
  await Bun.write(join(gc, "general_skills.md"), "Use deduction.");
  await Bun.write(join(gc, "config.json"), "{}");
  await Bun.write(join(BASE_DIR, "runs", RUN_NAME, "objective.md"), "Prove n + m = m + n");
  return wm;
}

afterAll(async () => {
  await rm(BASE_DIR, { recursive: true, force: true });
});

// ──────────────────────────────────────────────
// 1. SCHEMA VALIDATION — LeanTacticSchema + FormalistResponseSchema
// ──────────────────────────────────────────────

describe("Dual-Engine — Schema Validation", () => {
  test("LeanTacticSchema accepts valid Lean tactic with confidence_score", () => {
    const valid = {
      tactic: "omega",
      informal_sketch: "Use omega to discharge linear arithmetic goal",
      confidence_score: 0.9,
    };
    const result = LeanTacticSchema.parse(valid);
    expect(result.tactic).toBe("omega");
    expect(result.confidence_score).toBe(0.9);
  });

  test("LeanTacticSchema rejects missing tactic field", () => {
    const noTactic = {
      informal_sketch: "Some approach",
      confidence_score: 0.5,
    };
    expect(() => LeanTacticSchema.parse(noTactic)).toThrow();
  });

  test("FormalistResponseSchema accepts PROPOSE_LEAN_TACTICS with lean_tactics array", () => {
    const response = {
      thoughts: "Analyzing the tactic state, I see a linear arithmetic goal",
      action: "PROPOSE_LEAN_TACTICS",
      lean_tactics: [
        { tactic: "omega", informal_sketch: "Direct omega", confidence_score: 0.95 },
        { tactic: "simp", informal_sketch: "Try simp first", confidence_score: 0.6 },
      ],
    };
    const result = FormalistResponseSchema.parse(response);
    expect(result.action).toBe("PROPOSE_LEAN_TACTICS");
    expect(result.lean_tactics!.length).toBe(2);
  });

  test("FormalistResponseSchema rejects more than 5 lean_tactics", () => {
    const tooMany = {
      thoughts: "Overloaded",
      action: "PROPOSE_LEAN_TACTICS",
      lean_tactics: Array.from({ length: 6 }, (_, i) => ({
        tactic: `tactic_${i}`,
        informal_sketch: `Approach ${i}`,
        confidence_score: 0.5,
      })),
    };
    expect(() => FormalistResponseSchema.parse(tooMany)).toThrow();
  });

  test("FormalistResponseSchema accepts SEARCH_LEMMA action", () => {
    const search = {
      thoughts: "I need a lemma about natural number addition commutativity",
      action: "SEARCH_LEMMA",
      search_query: "Nat.add_comm",
    };
    const result = FormalistResponseSchema.parse(search);
    expect(result.action).toBe("SEARCH_LEMMA");
    expect(result.search_query).toBe("Nat.add_comm");
  });

  test("FormalistResponseSchema still accepts GIVE_UP and SOLVED", () => {
    const giveUp = { thoughts: "Stuck", action: "GIVE_UP" };
    expect(() => FormalistResponseSchema.parse(giveUp)).not.toThrow();

    const solved = {
      thoughts: "Done!",
      action: "SOLVED",
      lean_tactics: [{ tactic: "omega", informal_sketch: "Final step", confidence_score: 1.0 }],
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
        { tactic: "omega", informal_sketch: "Linear arithmetic", confidence_score: 0.9 },
      ],
    });

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "n/a", steps_to_backtrack: 0, new_directive: "n/a",
    });

    // Need the dual-engine version of runProverLoop
    await runProverLoop(wm, solver, {
      maxGlobalIterations: 1,
      maxLocalRetries: 3,
      leanBridge: lean,
      theoremName: "add_comm",
      theoremSignature: "(n m : Nat) : n + m = m + n",
    }, formalistLLM, noopArchitect);

    // The winning tactic should be logged
    const labLog = await Bun.file(wm.paths.labLog).text();
    expect(labLog).toContain("omega");
  });

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
      return { analysis: "All tactics wrong", steps_to_backtrack: 0, new_directive: "try induction" };
    };

    await runProverLoop(wm, solver, {
      maxGlobalIterations: 5,
      maxLocalRetries: 3,
      leanBridge: lean,
      theoremName: "add_comm",
      theoremSignature: "(n m : Nat) : n + m = m + n",
    }, badFormalistLLM, mockArchitect);

    expect(architectCalled).toBe(true);
  }, 15000); // 15s timeout — 5 real Lean invocations

  test("successful Lean proof commits to verified_lib/", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();
    const lean = new LeanBridge();

    const solvingLLM = async (_ctx: string): Promise<FormalistResponse> => ({
      thoughts: "This is a simple arithmetic identity",
      action: "PROPOSE_LEAN_TACTICS",
      lean_tactics: [
        { tactic: "omega", informal_sketch: "Direct omega", confidence_score: 0.99 },
      ],
    });

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "n/a", steps_to_backtrack: 0, new_directive: "n/a",
    });

    await runProverLoop(wm, solver, {
      maxGlobalIterations: 1,
      maxLocalRetries: 3,
      leanBridge: lean,
      theoremName: "nat_add_comm",
      theoremSignature: "(n m : Nat) : n + m = m + n",
    }, solvingLLM, noopArchitect);

    // Proof should be committed to the vault
    const proofs = await wm.getVerifiedProofs();
    expect(proofs).toContain("nat_add_comm");
  });

  test("lean_tactics are sorted by confidence_score descending", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();
    const lean = new LeanBridge();

    // Track execution order via monkey-patching
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
        { tactic: "omega", informal_sketch: "High", confidence_score: 0.95 },
        { tactic: "ring", informal_sketch: "Med", confidence_score: 0.6 },
      ],
    });

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "n/a", steps_to_backtrack: 0, new_directive: "n/a",
    });

    await runProverLoop(wm, solver, {
      maxGlobalIterations: 1,
      maxLocalRetries: 3,
      leanBridge: lean,
      theoremName: "sort_test",
      theoremSignature: "(n m : Nat) : n + m = m + n",
    }, unsortedLLM, noopArchitect);

    // Should be sorted: omega (0.95) → ring (0.6) → simp (0.2)
    expect(executionOrder[0]).toBe("omega");
    expect(executionOrder[1]).toBe("ring");
    expect(executionOrder[2]).toBe("simp");
  });
});
