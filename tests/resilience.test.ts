/**
 * Sprint 4 Tests — Resumability, max iterations, and SOLVED output.
 *
 * These tests verify that the orchestrator can resume from existing state,
 * abort cleanly at max iterations, and produce proof_solution.txt on SOLVED.
 */

import { expect, test, describe, beforeEach, afterAll } from "bun:test";
import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { WorkspaceManager } from "../src/workspace";
import { SolverBridge } from "../src/solver";
import { runProverLoop } from "../src/orchestrator";
import type { AgentResponse, ArchitectResponse } from "../src/schemas";

const BASE_DIR = "./tmp_test_resilience";
const RUN_NAME = "resilience_test";

async function setupWorkspace(): Promise<WorkspaceManager> {
  await rm(BASE_DIR, { recursive: true, force: true });
  const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
  await wm.init();
  const gc = join(BASE_DIR, "global_config");
  await mkdir(gc, { recursive: true });
  await Bun.write(join(gc, "system_prompts.md"), "You are a mathematician.");
  await Bun.write(join(gc, "general_skills.md"), "Use deduction.");
  await Bun.write(join(gc, "config.json"), "{}");
  await Bun.write(join(BASE_DIR, "runs", RUN_NAME, "objective.md"), "Prove x + 1 > x");
  return wm;
}

afterAll(async () => {
  await rm(BASE_DIR, { recursive: true, force: true });
});

// ──────────────────────────────────────────────
// Resumability
// ──────────────────────────────────────────────

describe("Orchestrator — Resumability", () => {
  test("resumes from existing progress without clearing files", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();

    // Simulate a previous run that logged 3 successful steps
    await wm.updateHappyPath("Step 1: Base case verified");
    await wm.updateHappyPath("Step 2: Inductive hypothesis established");
    await wm.updateHappyPath("Step 3: Intermediate lemma proved");
    await wm.logAttempt("Previous tactic", "old_code()", "unsat", true);

    // Now create a NEW workspace manager pointing to the SAME run
    const wm2 = new WorkspaceManager(BASE_DIR, RUN_NAME);
    await wm2.init(); // Should NOT wipe existing files

    // Verify existing progress is preserved
    const progress = await Bun.file(wm2.paths.progress).text();
    expect(progress).toContain("Step 1");
    expect(progress).toContain("Step 2");
    expect(progress).toContain("Step 3");

    // Verify existing lab log is preserved
    const labLog = await Bun.file(wm2.paths.labLog).text();
    expect(labLog).toContain("Previous tactic");

    // Verify context includes the existing progress
    const gc = join(BASE_DIR, "global_config");
    await mkdir(gc, { recursive: true });
    const ctx = await wm2.buildContextWindow();
    expect(ctx).toContain("Step 3: Intermediate lemma proved");
  });

  test("new steps append to existing progress on resume", async () => {
    const wm = await setupWorkspace();

    // Pre-existing state
    await wm.updateHappyPath("Step 1: existing");

    // Simulate resumed run adding a step
    const wm2 = new WorkspaceManager(BASE_DIR, RUN_NAME);
    await wm2.init();
    await wm2.updateHappyPath("Step 2: resumed");

    const progress = await Bun.file(wm2.paths.progress).text();
    const lines = progress.trim().split("\n").filter(Boolean);
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain("Step 1: existing");
    expect(lines[1]).toContain("Step 2: resumed");
  });
});

// ──────────────────────────────────────────────
// Max Iterations Abort
// ──────────────────────────────────────────────

describe("Orchestrator — Max Iterations", () => {
  test("cleanly exits after maxGlobalIterations without SOLVED", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();

    let callCount = 0;
    const infiniteTactics = async (_ctx: string): Promise<AgentResponse> => {
      callCount++;
      return {
        thoughts: `Attempt ${callCount}`,
        action: "PROPOSE_TACTICS",
        tactics: [{
          informal_sketch: `Attempt ${callCount} by contradiction`,
          confidence_score: 0.8,
          code: "from z3 import *\nx = Int('x')\ns = Solver()\ns.add(Not(x + 1 > x))\nprint(s.check())",
        }],
      };
    };

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "Keep going.",
      steps_to_backtrack: 0,
      new_directive: "Continue.",
    });

    // Should exit after exactly 5 iterations
    await runProverLoop(wm, solver, {
      maxGlobalIterations: 5,
      maxLocalRetries: 3,
    }, infiniteTactics, noopArchitect);

    expect(callCount).toBe(5);

    // Lab log should have exactly 5 entries
    const labLog = await Bun.file(wm.paths.labLog).text();
    const entries = labLog.split("---").filter((e) => e.trim().length > 0);
    expect(entries.length).toBe(5);
  });
});

// ──────────────────────────────────────────────
// SOLVED → proof_solution.txt
// ──────────────────────────────────────────────

describe("Orchestrator — SOLVED Output", () => {
  test("generates proof_solution.txt when agent returns SOLVED", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();

    // Pre-populate progress
    await wm.updateHappyPath("Step 1: base case verified");
    await wm.updateHappyPath("Step 2: inductive step proved");

    let callCount = 0;
    const solvingLLM = async (_ctx: string): Promise<AgentResponse> => {
      callCount++;
      if (callCount === 1) {
        return {
          thoughts: "The proof is complete.",
          action: "SOLVED",
          code: "# Final verification passed",
        };
      }
      return { thoughts: "Should not reach here", action: "GIVE_UP" };
    };

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "n/a",
      steps_to_backtrack: 0,
      new_directive: "n/a",
    });

    await runProverLoop(wm, solver, {
      maxGlobalIterations: 10,
      maxLocalRetries: 3,
    }, solvingLLM, noopArchitect);

    // proof_solution.txt should exist in the run directory
    const solutionFile = Bun.file(join(BASE_DIR, "runs", RUN_NAME, "proof_solution.txt"));
    expect(await solutionFile.exists()).toBe(true);

    const solution = await solutionFile.text();
    // Should contain the progress steps
    expect(solution).toContain("Step 1: base case verified");
    expect(solution).toContain("Step 2: inductive step proved");
    // Should contain the SOLVED declaration
    expect(solution).toContain("SOLVED");
  });

  test("does NOT generate proof_solution.txt when max iterations reached without SOLVED", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();

    const failingLLM = async (_ctx: string): Promise<AgentResponse> => ({
      thoughts: "Failing",
      action: "PROPOSE_TACTICS",
      tactics: [{
        informal_sketch: "Bad approach",
        confidence_score: 0.5,
        code: "print('sat')",
      }],
    });

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "stuck",
      steps_to_backtrack: 0,
      new_directive: "try again",
    });

    await runProverLoop(wm, solver, {
      maxGlobalIterations: 3,
      maxLocalRetries: 3,
    }, failingLLM, noopArchitect);

    const solutionFile = Bun.file(join(BASE_DIR, "runs", RUN_NAME, "proof_solution.txt"));
    expect(await solutionFile.exists()).toBe(false);
  });
});
