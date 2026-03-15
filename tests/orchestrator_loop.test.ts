/**
 * Sprint 9: Dynamic Orchestrator Loop Tests (TDD — RED first)
 *
 * Tests that runDynamicLoop() correctly routes between specialists
 * based on telemetry signals, using mock agents.
 *
 * Mock strategy: We create a MockAgentFactory that returns canned
 * SpecialistAgent implementations. Each mock records its calls
 * so we can verify routing decisions.
 */

import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { WorkspaceManager } from "../src/workspace";
import { SolverBridge } from "../src/solver";
import { LeanBridge } from "../src/lean_bridge";
import { runDynamicLoop } from "../src/orchestrator";
import { AgentFactory, type SpecialistAgent, type SpecialistResponse } from "../src/agents/factory";
import type { AgentRole, RoutingSignals } from "../src/types";
import type { FormalistResponse, ArchitectResponse } from "../src/schemas";

// ──────────────────────────────────────────────
// Mock Infrastructure
// ──────────────────────────────────────────────

/** Record of which agent was requested and with what signals */
interface AgentRequest {
  role: AgentRole;
  consecutiveFailures: number;
}

/** A mock agent that returns a canned response and logs its calls */
class MockAgent implements SpecialistAgent {
  readonly role: AgentRole;
  private responses: SpecialistResponse[];
  private callIndex = 0;
  calls: string[] = [];

  constructor(role: AgentRole, responses: SpecialistResponse[]) {
    this.role = role;
    this.responses = responses;
  }

  async generateMove(context: string): Promise<SpecialistResponse> {
    this.calls.push(context.slice(0, 100));
    const resp = this.responses[this.callIndex] ?? this.responses[this.responses.length - 1]!;
    this.callIndex++;
    return resp;
  }
}

/**
 * A mock factory that returns pre-configured mock agents
 * and records every getAgent() call for assertion.
 */
class MockAgentFactory extends AgentFactory {
  agentRequests: AgentRequest[] = [];
  private agents: Map<string, MockAgent> = new Map();

  registerAgent(role: AgentRole, agent: MockAgent): void {
    this.agents.set(role, agent);
  }

  override getAgent(role: AgentRole, signals: RoutingSignals): SpecialistAgent {
    this.agentRequests.push({ role, consecutiveFailures: signals.consecutiveFailures });
    const agent = this.agents.get(role);
    if (!agent) throw new Error(`No mock registered for role: ${role}`);
    return agent;
  }
}

// ──────────────────────────────────────────────
// Canned Responses
// ──────────────────────────────────────────────

/** Architect returns a proof plan directive */
function architectDirectiveResponse(): ArchitectResponse {
  return {
    analysis: "Initial theorem decomposition. Try induction on n.",
    steps_to_backtrack: 0,
    new_directive: "Use induction on n. Base case: simp. Inductive step: use induction hypothesis.",
  };
}

/** Tactician returns a successful Lean tactic */
function tacticianSuccessResponse(): FormalistResponse {
  return {
    thoughts: "Applying omega tactic for arithmetic.",
    action: "PROPOSE_LEAN_TACTICS",
    lean_tactics: [{
      tactic: "omega",
      informal_sketch: "Linear arithmetic decision procedure",
      confidence_score: 0.95,
    }],
  };
}

/** Tactician returns a failing Lean tactic */
function tacticianFailResponse(msg: string = "Trying simp"): FormalistResponse {
  return {
    thoughts: msg,
    action: "PROPOSE_LEAN_TACTICS",
    lean_tactics: [{
      tactic: "simp",
      informal_sketch: msg,
      confidence_score: 0.5,
    }],
  };
}

/** Reasoner analyzes and returns a better tactic */
function reasonerResponse(): FormalistResponse {
  return {
    thoughts: "After analyzing failures, the issue is that simp cannot handle this. Need omega.",
    action: "PROPOSE_LEAN_TACTICS",
    lean_tactics: [{
      tactic: "omega",
      informal_sketch: "Switching to omega after simp failures",
      confidence_score: 0.9,
    }],
  };
}

// ──────────────────────────────────────────────
// Test Setup
// ──────────────────────────────────────────────

