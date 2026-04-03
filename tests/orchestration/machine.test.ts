/**
 * machine.test.ts — TDD Suite for the Perqed Research State Machine
 *
 * All actors are mocked via XState's .provide() — zero LLM calls.
 * Each test verifies a specific topological path through the DAG.
 *
 * Run: bun test tests/orchestration/machine.test.ts
 */

import { describe, expect, it } from "bun:test";
import { createActor, fromPromise, type AnyActorLogic } from "xstate";
import { researchMachine } from "../../src/orchestration/machine";
import type {
  IdeationOutput,
  ValidationOutput,
  SandboxOutput,
  SMTOutput,
  RefinementOutput,
  LeanOutput,
  ErrorCorrectionOutput,
  ScribeOutput,
  ResearchContext,
} from "../../src/orchestration/types";

// ──────────────────────────────────────────────
// Test Helpers
// ──────────────────────────────────────────────

/** Wait for the machine to reach a final state or a specific state value. */
function waitForState(
  actor: ReturnType<typeof createActor>,
  predicate: (value: string) => boolean,
  timeoutMs = 5000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for state match`)),
      timeoutMs,
    );

    // Check immediately
    const currentValue = actor.getSnapshot().value as string;
    if (predicate(currentValue)) {
      clearTimeout(timer);
      resolve();
      return;
    }

    actor.subscribe((snapshot) => {
      const value = snapshot.value as string;
      if (predicate(value)) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

function waitForFinal(actor: ReturnType<typeof createActor>, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for final state. Current: ${JSON.stringify(actor.getSnapshot().value)}`)),
      timeoutMs,
    );

    const snapshot = actor.getSnapshot();
    if (snapshot.status === "done") {
      clearTimeout(timer);
      resolve();
      return;
    }

    actor.subscribe((s) => {
      if (s.status === "done") {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

// ──────────────────────────────────────────────
// Mock Actor Factories
// ──────────────────────────────────────────────

function mockIdeation(output: IdeationOutput) {
  return fromPromise<IdeationOutput, { prompt: string; retries: number; apiKey: string; workspaceDir: string; lastValidationError: string | null; publishableMode: boolean }>(
    async () => output,
  );
}

function mockValidation(valid: boolean, error?: string) {
  return fromPromise<ValidationOutput, { hypothesis: string }>(async () => {
    if (!valid) throw new Error(error ?? "HALLUCINATION_DETECTED");
    return { isValid: true as const, ast: { validated: true } };
  });
}

function mockSandbox(output: SandboxOutput) {
  return fromPromise<SandboxOutput, { hypothesis: string; domains: string[]; apiKey: string; plan: any; evidence: any }>(
    async () => output,
  );
}

function mockSMT(output: SMTOutput) {
  return fromPromise<SMTOutput, { smtScript: string }>(async () => output);
}

function mockRefinement(output: RefinementOutput) {
  return fromPromise<RefinementOutput, { hypothesis: string; counterExample: unknown; literature: string[]; apiKey: string; plan: any }>(
    async () => output,
  );
}

function mockLeanVerification(output: any) {
  return fromPromise<any, { tactic: string; signature: string; theoremName: string; outputDir: string }>(
    async () => output,
  );
}

function mockTacticGenerator() {
  return fromPromise<any, any>(async () => ({
    role: "TACTICIAN",
    response: { lean_tactics: [{ tactic: "skip" }] }
  }));
}

function mockErrorCorrection(output: ErrorCorrectionOutput) {
  return fromPromise<ErrorCorrectionOutput, { compilerTrace: string; conjecture: any; apiKey: string }>(
    async () => output,
  );
}

function mockScribe(output: ScribeOutput) {
  return fromPromise<ScribeOutput, { plan: any; evidence: any; conjecture: any; proofStatus: string; outputDir: string; apiKey: string; redTeamHistory: any[] }>(
    async () => output,
  );
}

// ──────────────────────────────────────────────
// Standard mock outputs
// ──────────────────────────────────────────────

const NOVEL_IDEATION: IdeationOutput = {
  classification: "NOVEL_DISCOVERY",
  hypothesis: "theorem foo : 1 + 1 = 2",
  plan: {
    prompt: "test",
    seed_paper: { arxivId: "2401.00001", title: "Test Paper", abstract: "Test" },
    extension_hypothesis: "1 + 1 = 2",
    domains_to_probe: ["number_theory"],
    lean_target_sketch: "theorem foo : 1 + 1 = 2",
  },
  literature: ["paper1"],
};

const KNOWN_IDEATION: IdeationOutput = {
  ...NOVEL_IDEATION,
  classification: "KNOWN_THEOREM",
};

const WITNESS_SANDBOX: SandboxOutput = {
  signal: "WITNESS_FOUND",
  energy: 0,
  evidence: {
    hypothesis: "test",
    results: [],
    synthesis: "Witness found",
    anomalies: [],
    kills: [],
  },
  data: { witness: true },
  approvedConjecture: { signature: "theorem foo : 1 + 1 = 2", description: "trivial" },
  redTeamHistory: [],
};

const PLATEAU_SANDBOX: SandboxOutput = {
  ...WITNESS_SANDBOX,
  signal: "PLATEAU_DETECTED",
  energy: 25,
  approvedConjecture: null,
};

const CLEAN_KILL_SANDBOX: SandboxOutput = {
  ...WITNESS_SANDBOX,
  signal: "CLEAN_KILL",
  energy: -1,
  data: { counterExample: [1, 2, 3] },
  approvedConjecture: null,
};

const PROOF_COMPLETE = {
  isComplete: true,
  tactic: "norm_num",
  error: null,
};

const COMPILER_ERROR = {
  isComplete: false,
  error: "unknown identifier 'foo'",
};

const SCRIBE_DONE: ScribeOutput = {
  reportPath: "/tmp/test/paper.tex",
};

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("Research State Machine", () => {
  it("starts in Idle and transitions to Ideation on START", async () => {
    const testMachine = researchMachine.provide({
      actors: {
        ideationActor: mockIdeation(NOVEL_IDEATION),
        validationActor: mockValidation(true),
        sandboxActor: mockSandbox(WITNESS_SANDBOX),
        leanVerificationActor: mockLeanVerification(PROOF_COMPLETE),
        tacticGeneratorActor: mockTacticGenerator(),
        scribeActor: mockScribe(SCRIBE_DONE),
      },
    });

    const actor = createActor(testMachine);
    actor.start();

    expect(actor.getSnapshot().value).toBe("Idle");
    actor.send({ type: "START", prompt: "test prompt", apiKey: "test", workspaceDir: "/tmp", outputDir: "/tmp/test", publishableMode: false });

    await waitForFinal(actor);
    expect(actor.getSnapshot().context.prompt).toBe("test prompt");
  });

  it("happy path: Idle → Ideation → Validation → Sandbox(WITNESS) → Lean → Scribe → Done", async () => {
    const testMachine = researchMachine.provide({
      actors: {
        ideationActor: mockIdeation(NOVEL_IDEATION),
        validationActor: mockValidation(true),
        sandboxActor: mockSandbox(WITNESS_SANDBOX),
        leanVerificationActor: mockLeanVerification(PROOF_COMPLETE),
        tacticGeneratorActor: mockTacticGenerator(),
        scribeActor: mockScribe(SCRIBE_DONE),
      },
    });

    const actor = createActor(testMachine);
    const visited: string[] = [];
    actor.subscribe((s) => {
      const v = s.value;
      const stateName = typeof v === "object" && v !== null ? (Object.keys(v)[0] || "unknown") : String(v);
      if (!visited.includes(stateName)) visited.push(stateName);
    });

    actor.start();
    actor.send({ type: "START", prompt: "find bounds", apiKey: "test", workspaceDir: "/tmp", outputDir: "/tmp/test", publishableMode: false });

    await waitForFinal(actor);

    const ctx = actor.getSnapshot().context;
    expect(ctx.proofStatus).toBe("PROVED");
    expect(visited).toContain("Ideation");
    expect(visited).toContain("Validation");
    expect(visited).toContain("EmpiricalSandbox");
    expect(visited).toContain("FormalVerification");
    expect(visited).toContain("ScribeReport");
    expect(visited).toContain("Done");
  });

  it("exits gracefully after 3 KNOWN_THEOREM classifications", async () => {
    let callCount = 0;
    const testMachine = researchMachine.provide({
      actors: {
        ideationActor: fromPromise<IdeationOutput, any>(async () => {
          callCount++;
          return KNOWN_IDEATION;
        }),
      },
    });

    const actor = createActor(testMachine);
    actor.start();
    actor.send({ type: "START", prompt: "known theorem", apiKey: "test", workspaceDir: "/tmp", outputDir: "/tmp/test", publishableMode: false });

    await waitForFinal(actor);

    const ctx = actor.getSnapshot().context;
    expect(ctx.ideationRetries).toBe(3);
    expect(actor.getSnapshot().value).toBe("ExitGracefully");
    expect(callCount).toBe(3);
  });

  it("loops Validation → Ideation on HALLUCINATION_DETECTED, incrementing retries", async () => {
    let ideationCalls = 0;
    let validationCalls = 0;

    const testMachine = researchMachine.provide({
      actors: {
        ideationActor: fromPromise<IdeationOutput, any>(async () => {
          ideationCalls++;
          return NOVEL_IDEATION;
        }),
        validationActor: fromPromise<ValidationOutput, any>(async () => {
          validationCalls++;
          if (validationCalls <= 2) {
            throw new Error("HALLUCINATION_DETECTED: synthetic def");
          }
          return { isValid: true as const, ast: { validated: true } };
        }),
        sandboxActor: mockSandbox(WITNESS_SANDBOX),
        leanVerificationActor: mockLeanVerification(PROOF_COMPLETE),
        tacticGeneratorActor: mockTacticGenerator(),
        scribeActor: mockScribe(SCRIBE_DONE),
      },
    });

    const actor = createActor(testMachine);
    actor.start();
    actor.send({ type: "START", prompt: "hallucinating LLM", apiKey: "test", workspaceDir: "/tmp", outputDir: "/tmp/test", publishableMode: false });

    await waitForFinal(actor);

    // Should have called ideation 3 times (initial + 2 hallucination retries)
    expect(ideationCalls).toBe(3);
    expect(validationCalls).toBe(3);
    // Retries were incremented twice, then reset on success path
    expect(actor.getSnapshot().context.ideationRetries).toBe(2);
  });

  it("routes SA plateau through SMT_Resolution(SAT) to FormalVerification", async () => {
    const visited: string[] = [];

    const testMachine = researchMachine.provide({
      actors: {
        ideationActor: mockIdeation(NOVEL_IDEATION),
        validationActor: mockValidation(true),
        sandboxActor: mockSandbox(PLATEAU_SANDBOX),
        smtActor: mockSMT({ status: "SAT", model: "e_0_1=true" }),
        leanVerificationActor: mockLeanVerification(PROOF_COMPLETE),
        tacticGeneratorActor: mockTacticGenerator(),
        scribeActor: mockScribe(SCRIBE_DONE),
      },
    });

    const actor = createActor(testMachine);
    actor.subscribe((s) => {
      const v = s.value;
      const stateName = typeof v === "object" && v !== null ? (Object.keys(v)[0] || "unknown") : String(v);
      if (!visited.includes(stateName)) visited.push(stateName);
    });

    actor.start();
    actor.send({ type: "START", prompt: "plateau test", apiKey: "test", workspaceDir: "/tmp", outputDir: "/tmp/test", publishableMode: false });

    await waitForFinal(actor);

    expect(visited).toContain("EmpiricalSandbox");
    expect(visited).toContain("SMT_Resolution");
    expect(visited).toContain("FormalVerification");
    expect(actor.getSnapshot().context.smtModel).toBe("e_0_1=true");
  });

  it("routes CLEAN_KILL through HypothesisRefinement back out to Validation", async () => {
    let refinementCalls = 0;
    let validationCalls = 0;
    const visited: string[] = [];

    const testMachine = researchMachine.provide({
      actors: {
        ideationActor: mockIdeation(NOVEL_IDEATION),
        validationActor: fromPromise<ValidationOutput, any>(async () => {
          validationCalls++;
          return { isValid: true as const, ast: { validated: true } };
        }),
        sandboxActor: fromPromise<SandboxOutput, any>(async () => {
          if (refinementCalls === 0) return CLEAN_KILL_SANDBOX;
          return WITNESS_SANDBOX; // succeed after first refinement
        }),
        refinementActor: fromPromise<RefinementOutput, any>(async () => {
          refinementCalls++;
          return {
            hypothesis: "theorem bounded : 1 + 1 = 2",
            classification: "NOVEL_DISCOVERY",
            plan: NOVEL_IDEATION.plan
          };
        }),
        leanVerificationActor: mockLeanVerification(PROOF_COMPLETE),
        tacticGeneratorActor: mockTacticGenerator(),
        scribeActor: mockScribe(SCRIBE_DONE),
      },
    });

    const actor = createActor(testMachine);
    actor.subscribe((s) => {
      const v = s.value;
      const stateName = typeof v === "object" && v !== null ? (Object.keys(v)[0] || "unknown") : String(v);
      if (!visited.includes(stateName)) visited.push(stateName);
    });

    actor.start();
    actor.send({ type: "START", prompt: "refinement test", apiKey: "test", workspaceDir: "/tmp", outputDir: "/tmp/test", publishableMode: false });

    await waitForFinal(actor);

    expect(refinementCalls).toBe(1);
    expect(validationCalls).toBe(2);
    expect(visited).toContain("EmpiricalSandbox");
    expect(visited).toContain("HypothesisRefinement");
    expect(visited).toContain("Validation");
    expect(visited).toContain("FormalVerification");
  });

  it("exits gracefully to ScribeReport after 3 refinements fail", async () => {
    let refinementCalls = 0;
    let validationCalls = 0;

    const testMachine = researchMachine.provide({
      actors: {
        ideationActor: mockIdeation(NOVEL_IDEATION),
        validationActor: fromPromise<ValidationOutput, any>(async () => {
          validationCalls++;
          return { isValid: true as const, ast: { validated: true } };
        }),
        sandboxActor: mockSandbox(CLEAN_KILL_SANDBOX), // always fails
        refinementActor: fromPromise<RefinementOutput, any>(async () => {
          refinementCalls++;
          return {
            hypothesis: `ver_${refinementCalls}`,
            classification: "NOVEL_DISCOVERY",
            plan: NOVEL_IDEATION.plan
          };
        }),
        leanVerificationActor: mockLeanVerification(PROOF_COMPLETE),
        tacticGeneratorActor: mockTacticGenerator(),
        scribeActor: mockScribe(SCRIBE_DONE),
      },
    });

    const actor = createActor(testMachine);
    
    actor.start();
    actor.send({ type: "START", prompt: "limit test", apiKey: "test", workspaceDir: "/tmp", outputDir: "/tmp/test", publishableMode: false });

    await waitForFinal(actor);

    // It will be called exactly 3 times, loop back to validation 3 times, fail sandbox 3 times.
    // The 3rd failure enters HypothesisRefinement, fails guard, jumps to ScribeReport.
    expect(refinementCalls).toBe(3);
    const ctx = actor.getSnapshot().context;
    expect(ctx.refinementRetries).toBe(3);
    expect(actor.getSnapshot().value).toBe("Done"); // Reaches done via ScribeReport
  });

  it("exhausts FormalVerification loop after 15 retries and reaches Done via ScribeReport", async () => {
    let leanCalls = 0;

    const testMachine = researchMachine.provide({
      actors: {
        ideationActor: mockIdeation(NOVEL_IDEATION),
        validationActor: mockValidation(true),
        sandboxActor: mockSandbox(WITNESS_SANDBOX),
        leanVerificationActor: fromPromise<any, any>(async () => {
          leanCalls++;
          return COMPILER_ERROR; // triggers another Inference loop
        }),
        tacticGeneratorActor: mockTacticGenerator(),
        scribeActor: mockScribe(SCRIBE_DONE),
      },
    });

    const actor = createActor(testMachine);
    actor.start();
    actor.send({ type: "START", prompt: "exhaustion test", apiKey: "test", workspaceDir: "/tmp", outputDir: "/tmp/test", publishableMode: false });

    await waitForFinal(actor);

    // Initial inference creates 1 loop. Then fails 15 times before Exhaustion catches it.
    expect(actor.getSnapshot().value).toBe("Done");
    expect(leanCalls).toBe(15);
  });

  it("routes SMT UNSAT back to EmpiricalSandbox", async () => {
    let sandboxCalls = 0;
    const visited: string[] = [];

    const testMachine = researchMachine.provide({
      actors: {
        ideationActor: mockIdeation(NOVEL_IDEATION),
        validationActor: mockValidation(true),
        sandboxActor: fromPromise<SandboxOutput, any>(async () => {
          sandboxCalls++;
          if (sandboxCalls === 1) return PLATEAU_SANDBOX;
          // Second call: witness found (break the loop)
          return WITNESS_SANDBOX;
        }),
        smtActor: mockSMT({ status: "UNSAT", model: null }),
        leanVerificationActor: mockLeanVerification(PROOF_COMPLETE),
        tacticGeneratorActor: mockTacticGenerator(),
        scribeActor: mockScribe(SCRIBE_DONE),
      },
    });

    const actor = createActor(testMachine);
    actor.subscribe((s) => {
      const v = s.value as string;
      if (!visited.includes(v)) visited.push(v);
    });

    actor.start();
    actor.send({ type: "START", prompt: "smt unsat test", apiKey: "test", workspaceDir: "/tmp", outputDir: "/tmp/test", publishableMode: false });

    await waitForFinal(actor);

    expect(sandboxCalls).toBe(2);
    expect(visited).toContain("SMT_Resolution");
    // Should have looped back to sandbox after UNSAT
    expect(actor.getSnapshot().context.proofStatus).toBe("PROVED");
  });
});
