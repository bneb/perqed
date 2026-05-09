/**
 * tests/red_team.test.ts — RedTeamAuditor (TDD RED → GREEN)
 *
 * Covers: updated runAdversarialRedTeam logic that integrates with Z3 directly
 * instead of the deprecated WEAKEN/APPROVE loops.
 */

import { describe, test, expect, afterEach, spyOn } from "bun:test";
import { RedTeamAuditor } from "../src/agents/red_team";
import { SolverBridge } from "../src/solver";
import { LeanBridge } from "../src/lean_bridge";

describe("RedTeamAuditor — Certifying Solver Refactor", () => {
  afterEach(() => {
    // Restore mocks after each test
  });

  test("RedTeamAuditor exposes runAdversarialRedTeam", async () => {
    const auditor = new RedTeamAuditor({ apiKey: "test-key" });
    expect(typeof auditor.runAdversarialRedTeam).toBe("function");
  });

  test("Passes True Falsification: Z3 outputs valid JSON witness -> Lean verifies -> COUNTER_EXAMPLE_FOUND", async () => {
    // Stub the solver executing Python correctly and emitting JSON
    const z3Spy = spyOn(SolverBridge.prototype, 'runZ3').mockResolvedValue({
      output: '{"nodes": 3, "edges": [[0,1], [1,2]]}',
      success: true
    });
    
    // Stub the Lean Bridge validating the compiled structural file
    const leanSpy = spyOn(LeanBridge.prototype, 'executeLean').mockResolvedValue({
      success: true,
      isComplete: true,
      hasSorry: false,
      rawOutput: "FALSIFICATION_CONFIRMED"
    });

    // We stub the generative AI so it doesn't try calling Gemini
    const aiGenerateFn = async () => ({ text: "import os\nprint('{}')" });
    
    const auditor = new RedTeamAuditor({ apiKey: "test-key" });
    (auditor as any).ai = { models: { generateContent: aiGenerateFn } };

    const result = await auditor.runAdversarialRedTeam("theorem test_bound");
    
    expect(result.status).toBe("COUNTER_EXAMPLE_FOUND");
    expect(result.counterExamplePayload).toEqual({ nodes: 3, edges: [[0, 1], [1, 2]] });
    expect(leanSpy).toHaveBeenCalled();
    
    z3Spy.mockRestore();
    leanSpy.mockRestore();
  });

  test("Blocks False Falsification (Lean Rejects): Z3 outputs JSON -> Lean compiler errors -> VERIFIED_BULLETPROOF", async () => {
    const z3Spy = spyOn(SolverBridge.prototype, 'runZ3').mockResolvedValue({
      output: '{"nodes": 4, "edges": [[0,1]]}',
      success: true
    });
    
    const leanSpy = spyOn(LeanBridge.prototype, 'executeLean').mockResolvedValue({
      success: false,
      isComplete: false,
      hasSorry: false,
      error: "error: failed to prove falsification_verified",
      rawOutput: ""
    });

    const aiGenerateFn = async () => ({ text: "import sys" });
    const auditor = new RedTeamAuditor({ apiKey: "test-key" });
    (auditor as any).ai = { models: { generateContent: aiGenerateFn } };

    const result = await auditor.runAdversarialRedTeam("theorem test_bound");
    
    expect(result.status).toBe("VERIFIED_BULLETPROOF");
    expect(leanSpy).toHaveBeenCalled();
    
    z3Spy.mockRestore();
    leanSpy.mockRestore();
  });

  test("Blocks False Falsification (Garbage Output): Z3 prints 'sat' with NO JSON -> VERIFIED_BULLETPROOF", async () => {
    const z3Spy = spyOn(SolverBridge.prototype, 'runZ3').mockResolvedValue({
      output: "sat\n[Debug] Model found",
      success: true
    });
    
    // Lean should not be called if there's no valid JSON witness to translate
    const leanSpy = spyOn(LeanBridge.prototype, 'executeLean');

    const aiGenerateFn = async () => ({ text: "..." });
    const auditor = new RedTeamAuditor({ apiKey: "test-key" });
    (auditor as any).ai = { models: { generateContent: aiGenerateFn } };

    const result = await auditor.runAdversarialRedTeam("theorem test_bound");
    
    expect(result.status).toBe("VERIFIED_BULLETPROOF");
    expect(leanSpy).not.toHaveBeenCalled();
    
    z3Spy.mockRestore();
    leanSpy.mockRestore();
  });
});
