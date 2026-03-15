/**
 * Sprint 12d: TreePrinter Tests (TDD RED → GREEN)
 *
 * Verifies the ASCII tree visualization for terminal output.
 */

import { describe, test, expect } from "bun:test";
import { ProofTree } from "../src/tree";
import { TreePrinter } from "../src/utils/tree_printer";

describe("TreePrinter", () => {

  test("prints a single root node", () => {
    const tree = new ProofTree("⊢ n + m = m + n");
    const output = TreePrinter.print(tree);

    expect(output).toContain("MCTS PROOF TREE TRACE");
    expect(output).toContain("[ROOT]");
    expect(output).toContain("OPEN");
  });

  test("prints branches with correct connectors", () => {
    const tree = new ProofTree("⊢ goal");

    // Branch A and Branch B from root
    const branchA = tree.addChild(tree.rootId, "induction n", "case zero");
    const branchB = tree.addChild(tree.rootId, "omega", "⊢ subgoal");

    const output = TreePrinter.print(tree);

    // Branch A should use ├── (not last child)
    expect(output).toContain("├──");
    // Branch B should use └── (last child)
    expect(output).toContain("└──");
    // Both tactics should appear
    expect(output).toContain("`induction n`");
    expect(output).toContain("`omega`");
  });

  test("prints nested children with correct connectors", () => {
    const tree = new ProofTree("⊢ goal");

    // Branch A → grandchild
    const branchA = tree.addChild(tree.rootId, "induction n", "case zero");
    const grandchild = tree.addChild(branchA.id, "simp", "no goals");
    grandchild.status = "SOLVED";

    // Branch B is a dead end
    const branchB = tree.addChild(tree.rootId, "omega", "⊢ subgoal");
    tree.markDeadEnd(branchB.id);

    const output = TreePrinter.print(tree);

    // Status icons
    expect(output).toContain("✅"); // SOLVED grandchild
    expect(output).toContain("💀"); // DEAD_END branch B

    // Grandchild should be nested under Branch A
    expect(output).toContain("`simp`");
    // Both branches present
    expect(output).toContain("`induction n`");
    expect(output).toContain("`omega`");
  });

  test("shows error counts on nodes with failures", () => {
    const tree = new ProofTree("⊢ goal");

    const branch = tree.addChild(tree.rootId, "simp", "⊢ x");
    branch.errorHistory.push("err1", "err2", "err3");

    const output = TreePrinter.print(tree);
    expect(output).toContain("(3 errors)");
  });

  test("prints EXHAUSTED node with correct icon", () => {
    const tree = new ProofTree("⊢ goal");

    const branch = tree.addChild(tree.rootId, "ring", "⊢ x");
    branch.status = "EXHAUSTED";

    const output = TreePrinter.print(tree);
    expect(output).toContain("❌"); // EXHAUSTED icon
  });

  test("handles deep tree (3+ levels)", () => {
    const tree = new ProofTree("⊢ goal");

    const level1 = tree.addChild(tree.rootId, "intro h", "case h");
    const level2 = tree.addChild(level1.id, "rw [h]", "case rw");
    const level3 = tree.addChild(level2.id, "rfl", "no goals");
    level3.status = "SOLVED";

    const output = TreePrinter.print(tree);

    // All 3 levels of tactics should be present
    expect(output).toContain("`intro h`");
    expect(output).toContain("`rw [h]`");
    expect(output).toContain("`rfl`");
    expect(output).toContain("✅");
  });
});
