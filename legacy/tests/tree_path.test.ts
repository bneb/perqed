/**
 * Sprint 16: ProofTree Winning Path Tests (TDD RED → GREEN)
 *
 * Tests the getWinningPath() method that traces from a SOLVED leaf to root.
 */

import { describe, test, expect } from "bun:test";
import { ProofTree } from "../src/tree";

describe("ProofTree.getWinningPath()", () => {

  test("returns root-to-leaf path through the SOLVED branch only", () => {
    const tree = new ProofTree("⊢ n + m = m + n");

    // Branch A: dead end
    const branchA = tree.addChild(tree.rootId, "omega", "failed state");
    tree.nodes.get(branchA.id)!.status = "DEAD_END";

    // Branch B: successful path (2 steps deep)
    const branchB1 = tree.addChild(tree.rootId, "induction n", "case zero ⊢ ...");
    const branchB2 = tree.addChild(branchB1.id, "simp", "no goals");
    tree.nodes.get(branchB2.id)!.status = "SOLVED";

    const path = tree.getWinningPath(branchB2.id);

    // Path should be Root → branchB1 → branchB2
    expect(path.length).toBe(3);
    expect(path[0]!.id).toBe(tree.rootId);
    expect(path[1]!.id).toBe(branchB1.id);
    expect(path[1]!.tacticApplied).toBe("induction n");
    expect(path[2]!.id).toBe(branchB2.id);
    expect(path[2]!.tacticApplied).toBe("simp");
    expect(path[2]!.status).toBe("SOLVED");

    // Branch A should NOT appear
    const pathIds = path.map(n => n.id);
    expect(pathIds).not.toContain(branchA.id);
  });

  test("returns just root and solved child for single-step proof", () => {
    const tree = new ProofTree("⊢ n = n");
    const child = tree.addChild(tree.rootId, "rfl", "no goals");
    tree.nodes.get(child.id)!.status = "SOLVED";

    const path = tree.getWinningPath(child.id);

    expect(path.length).toBe(2);
    expect(path[0]!.id).toBe(tree.rootId);
    expect(path[1]!.tacticApplied).toBe("rfl");
  });

  test("throws when called on an OPEN node", () => {
    const tree = new ProofTree("⊢ goal");
    const child = tree.addChild(tree.rootId, "tactic", "state");
    // child is OPEN by default

    expect(() => tree.getWinningPath(child.id)).toThrow("not a SOLVED node");
  });

  test("throws when called on a DEAD_END node", () => {
    const tree = new ProofTree("⊢ goal");
    const child = tree.addChild(tree.rootId, "bad_tactic", "error state");
    tree.nodes.get(child.id)!.status = "DEAD_END";

    expect(() => tree.getWinningPath(child.id)).toThrow("not a SOLVED node");
  });

  test("throws when called with non-existent node ID", () => {
    const tree = new ProofTree("⊢ goal");

    expect(() => tree.getWinningPath("fake-id")).toThrow("not a SOLVED node");
  });
});
