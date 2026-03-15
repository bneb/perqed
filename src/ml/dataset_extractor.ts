/**
 * Sprint 18: DatasetExtractor — Safe SFT Data Harvester
 *
 * Extracts (State → Tactic) pairs from solved ProofTree winning paths.
 * Deduplicates against existing sft_dataset.jsonl to prevent overfitting.
 *
 * Only extracts mathematically proven pairs — never penalizes unexplored
 * branches (avoiding the DPO mode-collapse trap).
 */

import * as fs from "node:fs/promises";
import type { ProofTree } from "../tree";

export interface SftExample {
  prompt: string;
  completion: string;
}

export class DatasetExtractor {
  private datasetPath: string;

  constructor(datasetPath: string = "./data/sft_dataset.jsonl") {
    this.datasetPath = datasetPath;
  }

  /**
   * Extracts SFT pairs from the winning path, deduplicates against
   * the existing dataset, and appends novel pairs to the JSONL file.
   */
  public async extractAndSave(
    tree: ProofTree,
    solvedNodeId: string,
  ): Promise<void> {
    const novelExamples = await this.getNovelSftPairs(tree, solvedNodeId);

    if (novelExamples.length === 0) {
      console.log(
        "No novel tactics to extract (all pairs already exist in dataset).",
      );
      return;
    }

    let jsonlData = "";
    for (const ex of novelExamples) {
      jsonlData += JSON.stringify(ex) + "\n";
    }

    try {
      await fs.appendFile(this.datasetPath, jsonlData, "utf-8");
    } catch {
      // Directory might not exist — create it and retry
      const dir = this.datasetPath.substring(
        0,
        this.datasetPath.lastIndexOf("/"),
      );
      if (dir) await fs.mkdir(dir, { recursive: true });
      await fs.appendFile(this.datasetPath, jsonlData, "utf-8");
    }

    console.log(
      `📊 Extracted ${novelExamples.length} novel SFT pairs to ${this.datasetPath}`,
    );
  }

  /**
   * Extracts (State → Tactic) pairs from the winning path and filters
   * out any that already exist in the dataset file.
   *
   * @param tree - The solved ProofTree
   * @param solvedNodeId - ID of the SOLVED leaf node
   * @returns Array of novel SftExample pairs
   */
  public async getNovelSftPairs(
    tree: ProofTree,
    solvedNodeId: string,
  ): Promise<SftExample[]> {
    const winningPath = tree.getWinningPath(solvedNodeId);
    const candidateExamples: SftExample[] = [];

    // Skip index 0 (root). Extract parent state → child tactic pairs.
    for (let i = 1; i < winningPath.length; i++) {
      const targetNode = winningPath[i]!;
      const parentNode = tree.nodes.get(targetNode.parentId!);

      if (!parentNode || !targetNode.tacticApplied) continue;

      candidateExamples.push({
        prompt: `State:\n${parentNode.leanState}\n\nGenerate the next Lean 4 tactic:`,
        completion: targetNode.tacticApplied,
      });
    }

    // Read existing dataset to deduplicate
    const existingSignatures = new Set<string>();
    try {
      const fileContent = await fs.readFile(this.datasetPath, "utf-8");
      const lines = fileContent.split("\n").filter((l) => l.trim().length > 0);
      for (const line of lines) {
        const parsed = JSON.parse(line) as SftExample;
        existingSignatures.add(`${parsed.prompt}:::${parsed.completion}`);
      }
    } catch {
      // File doesn't exist yet — all candidates are novel
    }

    // Filter out duplicates
    return candidateExamples.filter((ex) => {
      const sig = `${ex.prompt}:::${ex.completion}`;
      return !existingSignatures.has(sig);
    });
  }
}
