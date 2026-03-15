/**
 * TreePrinter — ASCII visualization of the MCTS ProofTree.
 *
 * Recursively walks the tree and generates a readable terminal output
 * showing branches, tactics, statuses, and error counts.
 */

import { ProofTree, type ProofNode } from "../tree";

export class TreePrinter {
  /**
   * Generates an ASCII representation of the ProofTree.
   */
  public static print(tree: ProofTree): string {
    const root = tree.nodes.get(tree.rootId);
    if (!root) return "❌ Invalid Tree: No Root";

    let output = `\n🌲 MCTS PROOF TREE TRACE\n`;
    output += `==================================================\n`;
    output += this.walkNode(tree, root, "", true);
    output += `==================================================\n`;

    return output;
  }

  private static walkNode(
    tree: ProofTree,
    node: ProofNode,
    prefix: string,
    isLast: boolean,
  ): string {
    // 1. Format the current node
    const connector = isLast ? "└── " : "├── ";
    const tactic =
      node.parentId === null
        ? "[ROOT] Initial State"
        : `\`${node.tacticApplied}\``;

    // Status coloring/iconography
    let statusIcon = "⚪";
    if (node.status === "SOLVED") statusIcon = "✅";
    if (node.status === "DEAD_END") statusIcon = "💀";
    if (node.status === "EXHAUSTED") statusIcon = "❌";

    const errors =
      node.errorHistory.length > 0
        ? ` (${node.errorHistory.length} errors)`
        : "";
    const nodeId = node.id.split("-")[0]; // Short ID

    let result = `${prefix}${connector}${statusIcon} [${nodeId}] ${tactic} -> ${node.status}${errors}\n`;

    // 2. Recursively walk children
    const childPrefix = prefix + (isLast ? "    " : "│   ");
    node.childrenIds.forEach((childId, index) => {
      const child = tree.nodes.get(childId);
      if (child) {
        const isLastChild = index === node.childrenIds.length - 1;
        result += this.walkNode(tree, child, childPrefix, isLastChild);
      }
    });

    return result;
  }
}
