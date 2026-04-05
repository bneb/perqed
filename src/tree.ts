/**
 * Sprint 12: ProofTree — Spatial Memory for MCTS Foundation
 *
 * Every successful tactic application spawns a new ProofNode.
 * The tree tracks:
 *   - leanState: the Lean 4 tactic state at each node
 *   - errorHistory: failed tactics *specific to this branch*
 *   - visits: for future MCTS weighting (UCT score)
 *   - status: OPEN | SOLVED | EXHAUSTED | DEAD_END
 *
 * The Orchestrator navigates this tree via setActiveNode(),
 * and the ARCHITECT can issue BACKTRACK to return to parent.
 */

import { randomUUID } from "node:crypto";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type NodeStatus = "OPEN" | "WORKING" | "SOLVED" | "EXHAUSTED" | "DEAD_END";

export interface ProofNode {
  id: string;
  parentId: string | null;
  tacticApplied: string | null;  // The tactic that produced this state
  leanState: string;              // Lean 4 tactic state at this node
  status: NodeStatus;
  childrenIds: string[];
  depth: number;
  visits: number;                 // For future MCTS UCT weighting
  errorHistory: string[];         // Failed tactics at THIS node only
  splitType: "OR" | "AND";        // Sprint 19: OR = alternative tactics, AND = all subgoals required
  value: number;                  // Sprint 20: Propagated win probability (0.0 to 1.0)
  envId?: number;                 // Sprint 21: Persistent REPL environment ID for state restoration
}

// ──────────────────────────────────────────────
// ProofTree
// ──────────────────────────────────────────────

export class ProofTree {
  public nodes: Map<string, ProofNode> = new Map();
  public rootId: string;
  public activeNodeId: string;

  constructor(initialState: string) {
    const root: ProofNode = {
      id: randomUUID(),
      parentId: null,
      tacticApplied: null,
      leanState: initialState,
      status: "OPEN",
      childrenIds: [],
      depth: 0,
      visits: 1,
      errorHistory: [],
      splitType: "OR",
      value: 0.5,
      envId: undefined,
    };
    this.nodes.set(root.id, root);
    this.rootId = root.id;
    this.activeNodeId = root.id;
  }

  /** Returns the currently active ProofNode. */
  public getActiveNode(): ProofNode {
    return this.nodes.get(this.activeNodeId)!;
  }

  /** Returns a node by ID, or undefined if not found. */
  public getNode(id: string): ProofNode | undefined {
    return this.nodes.get(id);
  }

  /** Returns the total number of nodes in the tree. */
  public getNodeCount(): number {
    return this.nodes.size;
  }

  /**
   * Spawn a new child node from a successful tactic application.
   *
   * @param parentId - The parent node's ID
   * @param tactic - The tactic that was applied
   * @param newState - The resulting Lean 4 tactic state
   * @returns The newly created child node
   */
  public addChild(parentId: string, tactic: string, newState: string): ProofNode {
    const parent = this.nodes.get(parentId);
    if (!parent) throw new Error("Parent node not found");

    const child: ProofNode = {
      id: randomUUID(),
      parentId: parent.id,
      tacticApplied: tactic,
      leanState: newState,
      status: "OPEN",
      childrenIds: [],
      depth: parent.depth + 1,
      visits: 0,
      errorHistory: [],
      splitType: "OR",
      value: 0.5,
      envId: undefined,
    };

    parent.childrenIds.push(child.id);
    this.nodes.set(child.id, child);
    return child;
  }

