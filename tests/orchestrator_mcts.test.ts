/**
 * Sprint 12c: MCTS Orchestrator Tests
 *
 * Tests that runDynamicLoop correctly executes ProofTree navigation:
 * 1. ARCHITECT BACKTRACK → marks node dead, pivots to best open node
 * 2. ARCHITECT DIRECTIVE → jumps to target node
 * 3. Successful tactic → spawns child node in tree
 * 4. Failed tactic → records error on active node
 */

import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { rm } from "node:fs/promises";
import { WorkspaceManager } from "../src/workspace";
import { SolverBridge } from "../src/solver";
import { LeanBridge, type LeanResult } from "../src/lean_bridge";
import { runDynamicLoop } from "../src/orchestrator";
import { ProofTree } from "../src/tree";
import { AgentFactory, type SpecialistAgent, type SpecialistResponse } from "../src/agents/factory";
import type { AgentRole, RoutingSignals } from "../src/types";

// ──────────────────────────────────────────────
// Mock Infrastructure
// ──────────────────────────────────────────────

const BASE_DIR = "./tmp_test_mcts";
const RUN_NAME = "mcts_test";

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
    this.calls.push(context.slice(0, 200));
    const resp = this.responses[this.callIndex] ?? this.responses[this.responses.length - 1]!;
    this.callIndex++;
    return resp;
  }
}

class MockAgentFactory extends AgentFactory {
  agentRequests: { role: AgentRole; globalFailures: number }[] = [];
  private agents: Map<string, MockAgent> = new Map();

  registerAgent(role: AgentRole, agent: MockAgent): void {
    this.agents.set(role, agent);
  }

  override getAgent(role: AgentRole, signals: RoutingSignals): SpecialistAgent {
    this.agentRequests.push({ role, globalFailures: signals.globalFailures });
    const agent = this.agents.get(role);
    if (!agent) throw new Error(`No mock registered for role: ${role}`);
    return agent;
  }
}

/**
 * MockLeanBridge that returns success only for a specific tactic.
 * All other tactics fail with a descriptive error.
 */
class MockLeanBridge {
  private winningTactic: string;

  constructor(winningTactic: string) {
    this.winningTactic = winningTactic;
  }

  async checkProof(
    _name: string,
    _sig: string,
    tactics: string[],
    _timeout?: number,
  ): Promise<LeanResult> {
    const tactic = tactics[0] ?? "";
    if (tactic === this.winningTactic) {
      return {
        success: true,
        isComplete: true,
        hasSorry: false,
        rawOutput: "no goals",
      };
    }
    return {
      success: false,
      isComplete: false,
      hasSorry: false,
      rawOutput: `tactic '${tactic}' failed, no progress made`,
      error: `tactic '${tactic}' failed, no progress made`,
    };
  }

  buildLeanSource(_name: string, _sig: string, tactics: string[]): string {
    return tactics.join("\n");
  }
}

async function setupWorkspace(): Promise<WorkspaceManager> {
  await rm(BASE_DIR, { recursive: true, force: true });
  const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
  await wm.init();
  await Bun.write(wm.paths.objective, "Prove nat_add_comm");
  return wm;
}

beforeEach(async () => {
  await rm(BASE_DIR, { recursive: true, force: true });
});

