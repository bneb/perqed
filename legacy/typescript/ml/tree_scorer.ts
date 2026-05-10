/**
 * Sprint 20: TreeScorer — Bottom-Up Value Backpropagation
 *
 * Recalculates win probabilities for every node in the ProofTree:
 *   - OR nodes → max(children)   (best alternative tactic)
 *   - AND nodes → Π(children)    (all subgoals must succeed)
 *   - SOLVED → 1.0
 *   - DEAD_END → 0.0
 *   - OPEN leaf → 1/(1 + errorCount) heuristic
 */

import type { ProofTree } from "../tree";

export class TreeScorer {
  /**
   * Recalculates the value of every node in the tree using bottom-up
   * (post-order) traversal from root.
   */
  public backpropagate(tree: ProofTree): void {
    if (!tree.nodes.has(tree.rootId)) return;
    this.computeValue(tree, tree.rootId);
  }

  private computeValue(tree: ProofTree, nodeId: string): number {
    const node = tree.nodes.get(nodeId);
    if (!node) return 0.0;

    // 1. Base Cases (Leaf Nodes)
    if (node.status === "SOLVED") {
      node.value = 1.0;
      return 1.0;
    }
    if (node.status === "DEAD_END") {
      node.value = 0.0;
      return 0.0;
    }
    if (node.childrenIds.length === 0) {
      // OPEN or WORKING leaf — heuristic penalty for accumulated errors
      node.value = 1.0 / (1.0 + node.errorHistory.length);
      return node.value;
    }

    // 2. Recursive Step (Internal Nodes)
    const childValues = node.childrenIds.map((childId) =>
      this.computeValue(tree, childId),
    );

    if (node.splitType === "AND") {
      // AND node: all subgoals must succeed → product
      node.value = childValues.reduce((acc, val) => acc * val, 1.0);
    } else {
      // OR node (default): best alternative → max
      node.value = Math.max(...childValues);
    }

    return node.value;
  }
}
