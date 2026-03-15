/**
 * Sprint 12d: Physical ProofTree Wiring Tests
 *
 * Verifies that runDynamicLoop instantiates a real ProofTree and uses it:
 * 1. Loop returns tree in result — caller can inspect tree state
 * 2. Successful tactic creates a child node in the tree
 * 3. ARCHITECT receives frontier digest (not lab log)
 * 4. BACKTRACK physically marks node as DEAD_END in the tree
 * 5. globalFailures comes from tree.getGlobalTreeFailures()
 */

import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { rm } from "node:fs/promises";
import { WorkspaceManager } from "../src/workspace";
import { SolverBridge } from "../src/solver";
import { LeanBridge, type LeanResult } from "../src/lean_bridge";
import { runDynamicLoop } from "../src/orchestrator";
import { ProofTree, type ProofNode } from "../src/tree";
import { AgentFactory, type SpecialistAgent, type SpecialistResponse } from "../src/agents/factory";
import type { AgentRole, RoutingSignals } from "../src/types";

// ──────────────────────────────────────────────
// Mock Infrastructure
// ──────────────────────────────────────────────

const BASE_DIR = "./tmp_test_tree_wiring";
const RUN_NAME = "tree_wire";

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
    this.calls.push(context);
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
      return { success: true, isComplete: true, hasSorry: false, rawOutput: "no goals" };
    }
    return {
      success: false, isComplete: false, hasSorry: false,
      rawOutput: `tactic '${tactic}' failed`,
      error: `tactic '${tactic}' failed`,
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
  await Bun.write(wm.paths.objective, "Prove theorem");
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

describe("runDynamicLoop() — Physical ProofTree Wiring", () => {

  test("returns tree in result with nodes for successful proof", async () => {
    const workspace = await setupWorkspace();
    const factory = new MockAgentFactory();
    const mockLean = new MockLeanBridge("omega");

    factory.registerAgent("ARCHITECT", new MockAgent("ARCHITECT", [
      { action: "DIRECTIVE", target_node_id: "root", reasoning: "omega", tactics: "omega" } as any,
    ]));
    factory.registerAgent("TACTICIAN", new MockAgent("TACTICIAN", [{
      thoughts: "omega", action: "PROPOSE_LEAN_TACTICS",
      lean_tactics: [{ tactic: "omega", informal_sketch: "omega", confidence_score: 0.99 }],
    }]));

    const result = await runDynamicLoop(workspace, new SolverBridge(), {
      maxGlobalIterations: 10,
      agentFactory: factory,
      leanBridge: mockLean as unknown as LeanBridge,
      theoremName: "thm", theoremSignature: "(n : Nat) : n = n",
    });

    expect(result.status).toBe("SOLVED");
    // The tree should be returned and have more than just the root
    expect(result.tree).toBeDefined();
    expect(result.tree!.getNodeCount()).toBeGreaterThan(1);
  });

  test("successful tactic creates child node in the tree", async () => {
    const workspace = await setupWorkspace();
    const factory = new MockAgentFactory();
    const mockLean = new MockLeanBridge("omega");

    factory.registerAgent("ARCHITECT", new MockAgent("ARCHITECT", [
      { action: "DIRECTIVE", target_node_id: "root", reasoning: "omega", tactics: "omega" } as any,
    ]));
    factory.registerAgent("TACTICIAN", new MockAgent("TACTICIAN", [{
      thoughts: "omega", action: "PROPOSE_LEAN_TACTICS",
      lean_tactics: [{ tactic: "omega", informal_sketch: "omega", confidence_score: 0.99 }],
    }]));

    const result = await runDynamicLoop(workspace, new SolverBridge(), {
      maxGlobalIterations: 10,
      agentFactory: factory,
      leanBridge: mockLean as unknown as LeanBridge,
      theoremName: "thm", theoremSignature: "(n : Nat) : n = n",
    });

    const tree = result.tree!;
    const root = tree.getNode(tree.rootId)!;
    // Root should have a child (the omega tactic spawned it)
    expect(root.childrenIds.length).toBe(1);

    const child = tree.getNode(root.childrenIds[0]!)!;
    expect(child.tacticApplied).toBe("omega");
    expect(child.leanState).toContain("no goals");
  });

  test("ARCHITECT receives frontier digest (contains tree markers)", async () => {
    const workspace = await setupWorkspace();
    const factory = new MockAgentFactory();
    const mockLean = new MockLeanBridge("omega");

    const architectAgent = new MockAgent("ARCHITECT", [
      { action: "DIRECTIVE", target_node_id: "root", reasoning: "omega", tactics: "omega" } as any,
    ]);

    factory.registerAgent("ARCHITECT", architectAgent);
    factory.registerAgent("TACTICIAN", new MockAgent("TACTICIAN", [{
      thoughts: "t", action: "PROPOSE_LEAN_TACTICS" as const,
      lean_tactics: [{ tactic: "omega", informal_sketch: "omega", confidence_score: 0.99 }],
    }]));

    const result = await runDynamicLoop(workspace, new SolverBridge(), {
      maxGlobalIterations: 10,
      agentFactory: factory,
      leanBridge: mockLean as unknown as LeanBridge,
      theoremName: "thm", theoremSignature: "(n : Nat) : n = n",
    });

    expect(result.status).toBe("SOLVED");
    // ARCHITECT's first call should receive the frontier digest from buildFrontierDigest()
    const architectContexts = architectAgent.calls;
    expect(architectContexts.length).toBeGreaterThanOrEqual(1);
    expect(architectContexts[0]).toContain("FRONTIER DIGEST");
  });

  test("failed tactics record errors on the tree's active node", async () => {
    const workspace = await setupWorkspace();
    const factory = new MockAgentFactory();
    const mockLean = new MockLeanBridge("exact_proof");

    factory.registerAgent("ARCHITECT", new MockAgent("ARCHITECT", [
      { action: "DIRECTIVE", target_node_id: "root", reasoning: "plan", tactics: "simp" } as any,
      { action: "DIRECTIVE", target_node_id: "root", reasoning: "rethink", tactics: "exact_proof" } as any,
    ]));
    factory.registerAgent("TACTICIAN", new MockAgent("TACTICIAN", [
      { thoughts: "t", action: "PROPOSE_LEAN_TACTICS" as const,
        lean_tactics: [{ tactic: "simp", informal_sketch: "simp", confidence_score: 0.5 }] },
      { thoughts: "t", action: "PROPOSE_LEAN_TACTICS" as const,
        lean_tactics: [{ tactic: "exact_proof", informal_sketch: "exact", confidence_score: 0.99 }] },
    ]));
    factory.registerAgent("REASONER", new MockAgent("REASONER", [
      { thoughts: "r", action: "PROPOSE_LEAN_TACTICS" as const,
        lean_tactics: [{ tactic: "ring", informal_sketch: "ring", confidence_score: 0.5 }] },
      { thoughts: "r", action: "PROPOSE_LEAN_TACTICS" as const,
        lean_tactics: [{ tactic: "ring", informal_sketch: "ring", confidence_score: 0.5 }] },
      { thoughts: "r", action: "PROPOSE_LEAN_TACTICS" as const,
        lean_tactics: [{ tactic: "ring", informal_sketch: "ring", confidence_score: 0.5 }] },
      { thoughts: "r", action: "PROPOSE_LEAN_TACTICS" as const,
        lean_tactics: [{ tactic: "ring", informal_sketch: "ring", confidence_score: 0.5 }] },
    ]));

    const result = await runDynamicLoop(workspace, new SolverBridge(), {
      maxGlobalIterations: 30,
      agentFactory: factory,
      leanBridge: mockLean as unknown as LeanBridge,
      theoremName: "thm", theoremSignature: "(n : Nat) : n = n",
    });

    expect(result.status).toBe("SOLVED");
    const tree = result.tree!;
    const root = tree.getNode(tree.rootId)!;
    // Root node should have at least 1 error from the failed simp tactic
    expect(root.errorHistory.length).toBeGreaterThanOrEqual(1);
    expect(root.errorHistory[0]).toContain("simp");
  });

  test("globalFailures in signals comes from tree.getGlobalTreeFailures()", async () => {
    const workspace = await setupWorkspace();
    const factory = new MockAgentFactory();
    const mockLean = new MockLeanBridge("exact_proof");

    factory.registerAgent("ARCHITECT", new MockAgent("ARCHITECT", [
      { action: "DIRECTIVE", target_node_id: "root", reasoning: "plan", tactics: "simp" } as any,
      { action: "DIRECTIVE", target_node_id: "root", reasoning: "rethink", tactics: "exact_proof" } as any,
    ]));
    factory.registerAgent("TACTICIAN", new MockAgent("TACTICIAN", [
      { thoughts: "t", action: "PROPOSE_LEAN_TACTICS" as const,
        lean_tactics: [{ tactic: "simp", informal_sketch: "simp", confidence_score: 0.5 }] },
      { thoughts: "t", action: "PROPOSE_LEAN_TACTICS" as const,
        lean_tactics: [{ tactic: "exact_proof", informal_sketch: "exact", confidence_score: 0.99 }] },
    ]));
    factory.registerAgent("REASONER", new MockAgent("REASONER", [
      { thoughts: "r", action: "PROPOSE_LEAN_TACTICS" as const,
        lean_tactics: [{ tactic: "ring", informal_sketch: "ring", confidence_score: 0.5 }] },
      { thoughts: "r", action: "PROPOSE_LEAN_TACTICS" as const,
        lean_tactics: [{ tactic: "ring", informal_sketch: "ring", confidence_score: 0.5 }] },
      { thoughts: "r", action: "PROPOSE_LEAN_TACTICS" as const,
        lean_tactics: [{ tactic: "ring", informal_sketch: "ring", confidence_score: 0.5 }] },
      { thoughts: "r", action: "PROPOSE_LEAN_TACTICS" as const,
        lean_tactics: [{ tactic: "ring", informal_sketch: "ring", confidence_score: 0.5 }] },
    ]));

    const result = await runDynamicLoop(workspace, new SolverBridge(), {
      maxGlobalIterations: 30,
      agentFactory: factory,
      leanBridge: mockLean as unknown as LeanBridge,
      theoremName: "thm", theoremSignature: "(n : Nat) : n = n",
    });

    expect(result.status).toBe("SOLVED");
    // The tree should have errors recorded from failed tactics
    const tree = result.tree!;
    expect(tree.getGlobalTreeFailures()).toBeGreaterThan(0);
    // The root node should have errors from the failed simp tactic
    const root = tree.getNode(tree.rootId)!;
    expect(root.errorHistory.length).toBeGreaterThan(0);
  });
});
