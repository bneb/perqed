/**
 * Sprint 17: ProofTree Async Batch Selection Tests (TDD RED → GREEN)
 *
 * Tests getBestOpenNodes() which selects and locks nodes for concurrent processing.
 */

import { describe, test, expect } from "bun:test";
import { ProofTree } from "../src/tree";

describe("ProofTree.getBestOpenNodes()", () => {

  test("returns up to N open nodes and marks them WORKING", () => {
    const tree = new ProofTree("⊢ goal");

    // Create 5 open child nodes
    for (let i = 0; i < 5; i++) {
      tree.addChild(tree.rootId, `tactic_${i}`, `state_${i}`);
    }

    const batch = tree.getBestOpenNodes(3);

    expect(batch.length).toBe(3);
    for (const node of batch) {
      expect(node.status).toBe("WORKING");
    }
  });

  test("subsequent call returns remaining OPEN nodes", () => {
    const tree = new ProofTree("⊢ goal");

    for (let i = 0; i < 5; i++) {
      tree.addChild(tree.rootId, `tactic_${i}`, `state_${i}`);
    }

    // First batch: grab 3
    tree.getBestOpenNodes(3);

    // Second batch: should get the remaining 2 (plus root if still OPEN)
    const batch2 = tree.getBestOpenNodes(3);

    // Root + 2 remaining children = 3, or just 2 remaining children
    // All of these should now be WORKING
    expect(batch2.length).toBeGreaterThanOrEqual(2);
    for (const node of batch2) {
      expect(node.status).toBe("WORKING");
    }
  });

  test("returns empty array when no OPEN nodes exist", () => {
    const tree = new ProofTree("⊢ goal");
    // Mark root as SOLVED
    tree.nodes.get(tree.rootId)!.status = "SOLVED";

    const batch = tree.getBestOpenNodes(3);
    expect(batch.length).toBe(0);
  });

  test("prioritizes nodes with fewer errors", () => {
    const tree = new ProofTree("⊢ goal");

    const cleanNode = tree.addChild(tree.rootId, "good_tactic", "clean state");
    const dirtyNode = tree.addChild(tree.rootId, "bad_tactic", "error state");

    // Add errors to dirtyNode
    tree.nodes.get(dirtyNode.id)!.errorHistory = ["err1", "err2", "err3"];

    const batch = tree.getBestOpenNodes(1);

    // Should pick the clean node first (fewer errors)
    // Could be root or cleanNode (both have 0 errors), but NOT dirtyNode
    expect(batch[0]!.id).not.toBe(dirtyNode.id);
  });

  test("does not select SOLVED, DEAD_END, or already WORKING nodes", () => {
    const tree = new ProofTree("⊢ goal");

    const solved = tree.addChild(tree.rootId, "t1", "s1");
    tree.nodes.get(solved.id)!.status = "SOLVED";

    const deadEnd = tree.addChild(tree.rootId, "t2", "s2");
    tree.nodes.get(deadEnd.id)!.status = "DEAD_END";

    const working = tree.addChild(tree.rootId, "t3", "s3");
    tree.nodes.get(working.id)!.status = "WORKING";

    const open = tree.addChild(tree.rootId, "t4", "s4");

    const batch = tree.getBestOpenNodes(10);
    const batchIds = batch.map(n => n.id);

    expect(batchIds).not.toContain(solved.id);
    expect(batchIds).not.toContain(deadEnd.id);
    expect(batchIds).not.toContain(working.id);
    expect(batchIds).toContain(open.id);
  });
});