const BASE_DIR = "./tmp_test_dynamic_loop";
const RUN_NAME = "dynamic_test";

async function setupWorkspace(): Promise<WorkspaceManager> {
  await rm(BASE_DIR, { recursive: true, force: true });
  const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
  await wm.init();

  const gc = join(BASE_DIR, "global_config");
  await mkdir(gc, { recursive: true });
  await Bun.write(join(gc, "system_prompts.md"), "You are a Lean prover.");
  await Bun.write(join(gc, "general_skills.md"), "Use tactics.");
  await Bun.write(join(gc, "config.json"), "{}");
  await Bun.write(join(BASE_DIR, "runs", RUN_NAME, "objective.md"), "Prove n + 1 > n");

  return wm;
}

/** Mock LeanBridge that returns canned results */
class MockLeanBridge {
  private succeedOnTactic?: string;
  results: { theorem: string; tactics: string[] }[] = [];

  constructor(succeedOnTactic?: string) {
    this.succeedOnTactic = succeedOnTactic;
  }

  async checkProof(
    theoremName: string,
    theoremSignature: string,
    tactics: string[],
    _timeoutMs?: number,
  ) {
    this.results.push({ theorem: theoremName, tactics });
    const success = this.succeedOnTactic
      ? tactics.includes(this.succeedOnTactic)
      : false;
    return {
      isComplete: success,
      rawOutput: success ? "no errors" : "tactic 'simp' failed",
      error: success ? undefined : "tactic failed",
      diagnostics: [],
    };
  }

  buildLeanSource(name: string, sig: string, tactics: string[]): string {
    return `theorem ${name} ${sig} := by\n  ${tactics.join("\n  ")}`;
  }
}

