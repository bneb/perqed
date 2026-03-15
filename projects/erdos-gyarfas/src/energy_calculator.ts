/**
 * Sprint 22: EnergyCalculator — Power-of-2 Cycle Cost Function
 *
 * Counts the number of simple cycles of length 4, 8, or 16 in a graph.
 * Used as the cost function for simulated annealing: energy 0 = counterexample.
 */

export class EnergyCalculator {
  private static readonly TARGET_LENGTHS = new Set([4, 8, 16]);
  private static readonly MAX_LEN = 16;

  /**
   * Calculates the "energy" of a graph (number of power-of-2 cycles).
   * Lower is better. Energy 0 means no 4/8/16-cycles exist → counterexample!
   */
  static calculateEnergy(adj: number[][]): number {
    const n = adj.length;
    if (n < 4) return 0;

    let totalEnergy = 0;

    for (let startNode = 0; startNode < n; startNode++) {
      const visited = new Set<number>();
      for (let i = 0; i < startNode; i++) visited.add(i); // Symmetry breaking
      totalEnergy += this.dfsCount(adj, startNode, startNode, 1, visited);
    }

    return totalEnergy;
  }

  private static dfsCount(
    adj: number[][],
    startNode: number,
    currentNode: number,
    depth: number,
    visited: Set<number>,
  ): number {
    let count = 0;

    if (this.TARGET_LENGTHS.has(depth)) {
      if (adj[currentNode]!.includes(startNode)) {
        count += 1;
      }
    }

    if (depth >= this.MAX_LEN) return count;

    visited.add(currentNode);
    for (const neighbor of adj[currentNode]!) {
      if (!visited.has(neighbor)) {
        count += this.dfsCount(adj, startNode, neighbor, depth + 1, visited);
      }
    }
    visited.delete(currentNode);

    return count;
  }
}
