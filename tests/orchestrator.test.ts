/**
 * Tests for the Orchestrator — escalation logic, failure counting,
 * backtracking integration, and directive injection.
 *
 * All LLM and Architect calls are mocked to test the state machine
 * logic in isolation.
 *
 * v2.0: Migrated from PROPOSE_TACTIC → PROPOSE_TACTICS with tactics array.
 */

import { expect, test, describe, beforeEach, afterAll } from "bun:test";
import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { WorkspaceManager } from "../src/workspace";
import { SolverBridge } from "../src/solver";
import { runProverLoop } from "../src/orchestrator";
import type { AgentResponse, ArchitectResponse } from "../src/schemas";

// ──────────────────────────────────────────────
// Test Workspace Setup
// ──────────────────────────────────────────────

const BASE_DIR = "./tmp_test_orchestrator";
const RUN_NAME = "orch_test";

/** Helper: create a failing PROPOSE_TACTICS response with a single bad tactic. */
function failingTacticsResponse(thoughts: string = "Trying a bad approach"): AgentResponse {
  return {
    thoughts,
    action: "PROPOSE_TACTICS",
    tactics: [{
      informal_sketch: thoughts,
      confidence_score: 0.5,
      code: "print('sat')", // Not a real proof — solver returns success: false
    }],
  };
}

async function setupWorkspace(): Promise<WorkspaceManager> {
  await rm(BASE_DIR, { recursive: true, force: true });
  const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
  await wm.init();

  // Write minimal global config
  const gc = join(BASE_DIR, "global_config");
  await mkdir(gc, { recursive: true });
  await Bun.write(join(gc, "system_prompts.md"), "You are a mathematician.");
  await Bun.write(join(gc, "general_skills.md"), "Use deduction.");
  await Bun.write(join(gc, "config.json"), "{}");

  // Write objective
  await Bun.write(join(BASE_DIR, "runs", RUN_NAME, "objective.md"), "Prove x + 1 > x");

  return wm;
}

afterAll(async () => {
  await rm(BASE_DIR, { recursive: true, force: true });
});

// ──────────────────────────────────────────────
// Failure Counting & Escalation Trigger
// ──────────────────────────────────────────────

describe("Orchestrator — Failure Counting", () => {
  test("triggers architect after 3 consecutive solver failures", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();
    let architectCalled = false;

    const failingLLM = async (_ctx: string): Promise<AgentResponse> =>
      failingTacticsResponse("Bad approach");

    const mockArchitect = async (_log: string, _progress: string): Promise<ArchitectResponse> => {
      architectCalled = true;
      return {
        analysis: "All tactics are wrong.",
        steps_to_backtrack: 0,
        new_directive: "Try a completely different encoding.",
      };
    };

    await runProverLoop(wm, solver, {
      maxLocalRetries: 3,
      maxGlobalIterations: 4,
    }, failingLLM, mockArchitect);

    expect(architectCalled).toBe(true);
  });

  test("does NOT trigger architect before 3 failures", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();
    let architectCalled = false;

    const failingLLM = async (_ctx: string): Promise<AgentResponse> =>
      failingTacticsResponse("Bad tactic");

    const mockArchitect = async (_log: string, _progress: string): Promise<ArchitectResponse> => {
      architectCalled = true;
      return { analysis: "x", steps_to_backtrack: 0, new_directive: "y" };
    };

    await runProverLoop(wm, solver, {
      maxLocalRetries: 3,
      maxGlobalIterations: 2,
    }, failingLLM, mockArchitect);

    expect(architectCalled).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Escalation Reset
// ──────────────────────────────────────────────

describe("Orchestrator — Escalation Reset", () => {
  test("resets consecutive failure counter after architect call", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();
    let architectCallCount = 0;
    let llmCallCount = 0;

    const failingLLM = async (_ctx: string): Promise<AgentResponse> => {
      llmCallCount++;
      return failingTacticsResponse("Another failed attempt");
    };

    const mockArchitect = async (_log: string, _progress: string): Promise<ArchitectResponse> => {
      architectCallCount++;
      return {
        analysis: "Still stuck.",
        steps_to_backtrack: 0,
        new_directive: "Try something else entirely.",
      };
    };

    await runProverLoop(wm, solver, {
      maxLocalRetries: 3,
      maxGlobalIterations: 7,
    }, failingLLM, mockArchitect);

    expect(architectCallCount).toBe(2);
  });
});

// ──────────────────────────────────────────────
// Backtracking Integration
// ──────────────────────────────────────────────

describe("Orchestrator — Backtracking Integration", () => {
  test("backtracks the number of steps the architect specifies", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();

    await wm.updateHappyPath("Step 1: base case");
    await wm.updateHappyPath("Step 2: inductive hypothesis");
    await wm.updateHappyPath("Step 3: bad inductive step");

    const failingLLM = async (_ctx: string): Promise<AgentResponse> =>
      failingTacticsResponse("Keep failing");

    const mockArchitect = async (_log: string, _progress: string): Promise<ArchitectResponse> => ({
      analysis: "Steps 2 and 3 build on a flawed hypothesis.",
      steps_to_backtrack: 2,
      new_directive: "Re-derive the inductive hypothesis from scratch.",
    });

    await runProverLoop(wm, solver, {
      maxLocalRetries: 3,
      maxGlobalIterations: 3,
    }, failingLLM, mockArchitect);

    const progress = await Bun.file(join(BASE_DIR, "runs", RUN_NAME, "current_progress.md")).text();
    const lines = progress.trim().split("\n").filter(Boolean);
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("Step 1");
  });
});

