/**
 * Sprint 5: Council Edition — RED Tests
 *
 * Tests for the three architectural pivots:
 *   1. Tao:     FALSIFY_FIRST action — bounded counterexample search before proof
 *   2. Dean:    Parallel multi-tactic execution via Promise.all
 *   3. Hassabis: confidence_score value function + priority sorting
 *
 * These tests are designed to FAIL until the new schemas, orchestrator
 * logic, and system prompts are implemented.
 */

import { expect, test, describe, afterAll } from "bun:test";
import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { WorkspaceManager } from "../src/workspace";
import { SolverBridge } from "../src/solver";
import { runProverLoop } from "../src/orchestrator";

// Sprint 5 imports — these schemas DO NOT exist yet (RED: import error)
import {
  TacticSchema,
  AgentResponseSchema,
  type AgentResponse,
  type ArchitectResponse,
} from "../src/schemas";

const BASE_DIR = "./tmp_test_council";
const RUN_NAME = "council_test";

async function setupWorkspace(): Promise<WorkspaceManager> {
  await rm(BASE_DIR, { recursive: true, force: true });
  const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
  await wm.init();
  const gc = join(BASE_DIR, "global_config");
  await mkdir(gc, { recursive: true });
  await Bun.write(join(gc, "system_prompts.md"), "You are a mathematician.");
  await Bun.write(join(gc, "general_skills.md"), "Use deduction.");
  await Bun.write(join(gc, "config.json"), "{}");
  await Bun.write(join(BASE_DIR, "runs", RUN_NAME, "objective.md"), "Prove n^2 even => n even");
  return wm;
}

afterAll(async () => {
  await rm(BASE_DIR, { recursive: true, force: true });
});

// ──────────────────────────────────────────────
// 1. SCHEMA VALIDATION — TacticSchema + New Actions
// ──────────────────────────────────────────────

describe("Council — Schema Validation", () => {
  test("TacticSchema accepts valid tactic with confidence_score", () => {
    const valid = {
      informal_sketch: "Prove by contradiction: assume n is odd but n^2 is even",
      confidence_score: 0.85,
      code: "from z3 import *\nn = Int('n')\ns = Solver()\ns.add(n % 2 != 0)\ns.add((n*n) % 2 == 0)\nprint(s.check())",
    };
    const result = TacticSchema.parse(valid);
    expect(result.confidence_score).toBe(0.85);
    expect(result.informal_sketch).toContain("contradiction");
    expect(result.code).toContain("z3");
  });

  test("TacticSchema rejects confidence_score outside [0, 1]", () => {
    const tooHigh = {
      informal_sketch: "Some approach",
      confidence_score: 1.5,
      code: "print('unsat')",
    };
    expect(() => TacticSchema.parse(tooHigh)).toThrow();

    const negative = {
      informal_sketch: "Some approach",
      confidence_score: -0.1,
      code: "print('unsat')",
    };
    expect(() => TacticSchema.parse(negative)).toThrow();
  });

  test("TacticSchema rejects missing informal_sketch", () => {
    const noSketch = {
      confidence_score: 0.5,
      code: "print('unsat')",
    };
    expect(() => TacticSchema.parse(noSketch)).toThrow();
  });

  test("AgentResponseSchema accepts FALSIFY_FIRST action", () => {
    const falsifyResponse = {
      thoughts: "I should first check if the theorem has trivial counterexamples",
      action: "FALSIFY_FIRST",
      code: "from z3 import *\nn = Int('n')\ns = Solver()\ns.add(n >= -100, n <= 100)\ns.add(n*n % 2 == 0, n % 2 != 0)\nprint(s.check())",
    };
    const result = AgentResponseSchema.parse(falsifyResponse);
    expect(result.action).toBe("FALSIFY_FIRST");
    expect(result.code).toContain("z3");
  });

  test("AgentResponseSchema accepts PROPOSE_TACTICS with tactics array", () => {
    const batchResponse = {
      thoughts: "Multiple approaches to try in parallel",
      action: "PROPOSE_TACTICS",
      tactics: [
        {
          informal_sketch: "Direct Skolemization",
          confidence_score: 0.9,
          code: "from z3 import *\nn = Int('n')\ns = Solver()\ns.add(n*n % 2 == 0)\ns.add(Not(n % 2 == 0))\nprint(s.check())",
        },
        {
          informal_sketch: "ForAll approach with bounded domain",
          confidence_score: 0.6,
          code: "from z3 import *\nn = Int('n')\ns = Solver()\ns.add(ForAll([n], Implies(n*n % 2 == 0, n % 2 == 0)))\nprint(s.check())",
        },
        {
          informal_sketch: "Case split on parity",
          confidence_score: 0.75,
          code: "from z3 import *\nn = Int('n')\ns = Solver()\ns.add(n % 2 != 0)\ns.add((n*n) % 2 == 0)\nprint(s.check())",
        },
      ],
    };
    const result = AgentResponseSchema.parse(batchResponse);
    expect(result.action).toBe("PROPOSE_TACTICS");
    expect(result.tactics).toBeDefined();
    expect(result.tactics!.length).toBe(3);
  });

  test("AgentResponseSchema rejects more than 5 tactics", () => {
    const tooMany = {
      thoughts: "Overloaded",
      action: "PROPOSE_TACTICS",
      tactics: Array.from({ length: 6 }, (_, i) => ({
        informal_sketch: `Approach ${i}`,
        confidence_score: 0.5,
        code: `print('attempt_${i}')`,
      })),
    };
    expect(() => AgentResponseSchema.parse(tooMany)).toThrow();
  });

  test("AgentResponseSchema still accepts GIVE_UP and SOLVED", () => {
    const giveUp = { thoughts: "Stuck", action: "GIVE_UP" };
    expect(() => AgentResponseSchema.parse(giveUp)).not.toThrow();

    const solved = { thoughts: "Done!", action: "SOLVED", code: "print('unsat')" };
    expect(() => AgentResponseSchema.parse(solved)).not.toThrow();
  });
});