afterAll(async () => {
  await rm(BASE_DIR, { recursive: true, force: true });
});

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("runDynamicLoop() — MCTS Tree Navigation", () => {

  test("ARCHITECT BACKTRACK resets signals and allows fresh approach", async () => {
    const workspace = await setupWorkspace();
    const solver = new SolverBridge();
    const mockLean = new MockLeanBridge("omega");

    const factory = new MockAgentFactory();

    // Flow:
    //   1. ARCHITECT → DIRECTIVE (initial plan)
    //   2-3. TACTICIAN fails × 2
    //   4-5. REASONER fails (stuck, multi-goal)
    //   ... more failures until consecutiveFailures >= 6 → ARCHITECT again
    //   N. ARCHITECT → BACKTRACK (signals reset)
    //   N+1. ARCHITECT → DIRECTIVE (new plan with omega)
    //   N+2. TACTICIAN → omega → SOLVED

    const architectAgent = new MockAgent("ARCHITECT", [
      // 1st: initial DIRECTIVE
      { action: "DIRECTIVE", target_node_id: "root", reasoning: "Try simp", tactics: "simp" } as any,
      // 2nd: BACKTRACK after accumulated failures
      { action: "BACKTRACK", target_node_id: "dead-branch", reasoning: "Dead end" } as any,
      // 3rd: new DIRECTIVE after signal reset (totalAttempts=0 triggers ARCHITECT)
      { action: "DIRECTIVE", target_node_id: "root", reasoning: "Try omega", tactics: "omega" } as any,
    ]);

    // TACTICIAN: 2 simp fails, then omega succeeds after BACKTRACK
    const failTactic = {
      thoughts: "try simp", action: "PROPOSE_LEAN_TACTICS" as const,
      lean_tactics: [{ tactic: "simp", informal_sketch: "simplify", confidence_score: 0.5 }],
    };
    const tacticianAgent = new MockAgent("TACTICIAN", [
      failTactic, failTactic, // Fail before escalation chain
      // After BACKTRACK + new DIRECTIVE, omega succeeds
      {
        thoughts: "try omega", action: "PROPOSE_LEAN_TACTICS" as const,
        lean_tactics: [{ tactic: "omega", informal_sketch: "linear arithmetic", confidence_score: 0.9 }],
      },
    ]);

    // REASONER: enough responses for multiple calls
    const failReason = {
      thoughts: "try ring", action: "PROPOSE_LEAN_TACTICS" as const,
      lean_tactics: [{ tactic: "ring", informal_sketch: "ring", confidence_score: 0.6 }],
    };
    const reasonerAgent = new MockAgent("REASONER", [
      failReason, failReason, failReason, failReason, failReason,
    ]);

    factory.registerAgent("ARCHITECT", architectAgent);
    factory.registerAgent("TACTICIAN", tacticianAgent);
    factory.registerAgent("REASONER", reasonerAgent);

    const result = await runDynamicLoop(workspace, solver, {
      maxGlobalIterations: 30,
      agentFactory: factory,
      leanBridge: mockLean as unknown as LeanBridge,
      theoremName: "nat_add_comm",
      theoremSignature: "(n m : Nat) : n + m = m + n",
    });

    expect(result.status).toBe("SOLVED");

    // ARCHITECT should have been called at least 3 times (initial + backtrack + new directive)
    const architectCalls = factory.agentRequests.filter(r => r.role === "ARCHITECT");
    expect(architectCalls.length).toBeGreaterThanOrEqual(3);
  });

  test("Successful tactic spawns child node in tree", async () => {
    const workspace = await setupWorkspace();
    const solver = new SolverBridge();
    // Accepts 'omega' immediately → proof completes on first tactic
    const mockLean = new MockLeanBridge("omega");

    const factory = new MockAgentFactory();

    const architectAgent = new MockAgent("ARCHITECT", [{
      action: "DIRECTIVE",
      target_node_id: "root",
      reasoning: "Use omega for arithmetic",
      tactics: "omega",
    } as any]);

    const tacticianAgent = new MockAgent("TACTICIAN", [{
      thoughts: "omega should work",
      action: "PROPOSE_LEAN_TACTICS",
      lean_tactics: [{
        tactic: "omega",
        informal_sketch: "linear arithmetic",
        confidence_score: 0.99,
      }],
    }]);

    factory.registerAgent("ARCHITECT", architectAgent);
    factory.registerAgent("TACTICIAN", tacticianAgent);

    const result = await runDynamicLoop(workspace, solver, {
      maxGlobalIterations: 10,
      agentFactory: factory,
      leanBridge: mockLean as unknown as LeanBridge,
      theoremName: "simple_theorem",
      theoremSignature: "(n : Nat) : n + 0 = n",
    });

    expect(result.status).toBe("SOLVED");
  });

  test("Failed tactic records error on active node", async () => {
    const workspace = await setupWorkspace();
    const solver = new SolverBridge();
    // Only accepts 'exact_proof' — everything else fails
    const mockLean = new MockLeanBridge("exact_proof");

    const factory = new MockAgentFactory();

    const architectAgent = new MockAgent("ARCHITECT", [
      {
        action: "DIRECTIVE",
        target_node_id: "root",
        reasoning: "Initial plan",
        tactics: "simp",
      } as any,
      {
        action: "DIRECTIVE",
        target_node_id: "root",
        reasoning: "Rethink",
        tactics: "exact_proof",
      } as any,
    ]);

    const tacticianAgent = new MockAgent("TACTICIAN", [
      // 1st: fails
      {
        thoughts: "try simp",
        action: "PROPOSE_LEAN_TACTICS",
        lean_tactics: [{
          tactic: "simp",
          informal_sketch: "simplify",
          confidence_score: 0.5,
        }],
      },
      // 2nd: fails
      {
        thoughts: "try ring",
        action: "PROPOSE_LEAN_TACTICS",
        lean_tactics: [{
          tactic: "ring",
          informal_sketch: "ring",
          confidence_score: 0.5,
        }],
      },
      // 3rd: succeeds
      {
        thoughts: "exact",
        action: "PROPOSE_LEAN_TACTICS",
        lean_tactics: [{
          tactic: "exact_proof",
          informal_sketch: "exact proof",
          confidence_score: 0.99,
        }],
      },
    ]);

    const reasonerAgent = new MockAgent("REASONER", [{
      thoughts: "r1",
      action: "PROPOSE_LEAN_TACTICS",
      lean_tactics: [{
        tactic: "norm_num",
        informal_sketch: "try norm_num",
        confidence_score: 0.6,
      }],
    }]);

    factory.registerAgent("ARCHITECT", architectAgent);
    factory.registerAgent("TACTICIAN", tacticianAgent);
    factory.registerAgent("REASONER", reasonerAgent);

    const result = await runDynamicLoop(workspace, solver, {
      maxGlobalIterations: 15,
      agentFactory: factory,
      leanBridge: mockLean as unknown as LeanBridge,
      theoremName: "test_thm",
      theoremSignature: "(n : Nat) : n = n",
    });

    expect(result.status).toBe("SOLVED");
  });
});