// ──────────────────────────────────────────────
// Directive Injection
// ──────────────────────────────────────────────

describe("Orchestrator — Directive Injection", () => {
  test("writes architect directive to architect_directive.md", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();

    const failingLLM = async (_ctx: string): Promise<AgentResponse> =>
      failingTacticsResponse("Failing");

    const mockArchitect = async (_log: string, _progress: string): Promise<ArchitectResponse> => ({
      analysis: "Wrong approach entirely.",
      steps_to_backtrack: 0,
      new_directive: "USE_FORALL_QUANTIFIERS_INSTEAD",
    });

    await runProverLoop(wm, solver, {
      maxLocalRetries: 3,
      maxGlobalIterations: 3,
    }, failingLLM, mockArchitect);

    const directiveFile = Bun.file(join(BASE_DIR, "runs", RUN_NAME, "domain_skills", "architect_directive.md"));
    expect(await directiveFile.exists()).toBe(true);

    const content = await directiveFile.text();
    expect(content).toContain("USE_FORALL_QUANTIFIERS_INSTEAD");
  });

  test("architect directive appears in context window on subsequent calls", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();
    const contextsSeen: string[] = [];
    let callCount = 0;

    const trackingLLM = async (ctx: string): Promise<AgentResponse> => {
      callCount++;
      contextsSeen.push(ctx);
      return failingTacticsResponse("Failing");
    };

    const mockArchitect = async (_log: string, _progress: string): Promise<ArchitectResponse> => ({
      analysis: "Wrong approach.",
      steps_to_backtrack: 0,
      new_directive: "UNIQUE_DIRECTIVE_MARKER_XYZ",
    });

    await runProverLoop(wm, solver, {
      maxLocalRetries: 3,
      maxGlobalIterations: 5,
    }, trackingLLM, mockArchitect);

    expect(callCount).toBeGreaterThanOrEqual(4);
    const postArchitectContext = contextsSeen[3];
    expect(postArchitectContext).toContain("UNIQUE_DIRECTIVE_MARKER_XYZ");
  });

  test("GIVE_UP action triggers immediate architect escalation", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();
    let architectCalled = false;

    const givingUpLLM = async (_ctx: string): Promise<AgentResponse> => ({
      thoughts: "I cannot make progress.",
      action: "GIVE_UP",
    });

    const mockArchitect = async (_log: string, _progress: string): Promise<ArchitectResponse> => {
      architectCalled = true;
      return {
        analysis: "Agent hit a conceptual wall.",
        steps_to_backtrack: 0,
        new_directive: "Try proof by contradiction instead.",
      };
    };

    await runProverLoop(wm, solver, {
      maxLocalRetries: 3,
      maxGlobalIterations: 1,
    }, givingUpLLM, mockArchitect);

    expect(architectCalled).toBe(true);
  });
});
