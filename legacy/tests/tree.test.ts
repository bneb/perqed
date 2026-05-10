/**
 * Sprint 12: ProofTree Tests (TDD RED → GREEN)
 *
 * Tests:
 * 1. Initialization: root node set correctly
 * 2. addChild: links parent/child, depth increments
 * 3. markDeadEnd: updates status
 * 4. setActiveNode: changes active, increments visits
 * 5. getActiveNode: returns correct node
 * 6. Error isolation: errors recorded per-node
 * 7. Multiple children: fan-out from single parent
 * 8. Deep path: multi-level tree depth tracking
 */

import { describe, test, expect } from "bun:test";
import { ProofTree, type ProofNode, type NodeStatus } from "../src/tree";

describe("ProofTree — Initialization", () => {
  test("constructor creates root node with correct initial state", () => {
    const tree = new ProofTree("⊢ n + m = m + n");

    expect(tree.rootId).toBeString();
    expect(tree.activeNodeId).toBe(tree.rootId);
    expect(tree.nodes.size).toBe(1);

    const root = tree.getActiveNode();
    expect(root.id).toBe(tree.rootId);
    expect(root.parentId).toBeNull();
    expect(root.tacticApplied).toBeNull();
    expect(root.leanState).toBe("⊢ n + m = m + n");
    expect(root.status).toBe("OPEN");
    expect(root.childrenIds).toEqual([]);
    expect(root.depth).toBe(0);
    expect(root.visits).toBe(1);
    expect(root.errorHistory).toEqual([]);
  });
});

describe("ProofTree — addChild", () => {
  test("links parent and child correctly", () => {
    const tree = new ProofTree("⊢ n + m = m + n");
    const rootId = tree.rootId;

    const child = tree.addChild(rootId, "induction n", "case zero: ⊢ 0 + m = m + 0");

    expect(child.parentId).toBe(rootId);
    expect(child.tacticApplied).toBe("induction n");
    expect(child.leanState).toBe("case zero: ⊢ 0 + m = m + 0");
    expect(child.status).toBe("OPEN");

    // Verify parent's childrenIds updated
    const root = tree.nodes.get(rootId)!;
    expect(root.childrenIds).toContain(child.id);
  });

  test("increments depth from parent", () => {
    const tree = new ProofTree("root state");
    const child = tree.addChild(tree.rootId, "tactic1", "child state");

    expect(child.depth).toBe(1);

    const grandchild = tree.addChild(child.id, "tactic2", "grandchild state");
    expect(grandchild.depth).toBe(2);
  });

  test("new child starts with 0 visits and empty errorHistory", () => {
    const tree = new ProofTree("root state");
    const child = tree.addChild(tree.rootId, "omega", "no goals");

    expect(child.visits).toBe(0);
    expect(child.errorHistory).toEqual([]);
  });

  test("throws on invalid parentId", () => {
    const tree = new ProofTree("root state");
    expect(() => tree.addChild("nonexistent-id", "tac", "state")).toThrow("Parent node not found");
  });

  test("supports multiple children from same parent", () => {
    const tree = new ProofTree("root state");
    const child1 = tree.addChild(tree.rootId, "tactic_a", "state_a");
    const child2 = tree.addChild(tree.rootId, "tactic_b", "state_b");
    const child3 = tree.addChild(tree.rootId, "tactic_c", "state_c");

    const root = tree.nodes.get(tree.rootId)!;
    expect(root.childrenIds).toHaveLength(3);
    expect(root.childrenIds).toContain(child1.id);
    expect(root.childrenIds).toContain(child2.id);
    expect(root.childrenIds).toContain(child3.id);
    expect(tree.nodes.size).toBe(4); // root + 3 children
  });
});

describe("ProofTree — markDeadEnd", () => {
  test("updates node status to DEAD_END", () => {
    const tree = new ProofTree("root state");
    const child = tree.addChild(tree.rootId, "bad_tactic", "stuck state");

    tree.markDeadEnd(child.id);
    expect(tree.nodes.get(child.id)!.status).toBe("DEAD_END");
  });

  test("does not crash on nonexistent nodeId", () => {
    const tree = new ProofTree("root state");
    // Should silently do nothing
    expect(() => tree.markDeadEnd("fake-id")).not.toThrow();
  });
});

describe("ProofTree — setActiveNode", () => {
  test("changes the active node", () => {
    const tree = new ProofTree("root state");
    const child = tree.addChild(tree.rootId, "tac", "child state");

    tree.setActiveNode(child.id);
    expect(tree.activeNodeId).toBe(child.id);
    expect(tree.getActiveNode().leanState).toBe("child state");
  });

  test("increments visits on the target node", () => {
    const tree = new ProofTree("root state");
    const child = tree.addChild(tree.rootId, "tac", "child state");

    expect(child.visits).toBe(0);
    tree.setActiveNode(child.id);
    expect(tree.nodes.get(child.id)!.visits).toBe(1);
    tree.setActiveNode(child.id);
    expect(tree.nodes.get(child.id)!.visits).toBe(2);
  });

  test("throws on nonexistent nodeId", () => {
    const tree = new ProofTree("root state");
    expect(() => tree.setActiveNode("nonexistent")).toThrow("Node not found");
  });
});

describe("ProofTree — Error Isolation", () => {
  test("errors are recorded per-node, not globally", () => {
    const tree = new ProofTree("root state");
    const childA = tree.addChild(tree.rootId, "tac_a", "state_a");
    const childB = tree.addChild(tree.rootId, "tac_b", "state_b");

    childA.errorHistory.push("simp failed");
    childA.errorHistory.push("omega failed");
    childB.errorHistory.push("ring failed");

    expect(childA.errorHistory).toEqual(["simp failed", "omega failed"]);
    expect(childB.errorHistory).toEqual(["ring failed"]);
    expect(tree.nodes.get(tree.rootId)!.errorHistory).toEqual([]);
  });
});

describe("ProofTree — Deep Path", () => {
  test("tracks depth correctly through multi-level tree", () => {
    const tree = new ProofTree("⊢ goal");
    const d1 = tree.addChild(tree.rootId, "intro n", "n : Nat ⊢ goal'");
    const d2 = tree.addChild(d1.id, "induction n", "case zero");
    const d3 = tree.addChild(d2.id, "simp", "no goals");

    expect(d1.depth).toBe(1);
    expect(d2.depth).toBe(2);
    expect(d3.depth).toBe(3);
    expect(tree.nodes.size).toBe(4);
  });
});
