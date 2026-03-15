/**
 * Sprint 13: Orchestrator RAG Integration Tests (TDD RED → GREEN)
 *
 * Verifies that the ARCHITECT receives neural premise matches
 * injected into its context window from the vector database.
 */

import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { rm } from "node:fs/promises";
import { WorkspaceManager } from "../src/workspace";
import { SolverBridge } from "../src/solver";
import { LeanBridge, type LeanResult } from "../src/lean_bridge";
import { runDynamicLoop } from "../src/orchestrator";
import { AgentFactory, type SpecialistAgent, type SpecialistResponse } from "../src/agents/factory";
import type { AgentRole, RoutingSignals } from "../src/types";
import type { LocalEmbedder } from "../src/embeddings/embedder";
import type { VectorDatabase, Premise } from "../src/embeddings/vector_store";

// ──────────────────────────────────────────────
// Mock Infrastructure
// ──────────────────────────────────────────────

const BASE_DIR = "./tmp_test_rag";
const RUN_NAME = "rag_test";

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
  async checkProof(_n: string, _s: string, tactics: string[]): Promise<LeanResult> {
    const t = tactics[0] ?? "";
    if (t === "omega") {
      return { success: true, isComplete: true, hasSorry: false, rawOutput: "no goals" };
    }
    return { success: false, isComplete: false, hasSorry: false, rawOutput: `failed`, error: `failed` };
  }
  buildLeanSource(_n: string, _s: string, tactics: string[]): string {
    return tactics.join("\n");
  }
}

/** Mock embedder that returns a fixed vector */
class MockEmbedder {
  async embed(_text: string): Promise<number[]> {
    return [1.0, 0.0, 0.0];
  }
}

/** Mock vector database that returns canned results */
class MockVectorDatabase {
  searchCalled = false;
  lastQueryVector: number[] = [];

  async initialize(): Promise<void> {}

  async search(queryVector: number[], _k: number): Promise<Omit<Premise, "vector">[]> {
    this.searchCalled = true;
    this.lastQueryVector = queryVector;
    return [
      {
        id: "nat_add_comm",
        theoremSignature: "(n m : Nat) : n + m = m + n",
        successfulTactic: "induction n; simp; ring",
      },
      {
        id: "nat_mul_comm",
        theoremSignature: "(n m : Nat) : n * m = m * n",
        successfulTactic: "induction n; simp [Nat.succ_mul]; ring",
      },
    ];
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

describe("runDynamicLoop() — RAG Premise Injection", () => {

  test("ARCHITECT context contains HISTORICAL PREMISE MATCHES when vectorDb is provided", async () => {
    const workspace = await setupWorkspace();
    const factory = new MockAgentFactory();
    const mockLean = new MockLeanBridge();

    const architectAgent = new MockAgent("ARCHITECT", [
      { action: "DIRECTIVE", target_node_id: "root", reasoning: "omega", tactics: "omega" } as any,
    ]);
    factory.registerAgent("ARCHITECT", architectAgent);
    factory.registerAgent("TACTICIAN", new MockAgent("TACTICIAN", [{
      thoughts: "omega", action: "PROPOSE_LEAN_TACTICS",
      lean_tactics: [{ tactic: "omega", informal_sketch: "omega", confidence_score: 0.99 }],
    }]));

    const mockEmbedder = new MockEmbedder();
    const mockVectorDb = new MockVectorDatabase();

    const result = await runDynamicLoop(workspace, new SolverBridge(), {
      maxGlobalIterations: 10,
      agentFactory: factory,
      leanBridge: mockLean as unknown as LeanBridge,
      theoremName: "thm",
      theoremSignature: "(n : Nat) : n = n",
      embedder: mockEmbedder as unknown as LocalEmbedder,
      vectorDb: mockVectorDb as unknown as VectorDatabase,
    });

    expect(result.status).toBe("SOLVED");

    // ARCHITECT should have received premise matches in context
    const architectContext = architectAgent.calls[0]!;
    expect(architectContext).toContain("HISTORICAL PREMISE MATCHES");
    expect(architectContext).toContain("n + m = m + n");
    expect(architectContext).toContain("induction n; simp; ring");
    expect(architectContext).toContain("n * m = m * n");

    // Vector DB should have been queried
    expect(mockVectorDb.searchCalled).toBe(true);
  });

  test("ARCHITECT context works normally when no vectorDb is provided", async () => {
    const workspace = await setupWorkspace();
    const factory = new MockAgentFactory();
    const mockLean = new MockLeanBridge();

    const architectAgent = new MockAgent("ARCHITECT", [
      { action: "DIRECTIVE", target_node_id: "root", reasoning: "omega", tactics: "omega" } as any,
    ]);
    factory.registerAgent("ARCHITECT", architectAgent);
    factory.registerAgent("TACTICIAN", new MockAgent("TACTICIAN", [{
      thoughts: "omega", action: "PROPOSE_LEAN_TACTICS",
      lean_tactics: [{ tactic: "omega", informal_sketch: "omega", confidence_score: 0.99 }],
    }]));

    // No embedder or vectorDb provided
    const result = await runDynamicLoop(workspace, new SolverBridge(), {
      maxGlobalIterations: 10,
      agentFactory: factory,
      leanBridge: mockLean as unknown as LeanBridge,
      theoremName: "thm",
      theoremSignature: "(n : Nat) : n = n",
    });

    expect(result.status).toBe("SOLVED");

    // ARCHITECT should still get frontier digest (no crash)
    const architectContext = architectAgent.calls[0]!;
    expect(architectContext).toContain("FRONTIER DIGEST");
    // But no premise matches
    expect(architectContext).not.toContain("HISTORICAL PREMISE MATCHES");
  });
});
