/**
 * Sprint 18: DatasetExtractor Tests (TDD RED → GREEN)
 *
 * Tests safe SFT pair extraction from winning paths with deduplication.
 */

import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { rm } from "node:fs/promises";
import { ProofTree } from "../src/tree";
import { DatasetExtractor, type SftExample } from "../src/ml/dataset_extractor";

const TEST_DATASET_PATH = "./tmp_test_sft_dataset.jsonl";

describe("DatasetExtractor", () => {
  let extractor: DatasetExtractor;

  beforeEach(async () => {
    await rm(TEST_DATASET_PATH, { force: true });
    extractor = new DatasetExtractor(TEST_DATASET_PATH);
  });

  afterAll(async () => {
    await rm(TEST_DATASET_PATH, { force: true });
  });

  function buildSolvedTree(): { tree: ProofTree; solvedId: string } {
    const tree = new ProofTree("⊢ n + m = m + n");

    // Root -> NodeA (simp) -> NodeB (rfl) [SOLVED]
    const nodeA = tree.addChild(tree.rootId, "simp", "⊢ m + n = m + n");
    const nodeB = tree.addChild(nodeA.id, "rfl", "no goals");
    tree.nodes.get(nodeB.id)!.status = "SOLVED";

    return { tree, solvedId: nodeB.id };
  }

  test("extracts correct SFT pairs from winning path (no existing dataset)", async () => {
    const { tree, solvedId } = buildSolvedTree();

    const pairs = await extractor.getNovelSftPairs(tree, solvedId);

    // Should extract 2 pairs: Root->simp, NodeA->rfl
    expect(pairs.length).toBe(2);

    // First pair: root state -> simp
    expect(pairs[0]!.prompt).toContain("⊢ n + m = m + n");
    expect(pairs[0]!.completion).toBe("simp");

    // Second pair: nodeA state -> rfl
    expect(pairs[1]!.prompt).toContain("⊢ m + n = m + n");
    expect(pairs[1]!.completion).toBe("rfl");
  });

  test("deduplicates against existing dataset entries", async () => {
    const { tree, solvedId } = buildSolvedTree();

    // Pre-populate the dataset with the first pair (Root -> simp)
    const existingPair: SftExample = {
      prompt: `State:\n⊢ n + m = m + n\n\nGenerate the next Lean 4 tactic:`,
      completion: "simp",
    };
    await Bun.write(
      TEST_DATASET_PATH,
      JSON.stringify(existingPair) + "\n",
    );

    const pairs = await extractor.getNovelSftPairs(tree, solvedId);

    // Should only return 1 novel pair (NodeA -> rfl)
    expect(pairs.length).toBe(1);
    expect(pairs[0]!.completion).toBe("rfl");
  });

  test("extractAndSave writes novel pairs to JSONL file", async () => {
    const { tree, solvedId } = buildSolvedTree();

    await extractor.extractAndSave(tree, solvedId);

    // Read the file and verify
    const content = await Bun.file(TEST_DATASET_PATH).text();
    const lines = content.trim().split("\n");

    expect(lines.length).toBe(2);

    const pair1 = JSON.parse(lines[0]!) as SftExample;
    const pair2 = JSON.parse(lines[1]!) as SftExample;

    expect(pair1.completion).toBe("simp");
    expect(pair2.completion).toBe("rfl");
  });

  test("extractAndSave is idempotent (no duplicates on second run)", async () => {
    const { tree, solvedId } = buildSolvedTree();

    // Run twice
    await extractor.extractAndSave(tree, solvedId);
    await extractor.extractAndSave(tree, solvedId);

    const content = await Bun.file(TEST_DATASET_PATH).text();
    const lines = content.trim().split("\n");

    // Should still only have 2 lines, not 4
    expect(lines.length).toBe(2);
  });

  test("handles empty winning path gracefully", async () => {
    const tree = new ProofTree("⊢ goal");
    // Mark root as solved (single-node, no tactics)
    tree.nodes.get(tree.rootId)!.status = "SOLVED";

    const pairs = await extractor.getNovelSftPairs(tree, tree.rootId);
    expect(pairs.length).toBe(0);
  });
});