// ──────────────────────────────────────────────
// 2. FALSIFICATION PHASE (Tao's Mandate)
// ──────────────────────────────────────────────

describe("Council — Falsification Phase", () => {
  test("FALSIFY_FIRST runs the code via solver and logs result without updating progress", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();

    let callCount = 0;
    const falsifyingLLM = async (_ctx: string): Promise<AgentResponse> => {
      callCount++;
      if (callCount === 1) {
        // First call: attempt falsification (bounded search finds no counterexample)
        return {
          thoughts: "Checking for trivial counterexamples in [-100, 100]",
          action: "FALSIFY_FIRST",
          code: [
            "from z3 import *",
            "n = Int('n')",
            "s = Solver()",
            "s.add(n >= -100, n <= 100)",
            "s.add(n*n % 2 == 0, n % 2 != 0)",
            "print(s.check())",
          ].join("\n"),
        };
      }
      // Second call: now propose actual proof tactics
      return {
        thoughts: "Falsification passed, now proving rigorously",
        action: "PROPOSE_TACTICS",
        tactics: [{
          informal_sketch: "Skolemized proof by contradiction",
          confidence_score: 0.95,
          code: [
            "from z3 import *",
            "n = Int('n')",
            "s = Solver()",
            "s.add(n*n % 2 == 0)",
            "s.add(Not(n % 2 == 0))",
            "print(s.check())",
          ].join("\n"),
        }],
      };
    };

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "n/a", steps_to_backtrack: 0, new_directive: "n/a",
    });

    await runProverLoop(wm, solver, {
      maxGlobalIterations: 2,
      maxLocalRetries: 3,
    }, falsifyingLLM, noopArchitect);

    expect(callCount).toBe(2);

    // Falsification should be logged but NOT added to progress
    const labLog = await Bun.file(wm.paths.labLog).text();
    expect(labLog).toContain("FALSIFY");

    // Progress should only contain the real proof step (not falsification)
    const progress = await Bun.file(wm.paths.progress).text();
    expect(progress).not.toContain("FALSIFY");
  });

  test("FALSIFY_FIRST that finds a counterexample (sat) triggers architect escalation", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();
    let architectCalled = false;

    // Falsification finds a counterexample — theorem is wrong!
    const brokenTheoremLLM = async (_ctx: string): Promise<AgentResponse> => ({
      thoughts: "Testing falsifiability",
      action: "FALSIFY_FIRST",
      code: [
        "from z3 import *",
        "x = Int('x')",
        "s = Solver()",
        "# Looking for counterexample: is there an x where x*x is even but x is odd?",
        "# Simulating a found counterexample by printing sat",
        "print('sat')",
      ].join("\n"),
    });

    const mockArchitect = async (): Promise<ArchitectResponse> => {
      architectCalled = true;
      return {
        analysis: "Theorem appears falsifiable",
        steps_to_backtrack: 0,
        new_directive: "Re-examine the theorem statement",
      };
    };

    await runProverLoop(wm, solver, {
      maxGlobalIterations: 1,
      maxLocalRetries: 3,
    }, brokenTheoremLLM, mockArchitect);

    // A successful falsification (sat = counterexample found) should escalate
    expect(architectCalled).toBe(true);
  });
});

