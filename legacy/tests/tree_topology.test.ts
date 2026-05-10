/**
 * Sprint 19: AND/OR Tree Topology Tests (TDD RED → GREEN)
 *
 * Tests the splitType property and addAndChildren method.
 */

import { describe, test, expect } from "bun:test";
import { ProofTree } from "../src/tree";

describe("ProofTree AND/OR Topology", () => {

  test("addChild creates a node with splitType OR", () => {
    const tree = new ProofTree("⊢ goal");
    const child = tree.addChild(tree.rootId, "simp", "⊢ simplified");

    expect(child.splitType).toBe("OR");
  });

  test("root node has splitType OR", () => {
    const tree = new ProofTree("⊢ goal");
    const root = tree.nodes.get(tree.rootId)!;

    expect(root.splitType).toBe("OR");
  });

  test("addAndChildren creates an AND node with OR subgoal children", () => {
    const tree = new ProofTree("⊢ n + m = m + n");

    const subgoals = tree.addAndChildren(
      tree.rootId,
      "induction n",
      ["case zero\n⊢ 0 + m = m + 0", "case succ\nn : Nat\nih : n + m = m + n\n⊢ n + 1 + m = m + (n + 1)"],
    );

    // Should create 2 subgoal nodes
    expect(subgoals.length).toBe(2);

    // Root should have exactly 1 new child (the AND node)
    const root = tree.nodes.get(tree.rootId)!;
    expect(root.childrenIds.length).toBe(1);

    // The AND node
    const andNode = tree.nodes.get(root.childrenIds[0]!)!;
    expect(andNode.splitType).toBe("AND");
    expect(andNode.tacticApplied).toBe("induction n");
    expect(andNode.childrenIds.length).toBe(2);

    // Its children are OR state nodes
    for (const subgoal of subgoals) {
      expect(subgoal.splitType).toBe("OR");
      expect(subgoal.tacticApplied).toBeNull();
      expect(subgoal.status).toBe("OPEN");
    }
  });

  test("AND node leanState contains tactic name", () => {
    const tree = new ProofTree("⊢ goal");
    tree.addAndChildren(tree.rootId, "constructor", ["⊢ a", "⊢ b"]);

    const root = tree.nodes.get(tree.rootId)!;
    const andNode = tree.nodes.get(root.childrenIds[0]!)!;

    expect(andNode.leanState).toContain("constructor");
  });

  test("subgoal states contain their individual goal text", () => {
    const tree = new ProofTree("⊢ goal");
    const subgoals = tree.addAndChildren(
      tree.rootId,
      "cases h",
      ["case inl\nh : P\n⊢ P ∨ Q", "case inr\nh : Q\n⊢ P ∨ Q"],
    );

    expect(subgoals[0]!.leanState).toContain("case inl");
    expect(subgoals[1]!.leanState).toContain("case inr");
  });
});