  /**
   * Mark a node as a dead-end — no further tactics should be tried here.
   * Silently no-ops if the node doesn't exist.
   */
  public markDeadEnd(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) node.status = "DEAD_END";
  }

  /**
   * Mark a node as solved — the proof is complete at this point.
   */
  public markSolved(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) node.status = "SOLVED";
  }

  /**
   * Navigate the active pointer to a different node.
   * Increments the target node's visit count (MCTS exploration signal).
   */
  public setActiveNode(nodeId: string): void {
    if (!this.nodes.has(nodeId)) throw new Error("Node not found");
    this.activeNodeId = nodeId;
    this.nodes.get(nodeId)!.visits += 1;
  }

  /**
   * Record a failed tactic at the active node.
   * Errors are isolated per-node — each branch tracks its own failure history.
   */
  public recordError(error: string): void {
    this.getActiveNode().errorHistory.push(error);
  }

  /**
   * Backtrack: set the active node to the parent of the current active node.
   * Returns the parent node, or null if already at root.
   */
  public backtrackToParent(): ProofNode | null {
    const current = this.getActiveNode();
    if (!current.parentId) return null; // Already at root

    this.markDeadEnd(current.id);
    this.setActiveNode(current.parentId);
    return this.getActiveNode();
  }

  /**
   * Finds the best OPEN node to explore when backtracking.
   * Simple heuristic: node with the fewest errors.
   * Returns null if no OPEN/EXHAUSTED nodes remain (search is stuck).
   */
  public getBestOpenNode(): ProofNode | null {
    let bestNode: ProofNode | null = null;
    let minErrors = Infinity;

    for (const node of this.nodes.values()) {
      if (node.status === "OPEN" || node.status === "EXHAUSTED") {
        if (node.errorHistory.length < minErrors) {
          minErrors = node.errorHistory.length;
          bestNode = node;
        }
      }
    }
    return bestNode;
  }

  // ──────────────────────────────────────────────
  // Sprint 17: Batch Node Selection (Async)
  // ──────────────────────────────────────────────

  /**
   * Retrieves up to N OPEN nodes for concurrent processing,
   * marking them as WORKING to prevent double-selection.
   *
   * @param batchSize - Maximum number of nodes to select
   * @returns Array of ProofNodes now in WORKING status
   */
  public getBestOpenNodes(batchSize: number = 3): ProofNode[] {
    const openNodes = Array.from(this.nodes.values())
      .filter(n => n.status === "OPEN");

    const EXPLORATION_CONSTANT = 1.414;

    // Use UCT (Upper Confidence bound applied to Trees) for sorting
    openNodes.sort((a, b) => {
      const parentA = a.parentId ? this.nodes.get(a.parentId) : null;
      const parentB = b.parentId ? this.nodes.get(b.parentId) : null;

      const visitsA = a.visits || 1; // avoid division by zero
      const visitsB = b.visits || 1;

      const parentVisitsA = parentA ? Math.max(1, parentA.visits) : visitsA;
      const parentVisitsB = parentB ? Math.max(1, parentB.visits) : visitsB;

      const uctA = a.value + EXPLORATION_CONSTANT * Math.sqrt(Math.log(parentVisitsA) / visitsA);
      const uctB = b.value + EXPLORATION_CONSTANT * Math.sqrt(Math.log(parentVisitsB) / visitsB);

      return uctB - uctA; // sort descending
    });

    const selected = openNodes.slice(0, batchSize);
    selected.forEach(node => {
      node.status = "WORKING"; // Lock to prevent concurrent re-selection
    });

    return selected;
  }

  // ──────────────────────────────────────────────
  // MCTS Algorithms
  // ──────────────────────────────────────────────

  /**
   * MCTS Backpropagation: Updates node values and visit counts up to the root.
   * Uses incremental moving average for the Q-value.
   */
  public backpropagate(nodeId: string, score: number): void {
    let current: ProofNode | undefined = this.nodes.get(nodeId);
    while (current) {
      current.visits += 1;
      current.value += (score - current.value) / current.visits;

      if (!current.parentId) break;
      current = this.nodes.get(current.parentId);
    }
  }

  /**
   * MCTS Node Expansion: Spawns multiple children from LLM tactic generation.
   * Can accept an optional envId from the interactive REPL.
   */
  public expand(parentId: string, candidates: Array<{ tactic: string, state: string, envId?: number }>): ProofNode[] {
    const children: ProofNode[] = [];
    for (const c of candidates) {
      const child = this.addChild(parentId, c.tactic, c.state);
      if (c.envId !== undefined) {
          child.envId = c.envId;
      }
      children.push(child);
    }
    return children;
  }

  // ──────────────────────────────────────────────
  // Sprint 19: AND/OR Multi-Goal Handling
  // ──────────────────────────────────────────────

  /**
   * Handles a tactic that splits the proof into multiple subgoals.
   * Creates an intermediate AND node for the tactic, then attaches
   * individual OR state nodes for each subgoal.
   *
   * @param parentId - Parent node where the tactic was applied
   * @param tactic - The tactic that caused the split (e.g., "induction n")
   * @param subgoals - Array of individual goal state strings
   * @returns Array of the created subgoal ProofNodes
   */
  public addAndChildren(parentId: string, tactic: string, subgoals: string[]): ProofNode[] {
    const parent = this.nodes.get(parentId);
    if (!parent) throw new Error("Parent node not found");

    // 1. Create intermediate AND node representing the tactic execution
    const andNode: ProofNode = {
      id: randomUUID(),
      parentId: parent.id,
      tacticApplied: tactic,
      leanState: `[TACTIC SPLIT] ${tactic}`,
      status: "OPEN",
      childrenIds: [],
      depth: parent.depth + 1,
      visits: 0,
      errorHistory: [],
      splitType: "AND",
      value: 0.5,
      envId: undefined,
    };
    this.nodes.set(andNode.id, andNode);
    parent.childrenIds.push(andNode.id);

    // 2. Create individual OR state nodes for each subgoal
    const createdSubgoals: ProofNode[] = [];
    for (const goalState of subgoals) {
      const childNode: ProofNode = {
        id: randomUUID(),
        parentId: andNode.id,
        tacticApplied: null,
        leanState: goalState,
        status: "OPEN",
        childrenIds: [],
        depth: andNode.depth + 1,
        visits: 0,
        errorHistory: [],
        splitType: "OR",
        value: 0.5,
        envId: undefined,
      };
      this.nodes.set(childNode.id, childNode);
      andNode.childrenIds.push(childNode.id);
      createdSubgoals.push(childNode);
    }

    return createdSubgoals;
  }

  // ──────────────────────────────────────────────
  // Sprint 12b: Frontier Digest
  // ──────────────────────────────────────────────

  /**
   * Calculates the TOTAL number of failed attempts across all active nodes.
   * Only counts OPEN and EXHAUSTED nodes — solved and dead-end branches
   * are excluded because they no longer participate in the search.
   */
  public getGlobalTreeFailures(): number {
    let total = 0;
    for (const node of this.nodes.values()) {
      if (node.status === "OPEN" || node.status === "EXHAUSTED") {
        total += node.errorHistory.length;
      }
    }
    return total;
  }

  /**
   * Reconstructs the tactic chain from root to a given node.
   * Returns an array of tactic strings in application order.
   */
  public getPath(nodeId: string): string[] {
    const path: string[] = [];
    let current = this.nodes.get(nodeId);

    while (current && current.parentId) {
      if (current.tacticApplied) path.unshift(current.tacticApplied);
      current = this.nodes.get(current.parentId) ?? undefined;
    }

    return path;
  }

  /**
   * EXPERT-VETTED FRONTIER DIGEST (Token-Optimized)
   *
   * Walks the tree and summarizes ONLY the leaf nodes currently available
   * for exploration (OPEN or EXHAUSTED). SOLVED and DEAD_END nodes are
   * excluded entirely — the Architect only sees the active search frontier.
   *
   * Aligned with AlphaProof separation of symbolic engine from policy network.
   */
  public buildFrontierDigest(): string {
    let digest = `🌳 PROOF TREE FRONTIER DIGEST\n`;
    digest += `Global Failures: ${this.getGlobalTreeFailures()}\n\n`;

    const frontierNodes = Array.from(this.nodes.values())
      .filter(node => node.status === "OPEN" || node.status === "EXHAUSTED");

    if (frontierNodes.length === 0) {
      digest += `  ⚠️ [CRITICAL] No open nodes found in the tree. Search is stuck.\n`;
      return digest;
    }

    frontierNodes.forEach((node, index) => {
      // 1. Path tracing
      const pathTactics = this.getPath(node.id);
      const pathStr = pathTactics.map(t => `\`${t}\``).join(" → ");

      digest += `▶ BRANCH [${index + 1}] (ID: ${node.id})\n`;
      digest += `  Path: ${pathStr}\n`;
      digest += `  Status: ${node.status} (${node.errorHistory.length} failures)\n`;

      // 2. Goal state analysis
      if (node.leanState.includes("no goals")) {
        digest += `  Goal Status: SOLVED\n`;
      } else {
        const remainingGoals = (node.leanState.match(/⊢/g) || []).length;
        digest += `  Remaining Goals: ${remainingGoals}\n`;
        digest += `  Current Lean State:\n${this.formatAsLeanComment(node.leanState)}\n`;
      }

      // 3. Error analysis — only show the last (most recent) error
      if (node.errorHistory.length > 0) {
        const lastError = node.errorHistory[node.errorHistory.length - 1]!;
        const truncatedError = lastError.split("\n")[0]!.substring(0, 100);
        digest += `  Latest Error: "${truncatedError}"\n`;
      }

      digest += `\n`;
    });

    return digest;
  }

  // ──────────────────────────────────────────────
  // Sprint 16: Winning Path Extraction
  // ──────────────────────────────────────────────

  /**
   * Traces back from a SOLVED leaf node to the root, returning the successful path.
   * Returns an array of nodes ordered Root → Leaf.
   *
   * @param solvedNodeId - ID of the SOLVED leaf node
   * @returns Array of ProofNodes from root to solved leaf
   * @throws If the target node doesn't exist or is not SOLVED
   */
  public getWinningPath(solvedNodeId: string): ProofNode[] {
    const target = this.nodes.get(solvedNodeId);
    if (!target || target.status !== "SOLVED") {
      throw new Error("Target node is not a SOLVED node.");
    }

    const path: ProofNode[] = [];
    let current: ProofNode | undefined = target;

    while (current) {
      path.unshift(current); // Prepend so final array is Root → Leaf
      if (!current.parentId) break;
      current = this.nodes.get(current.parentId);
    }

    return path;
  }

  /**
   * Formats raw Lean 4 state as indented comment lines for the digest.
   */
  private formatAsLeanComment(state: string): string {
    return state.split("\n").map(line => `  -- ${line}`).join("\n");
  }
}