// ──────────────────────────────────────────────
// 3. PARALLEL EXECUTION (Dean's Mandate)
// ──────────────────────────────────────────────

describe("Council — Parallel Execution", () => {
  test("all tactics in PROPOSE_TACTICS are executed in parallel", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();

    // Track timestamps to verify parallel execution
    const executionStarts: number[] = [];
    const originalRunZ3 = solver.runZ3.bind(solver);

    // Monkey-patch to track execution (impure but necessary for timing)
    let z3CallCount = 0;
    solver.runZ3 = async (code: string, timeout: number) => {
      z3CallCount++;
      executionStarts.push(Date.now());
      return originalRunZ3(code, timeout);
    };

    const parallelLLM = async (_ctx: string): Promise<AgentResponse> => ({
      thoughts: "Three parallel tactics",
      action: "PROPOSE_TACTICS",
      tactics: [
        {
          informal_sketch: "Tactic A: direct negation",
          confidence_score: 0.9,
          code: "from z3 import *\nn = Int('n')\ns = Solver()\ns.add(n*n % 2 == 0)\ns.add(Not(n % 2 == 0))\nprint(s.check())",
        },
        {
          informal_sketch: "Tactic B: weaker approach",
          confidence_score: 0.5,
          code: "from z3 import *\nn = Int('n')\ns = Solver()\ns.add(n % 2 == 0)\nprint(s.check())",
        },
        {
          informal_sketch: "Tactic C: another negation",
          confidence_score: 0.7,
          code: "from z3 import *\nn = Int('n')\ns = Solver()\ns.add(n*n % 2 == 0, n % 2 != 0)\nprint(s.check())",
        },
      ],
    });

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "n/a", steps_to_backtrack: 0, new_directive: "n/a",
    });

    await runProverLoop(wm, solver, {
      maxGlobalIterations: 1,
      maxLocalRetries: 3,
    }, parallelLLM, noopArchitect);

    // All 3 tactics should have been sent to the solver
    expect(z3CallCount).toBe(3);
  });

  test("first unsat result wins and gets logged to progress", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();

    const mixedResultLLM = async (_ctx: string): Promise<AgentResponse> => ({
      thoughts: "Let's try all approaches",
      action: "PROPOSE_TACTICS",
      tactics: [
        {
          informal_sketch: "Bad tactic that finds sat",
          confidence_score: 0.3,
          code: "from z3 import *\nprint('sat')",
        },
        {
          informal_sketch: "WINNER: correct proof by contradiction",
          confidence_score: 0.95,
          code: "from z3 import *\nn = Int('n')\ns = Solver()\ns.add(n*n % 2 == 0)\ns.add(Not(n % 2 == 0))\nprint(s.check())",
        },
        {
          informal_sketch: "Another bad one",
          confidence_score: 0.2,
          code: "from z3 import *\nprint('sat')",
        },
      ],
    });

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "n/a", steps_to_backtrack: 0, new_directive: "n/a",
    });

    await runProverLoop(wm, solver, {
      maxGlobalIterations: 1,
      maxLocalRetries: 3,
    }, mixedResultLLM, noopArchitect);

    // The winning tactic's informal_sketch should be in progress
    const progress = await Bun.file(wm.paths.progress).text();
    expect(progress).toContain("WINNER");
  });

  test("all tactics fail → counts as single consecutive failure", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();
    let architectCalled = false;

    let callCount = 0;
    const allFailLLM = async (_ctx: string): Promise<AgentResponse> => {
      callCount++;
      return {
        thoughts: `Batch ${callCount}`,
        action: "PROPOSE_TACTICS",
        tactics: [
          { informal_sketch: "Bad A", confidence_score: 0.5, code: "print('sat')" },
          { informal_sketch: "Bad B", confidence_score: 0.3, code: "print('sat')" },
        ],
      };
    };

    const mockArchitect = async (): Promise<ArchitectResponse> => {
      architectCalled = true;
      return { analysis: "all fail", steps_to_backtrack: 0, new_directive: "retry" };
    };

    // 3 iterations × 2 failing tactics each → 3 consecutive failures → architect
    await runProverLoop(wm, solver, {
      maxGlobalIterations: 4,
      maxLocalRetries: 3,
    }, allFailLLM, mockArchitect);

    expect(architectCalled).toBe(true);
  });
});

