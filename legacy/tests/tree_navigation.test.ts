/**
 * Sprint 12c: getBestOpenNode Tests (TDD RED → GREEN)
 */
import { describe, test, expect } from "bun:test";
import { ProofTree } from "../src/tree";

describe("ProofTree — getBestOpenNode", () => {
  test("returns root node on fresh tree", () => {
    const tree = new ProofTree("⊢ goal");
    const best = tree.getBestOpenNode();
    expect(best).not.toBeNull();
    expect(best!.id).toBe(tree.rootId);
  });

  test("selects node with fewest errors", () => {
    const tree = new ProofTree("⊢ goal");
    const branch1 = tree.addChild(tree.rootId, "induction", "case zero");
    branch1.errorHistory.push("err1", "err2", "err3");

    const branch2 = tree.addChild(tree.rootId, "omega", "⊢ subgoal");
    branch2.errorHistory.push("err1"); // fewer errors

    const best = tree.getBestOpenNode();
    // root has 0 errors, so root should be returned
    expect(best!.id).toBe(tree.rootId);
  });

  test("ignores DEAD_END nodes", () => {
    const tree = new ProofTree("⊢ goal");
    // Root has 0 errors but mark it dead
    tree.markDeadEnd(tree.rootId);

    const branch1 = tree.addChild(tree.rootId, "omega", "⊢ x");
    branch1.errorHistory.push("err1", "err2");

    const branch2 = tree.addChild(tree.rootId, "simp", "⊢ y");
    branch2.errorHistory.push("err1");

    const best = tree.getBestOpenNode();
    expect(best!.id).toBe(branch2.id); // fewer errors among OPEN nodes
  });

  test("ignores SOLVED nodes", () => {
    const tree = new ProofTree("⊢ goal");
    tree.markDeadEnd(tree.rootId);

    const solved = tree.addChild(tree.rootId, "rfl", "no goals");
    solved.status = "SOLVED";

    const open = tree.addChild(tree.rootId, "omega", "⊢ subgoal");
    open.errorHistory.push("err1");

    const best = tree.getBestOpenNode();
    expect(best!.id).toBe(open.id);
  });

  test("returns null when all nodes are DEAD_END or SOLVED", () => {
    const tree = new ProofTree("⊢ goal");
    tree.markDeadEnd(tree.rootId);

    const branch = tree.addChild(tree.rootId, "tac", "state");
    branch.status = "SOLVED";

    const best = tree.getBestOpenNode();
    expect(best).toBeNull();
  });
});
