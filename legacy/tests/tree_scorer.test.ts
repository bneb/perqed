/**
 * Sprint 20: TreeScorer Tests (TDD RED → GREEN)
 *
 * Tests bottom-up value backpropagation: OR=max, AND=product.
 */

import { describe, test, expect } from "bun:test";
import { ProofTree } from "../src/tree";
import { TreeScorer } from "../src/ml/tree_scorer";

describe("TreeScorer", () => {
  const scorer = new TreeScorer();

  test("OR node value = max of children", () => {
    const tree = new ProofTree("⊢ goal");

    // Child A: 0 errors → value = 1.0 / (1 + 0) = 1.0
    tree.addChild(tree.rootId, "tactic_a", "state_a");

    // Child B: 3 errors → value = 1.0 / (1 + 3) = 0.25
    const childB = tree.addChild(tree.rootId, "tactic_b", "state_b");
    tree.nodes.get(childB.id)!.errorHistory = ["e1", "e2", "e3"];

    scorer.backpropagate(tree);

    const root = tree.nodes.get(tree.rootId)!;
    // Root is OR → max(1.0, 0.25) = 1.0
    expect(root.value).toBe(1.0);
  });

  test("AND node value = product of children", () => {
    const tree = new ProofTree("⊢ goal");

    // Create an AND split with 2 subgoals, each with 1 error
    const subgoals = tree.addAndChildren(tree.rootId, "induction n", [
      "case zero\n⊢ 0 = 0",
      "case succ\n⊢ n+1 = n+1",
    ]);

    // Each child has 1 error → value = 1/(1+1) = 0.5
    subgoals[0]!.errorHistory = ["e1"];
    subgoals[1]!.errorHistory = ["e1"];

    scorer.backpropagate(tree);

    // AND node = 0.5 * 0.5 = 0.25
    const root = tree.nodes.get(tree.rootId)!;
    const andNode = tree.nodes.get(root.childrenIds[0]!)!;
    expect(andNode.value).toBeCloseTo(0.25, 5);
  });

  test("AND collapse: dead subgoal kills parent tactic", () => {
    const tree = new ProofTree("⊢ goal");

    const subgoals = tree.addAndChildren(tree.rootId, "constructor", [
      "⊢ a",
      "⊢ b",
    ]);

    // One SOLVED, one DEAD_END
    subgoals[0]!.status = "SOLVED";
    subgoals[1]!.status = "DEAD_END";

    scorer.backpropagate(tree);

    const root = tree.nodes.get(tree.rootId)!;
    const andNode = tree.nodes.get(root.childrenIds[0]!)!;
    // AND: 1.0 * 0.0 = 0.0 — impossible subgoal kills everything
    expect(andNode.value).toBe(0.0);
  });

  test("SOLVED leaf = 1.0, DEAD_END leaf = 0.0", () => {
    const tree = new ProofTree("⊢ goal");

    const solved = tree.addChild(tree.rootId, "rfl", "no goals");
    tree.nodes.get(solved.id)!.status = "SOLVED";

    const dead = tree.addChild(tree.rootId, "bad", "error");
    tree.nodes.get(dead.id)!.status = "DEAD_END";

    scorer.backpropagate(tree);

    expect(tree.nodes.get(solved.id)!.value).toBe(1.0);
    expect(tree.nodes.get(dead.id)!.value).toBe(0.0);
    // Root OR → max(1.0, 0.0) = 1.0
    expect(tree.nodes.get(tree.rootId)!.value).toBe(1.0);
  });

  test("OPEN leaf with no errors has value 1.0", () => {
    const tree = new ProofTree("⊢ goal");
    const child = tree.addChild(tree.rootId, "simp", "⊢ simplified");

    scorer.backpropagate(tree);

    // 1/(1+0) = 1.0
    expect(tree.nodes.get(child.id)!.value).toBe(1.0);
  });

  test("getBestOpenNodes prioritizes highest value after scoring", () => {
    const tree = new ProofTree("⊢ goal");

    // High-value node: 0 errors
    const good = tree.addChild(tree.rootId, "simp", "⊢ simple");

    // Low-value node: 5 errors
    const bad = tree.addChild(tree.rootId, "omega", "⊢ hard");
    tree.nodes.get(bad.id)!.errorHistory = ["e1", "e2", "e3", "e4", "e5"];

    scorer.backpropagate(tree);

    const batch = tree.getBestOpenNodes(1);
    // Should NOT pick the low-value node (5 errors → V=1/6 ≈ 0.167)
    expect(batch[0]!.id).not.toBe(bad.id);
    // The selected node should have a higher value than the bad node
    expect(batch[0]!.value).toBeGreaterThan(tree.nodes.get(bad.id)!.value);
  });
});