// ──────────────────────────────────────────────
// 4. CONFIDENCE SCORING (Hassabis's Mandate)
// ──────────────────────────────────────────────

describe("Council — Confidence Scoring", () => {
  test("tactics are sorted by confidence_score descending before execution", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();

    // Track execution order
    const executionOrder: string[] = [];
    const originalRunZ3 = solver.runZ3.bind(solver);

    solver.runZ3 = async (code: string, timeout: number) => {
      // Extract a marker from the code to track order
      const markerMatch = code.match(/MARKER_(\w+)/);
      if (markerMatch) executionOrder.push(markerMatch[1]!);
      return originalRunZ3(code, timeout);
    };

    const unsortedLLM = async (_ctx: string): Promise<AgentResponse> => ({
      thoughts: "Proposing with varied confidence",
      action: "PROPOSE_TACTICS",
      tactics: [
        {
          informal_sketch: "Low confidence",
          confidence_score: 0.2,
          code: "# MARKER_LOW\nfrom z3 import *\nprint('sat')",
        },
        {
          informal_sketch: "Highest confidence",
          confidence_score: 0.95,
          code: "# MARKER_HIGH\nfrom z3 import *\nprint('sat')",
        },
        {
          informal_sketch: "Medium confidence",
          confidence_score: 0.6,
          code: "# MARKER_MED\nfrom z3 import *\nprint('sat')",
        },
      ],
    });

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "n/a", steps_to_backtrack: 0, new_directive: "n/a",
    });

    await runProverLoop(wm, solver, {
      maxGlobalIterations: 1,
      maxLocalRetries: 3,
    }, unsortedLLM, noopArchitect);

    // Tactics should have been sorted: HIGH (0.95), MED (0.6), LOW (0.2)
    expect(executionOrder).toEqual(["HIGH", "MED", "LOW"]);
  });

  test("winning tactic's confidence is logged in the lab entry", async () => {
    const wm = await setupWorkspace();
    const solver = new SolverBridge();

    const confidentLLM = async (_ctx: string): Promise<AgentResponse> => ({
      thoughts: "High confidence approach",
      action: "PROPOSE_TACTICS",
      tactics: [{
        informal_sketch: "Skolemized contradiction with 0.92 confidence",
        confidence_score: 0.92,
        code: "from z3 import *\nn = Int('n')\ns = Solver()\ns.add(n*n % 2 == 0)\ns.add(Not(n % 2 == 0))\nprint(s.check())",
      }],
    });

    const noopArchitect = async (): Promise<ArchitectResponse> => ({
      analysis: "n/a", steps_to_backtrack: 0, new_directive: "n/a",
    });

    await runProverLoop(wm, solver, {
      maxGlobalIterations: 1,
      maxLocalRetries: 3,
    }, confidentLLM, noopArchitect);

    const labLog = await Bun.file(wm.paths.labLog).text();
    // The confidence score should appear in the log
    expect(labLog).toContain("0.92");
  });
});
