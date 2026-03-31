/**
 * Sprint 17: Concurrent Orchestration Tests (TDD RED → GREEN)
 *
 * Validates that batched node processing runs concurrently via Promise.all,
 * not sequentially. Uses timing assertions with artificial delays.
 */

import { describe, test, expect } from "bun:test";
import { ProofTree } from "../src/tree";
import { processNode, type ProcessNodeDeps } from "../src/orchestrator";

describe("Orchestrator Concurrent Processing", () => {

  test("processNode marks a successful completion as SOLVED", async () => {
    const tree = new ProofTree("⊢ n = n");
    const child = tree.addChild(tree.rootId, "rfl_attempt", "⊢ n = n");
    child.status = "WORKING";

    const deps: ProcessNodeDeps = {
      generateTactic: async () => "rfl",
      checkProof: async () => ({
        success: true,
        isComplete: true,
        rawOutput: "PROOF_VALID",
      }),
    };

    await processNode(child, tree, "test_thm", "(n : Nat) : n = n", deps);

    // Child should be DEAD_END (explored), and a new SOLVED grandchild should exist
    expect(child.status as string).toBe("DEAD_END");
    const solvedNode = Array.from(tree.nodes.values()).find(n => n.status === "SOLVED");
    expect(solvedNode).toBeDefined();
  });

  test("processNode unlocks to OPEN on tactic error", async () => {
    const tree = new ProofTree("⊢ goal");
    const child = tree.addChild(tree.rootId, "attempt", "⊢ goal");
    child.status = "WORKING";

    const deps: ProcessNodeDeps = {
      generateTactic: async () => "bad_tactic",
      checkProof: async () => ({
        success: false,
        isComplete: false,
        error: "tactic 'bad_tactic' failed",
        rawOutput: "error",
      }),
    };

    await processNode(child, tree, "test_thm", "(n : Nat) : n = n", deps);

    // Should unlock back to OPEN for retry
    expect(child.status as string).toBe("OPEN");
    expect(child.errorHistory.length).toBe(1);
  });

  test("processNode unlocks to OPEN on exception", async () => {
    const tree = new ProofTree("⊢ goal");
    const child = tree.addChild(tree.rootId, "attempt", "⊢ goal");
    child.status = "WORKING";

    const deps: ProcessNodeDeps = {
      generateTactic: async () => { throw new Error("Network timeout"); },
      checkProof: async () => ({
        success: false,
        isComplete: false,
        rawOutput: "",
      }),
    };

    await processNode(child, tree, "test_thm", "(n : Nat) : n = n", deps);

    expect(child.status as string).toBe("OPEN");
    expect(child.errorHistory[0]).toContain("Network timeout");
  });

  test("getBestOpenNodes + Promise.all runs faster than sequential", async () => {
    const tree = new ProofTree("⊢ goal");

    // Add 3 open nodes
    for (let i = 0; i < 3; i++) {
      tree.addChild(tree.rootId, `tactic_${i}`, `state_${i}`);
    }

    const batch = tree.getBestOpenNodes(3);
    expect(batch.length).toBe(3);

    // Simulate concurrent processing with artificial delays
    const DELAY_MS = 50;
    const start = performance.now();

    const deps: ProcessNodeDeps = {
      generateTactic: async () => {
        await new Promise(r => setTimeout(r, DELAY_MS));
        return "tactic";
      },
      checkProof: async () => ({
        success: false,
        isComplete: false,
        error: "failed",
        rawOutput: "error",
      }),
    };

    await Promise.all(
      batch.map(node =>
        processNode(node, tree, "test_thm", "(n : Nat) : n = n", deps),
      ),
    );

    const elapsed = performance.now() - start;

    // If truly concurrent, ≈ 50ms not 150ms
    expect(elapsed).toBeLessThan(DELAY_MS * 2.5); // < 125ms
    expect(elapsed).toBeGreaterThan(DELAY_MS * 0.5); // > 25ms

    // All nodes should be unlocked back to OPEN (error case)
    for (const node of batch) {
      expect(node.status).toBe("OPEN");
    }
  });
});