afterAll(async () => {
  await rm(BASE_DIR, { recursive: true, force: true });
});

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("runDynamicLoop()", () => {

  test("Happy path: ARCHITECT on turn 1 → TACTICIAN on turn 2 → SOLVED", async () => {
    const workspace = await setupWorkspace();
    const solver = new SolverBridge();
    const mockLean = new MockLeanBridge("omega"); // omega succeeds

    const factory = new MockAgentFactory();
    const architectAgent = new MockAgent("ARCHITECT", [architectDirectiveResponse()]);
    const tacticianAgent = new MockAgent("TACTICIAN", [tacticianSuccessResponse()]);
    factory.registerAgent("ARCHITECT", architectAgent);
    factory.registerAgent("TACTICIAN", tacticianAgent);

    const result = await runDynamicLoop(workspace, solver, {
      maxGlobalIterations: 10,
      agentFactory: factory,
      leanBridge: mockLean as unknown as LeanBridge,
      theoremName: "nat_succ_gt",
      theoremSignature: "(n : Nat) : n + 1 > n",
    });

    // Verify routing decisions
    expect(factory.agentRequests.length).toBeGreaterThanOrEqual(2);
    expect(factory.agentRequests[0]!.role).toBe("ARCHITECT"); // Turn 1: initial plan
    expect(factory.agentRequests[1]!.role).toBe("TACTICIAN"); // Turn 2: execute

    // Verify result
    expect(result.status).toBe("SOLVED");
  });

  test("Escalation: TACTICIAN failures + stuck-in-loop → REASONER", async () => {
    const workspace = await setupWorkspace();
    const solver = new SolverBridge();
    const mockLean = new MockLeanBridge("omega"); // only omega succeeds

    const factory = new MockAgentFactory();
    const architectAgent = new MockAgent("ARCHITECT", [architectDirectiveResponse()]);
    const tacticianAgent = new MockAgent("TACTICIAN", [
      tacticianFailResponse("Try 1"),
      tacticianFailResponse("Try 2"),
    ]);
    const reasonerAgent = new MockAgent("REASONER", [reasonerResponse()]);
    factory.registerAgent("ARCHITECT", architectAgent);
    factory.registerAgent("TACTICIAN", tacticianAgent);
    factory.registerAgent("REASONER", reasonerAgent);

    const result = await runDynamicLoop(workspace, solver, {
      maxGlobalIterations: 10,
      agentFactory: factory,
      leanBridge: mockLean as unknown as LeanBridge,
      theoremName: "nat_succ_gt",
      theoremSignature: "(n : Nat) : n + 1 > n",
    });

    // Routing: ARCHITECT → TACTICIAN (×2 fail, same error = stuck-in-loop) → REASONER
    const roles = factory.agentRequests.map(r => r.role);
    expect(roles[0]).toBe("ARCHITECT");    // Turn 1: plan
    expect(roles[1]).toBe("TACTICIAN");    // Turn 2: fail
    expect(roles[2]).toBe("TACTICIAN");    // Turn 3: fail (same error → stuck)
    // Stuck-in-loop triggers REASONER even with < 3 consecutive failures
    expect(roles[3]).toBe("REASONER");     // Turn 4: reasoner unblocks

    expect(result.status).toBe("SOLVED");
  });

  test("Catastrophic: 6+ failures → ARCHITECT PRO tier", async () => {
    const workspace = await setupWorkspace();
    const solver = new SolverBridge();
    // Use a mock that only succeeds on a very specific tactic
    const mockLean = new MockLeanBridge("exact_proof_qed");

    const factory = new MockAgentFactory();
    const architectAgent = new MockAgent("ARCHITECT", [
      architectDirectiveResponse(),  // Initial plan (Flash)
      architectDirectiveResponse(),  // Catastrophic rethink (Pro)
    ]);
    // After rethink, the Tactician must succeed
    const tacticianAgent = new MockAgent("TACTICIAN", [
      // First batch: 2 unique failures before stuck-in-loop triggers REASONER
      { thoughts: "try1", action: "PROPOSE_LEAN_TACTICS" as const, lean_tactics: [{ tactic: "ring", informal_sketch: "try ring", confidence_score: 0.5 }] },
      { thoughts: "try2", action: "PROPOSE_LEAN_TACTICS" as const, lean_tactics: [{ tactic: "norm_num", informal_sketch: "try norm_num", confidence_score: 0.5 }] },
      // After Pro rethink, success:
      { thoughts: "final", action: "PROPOSE_LEAN_TACTICS" as const, lean_tactics: [{ tactic: "exact_proof_qed", informal_sketch: "exact proof", confidence_score: 0.99 }] },
    ]);
    // Reasoner also fails — needs to accumulate to 6 total consecutive failures
    const reasonerAgent = new MockAgent("REASONER", [
      { thoughts: "r1", action: "PROPOSE_LEAN_TACTICS" as const, lean_tactics: [{ tactic: "simp_all", informal_sketch: "try simp_all", confidence_score: 0.6 }] },
      { thoughts: "r2", action: "PROPOSE_LEAN_TACTICS" as const, lean_tactics: [{ tactic: "linarith", informal_sketch: "try linarith", confidence_score: 0.6 }] },
      { thoughts: "r3", action: "PROPOSE_LEAN_TACTICS" as const, lean_tactics: [{ tactic: "decide", informal_sketch: "try decide", confidence_score: 0.6 }] },
      { thoughts: "r4", action: "PROPOSE_LEAN_TACTICS" as const, lean_tactics: [{ tactic: "aesop", informal_sketch: "try aesop", confidence_score: 0.6 }] },
      { thoughts: "r5", action: "PROPOSE_LEAN_TACTICS" as const, lean_tactics: [{ tactic: "tauto", informal_sketch: "try tauto", confidence_score: 0.6 }] },
    ]);
    factory.registerAgent("ARCHITECT", architectAgent);
    factory.registerAgent("TACTICIAN", tacticianAgent);
    factory.registerAgent("REASONER", reasonerAgent);

    const result = await runDynamicLoop(workspace, solver, {
      maxGlobalIterations: 20,
      agentFactory: factory,
      leanBridge: mockLean as unknown as LeanBridge,
      theoremName: "nat_succ_gt",
      theoremSignature: "(n : Nat) : n + 1 > n",
    });

    // Verify ARCHITECT was called at least twice (second time for structural rethink)
    const architectRequests = factory.agentRequests.filter(r => r.role === "ARCHITECT");
    expect(architectRequests.length).toBeGreaterThanOrEqual(2);

    expect(result.status).toBe("SOLVED");
  });
});
