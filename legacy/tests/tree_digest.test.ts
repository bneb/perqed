/**
 * Sprint 12b: Frontier Digest Tests (TDD RED → GREEN)
 *
 * Expert-vetted frontier digest pattern — only OPEN/EXHAUSTED leaf nodes
 * are shown to the Architect. SOLVED and DEAD_END nodes are excluded.
 *
 * Aligned with AlphaProof separation of symbolic engine from policy network.
 */

import { describe, test, expect } from "bun:test";
import { ProofTree } from "../src/tree";

// ──────────────────────────────────────────────
// getGlobalTreeFailures
// ──────────────────────────────────────────────

describe("ProofTree — getGlobalTreeFailures", () => {
  test("returns 0 on fresh tree with no errors", () => {
    const tree = new ProofTree("⊢ goal");
    expect(tree.getGlobalTreeFailures()).toBe(0);
  });

  test("counts errors only on OPEN and EXHAUSTED nodes", () => {
    const tree = new ProofTree("⊢ n + m = m + n");

    // Branch 1: OPEN with 2 errors → counts
    const branch1 = tree.addChild(tree.rootId, "induction n", "case zero");
    branch1.errorHistory.push("simp failed", "omega failed");

    // Branch 2: SOLVED → does NOT count
    const branch2 = tree.addChild(tree.rootId, "omega", "no goals");
    branch2.status = "SOLVED";
    branch2.errorHistory.push("first try failed"); // had 1 error before solving

    // Branch 3: DEAD_END → does NOT count
    const branch3 = tree.addChild(tree.rootId, "rfl", "stuck");
    tree.markDeadEnd(branch3.id);
    branch3.errorHistory.push("rfl failed", "ring failed");

    expect(tree.getGlobalTreeFailures()).toBe(2); // Only branch 1's errors
  });

  test("counts errors on root node if OPEN", () => {
    const tree = new ProofTree("⊢ goal");
    tree.getActiveNode().errorHistory.push("direct fail");
    expect(tree.getGlobalTreeFailures()).toBe(1);
  });

  test("counts EXHAUSTED nodes", () => {
    const tree = new ProofTree("⊢ goal");
    const child = tree.addChild(tree.rootId, "tac", "state");
    child.status = "EXHAUSTED";
    child.errorHistory.push("err1", "err2", "err3");
    expect(tree.getGlobalTreeFailures()).toBe(3);
  });
});

// ──────────────────────────────────────────────
// getPath
// ──────────────────────────────────────────────

describe("ProofTree — getPath", () => {
  test("returns empty array for root node", () => {
    const tree = new ProofTree("⊢ goal");
    expect(tree.getPath(tree.rootId)).toEqual([]);
  });

  test("returns single tactic for depth-1 child", () => {
    const tree = new ProofTree("⊢ goal");
    const child = tree.addChild(tree.rootId, "omega", "no goals");
    expect(tree.getPath(child.id)).toEqual(["omega"]);
  });

  test("returns full tactic chain for deep node", () => {
    const tree = new ProofTree("⊢ goal");
    const d1 = tree.addChild(tree.rootId, "induction n", "case zero");
    const d2 = tree.addChild(d1.id, "simp", "⊢ 0 + m = m");
    const d3 = tree.addChild(d2.id, "rfl", "no goals");
    expect(tree.getPath(d3.id)).toEqual(["induction n", "simp", "rfl"]);
  });
});

// ──────────────────────────────────────────────
// buildFrontierDigest
// ──────────────────────────────────────────────

describe("ProofTree — buildFrontierDigest", () => {
  test("handles empty tree (no branches explored)", () => {
    const tree = new ProofTree("⊢ n + m = m + n");
    const digest = tree.buildFrontierDigest();

    expect(digest).toContain("FRONTIER DIGEST");
    expect(digest).toContain("Global Failures: 0");
  });

  test("includes OPEN branches with path, Lean state, and goal count", () => {
    const tree = new ProofTree("⊢ n + m = m + n");
    const branch = tree.addChild(tree.rootId, "induction n", "case zero\nm : Nat\n⊢ 0 + m = m + 0");

    const digest = tree.buildFrontierDigest();

    expect(digest).toContain("BRANCH");
    expect(digest).toContain(branch.id);
    expect(digest).toContain("`induction n`");
    expect(digest).toContain("OPEN");
    expect(digest).toContain("Remaining Goals: 1");
    expect(digest).toContain("⊢ 0 + m = m + 0");
  });

  test("excludes DEAD_END branches from digest", () => {
    const tree = new ProofTree("⊢ goal");

    const alive = tree.addChild(tree.rootId, "omega", "⊢ goal");
    const dead = tree.addChild(tree.rootId, "rfl", "stuck");
    tree.markDeadEnd(dead.id);

    const digest = tree.buildFrontierDigest();

    expect(digest).toContain(alive.id);
    expect(digest).not.toContain(dead.id);
  });

  test("excludes SOLVED branches from digest", () => {
    const tree = new ProofTree("⊢ goal");

    const open = tree.addChild(tree.rootId, "omega", "⊢ subgoal");
    const solved = tree.addChild(tree.rootId, "rfl", "no goals");
    solved.status = "SOLVED";

    const digest = tree.buildFrontierDigest();

    expect(digest).toContain(open.id);
    expect(digest).not.toContain(solved.id);
  });

  test("includes failure count and truncated latest error", () => {
    const tree = new ProofTree("⊢ goal");

    const branch = tree.addChild(tree.rootId, "induction n", "case zero\n⊢ subgoal");
    branch.errorHistory.push("unknown identifier 'Nat.add_succ'");
    branch.errorHistory.push("tactic 'simp' failed, no progress made");

    const digest = tree.buildFrontierDigest();

    expect(digest).toContain("2 failures");
    expect(digest).toContain("Latest Error:");
    expect(digest).toContain("tactic 'simp' failed");
    expect(digest).toContain("Global Failures: 2");
  });

  test("shows deep path with arrow notation", () => {
    const tree = new ProofTree("⊢ goal");
    const d1 = tree.addChild(tree.rootId, "induction n", "case zero");
    const d2 = tree.addChild(d1.id, "simp", "⊢ simplified");

    const digest = tree.buildFrontierDigest();
    expect(digest).toContain("`induction n` → `simp`");
  });

  test("shows SOLVED goal status for 'no goals' state", () => {
    const tree = new ProofTree("⊢ goal");
    const branch = tree.addChild(tree.rootId, "omega", "no goals");

    // Note: OPEN node with "no goals" in leanState shows goal status SOLVED
    const digest = tree.buildFrontierDigest();
    expect(digest).toContain("Goal Status: SOLVED");
  });

  test("shows critical warning when no open nodes exist", () => {
    const tree = new ProofTree("⊢ goal");
    const branch = tree.addChild(tree.rootId, "rfl", "stuck");
    tree.markDeadEnd(branch.id);
    tree.markDeadEnd(tree.rootId);

    const digest = tree.buildFrontierDigest();
    expect(digest).toContain("No open nodes");
  });

  test("formats Lean state as comment lines", () => {
    const tree = new ProofTree("⊢ goal");
    tree.addChild(tree.rootId, "intro n", "n : Nat\n⊢ n + 0 = n");

    const digest = tree.buildFrontierDigest();
    expect(digest).toContain("-- n : Nat");
    expect(digest).toContain("-- ⊢ n + 0 = n");
  });
});
