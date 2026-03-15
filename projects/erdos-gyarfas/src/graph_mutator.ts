/**
 * Sprint 22: GraphMutator — Multi-Modal Graph Mutation
 *
 * Performs degree-altering OR degree-preserving mutations on a graph.
 * Three modes: ADD edge, REMOVE edge (safe), 2-OPT swap.
 *
 * INVARIANT: Minimum degree NEVER drops below 3.
 * INVARIANT: No self-loops, no multi-edges.
 */

export class GraphMutator {
  /**
   * Performs a random mutation on the graph.
   * Returns a new adjacency list, or null if the mutation was invalid.
   */
  static mutate(adj: number[][]): number[][] | null {
    const n = adj.length;
    if (n < 4) return null;

    const newAdj = adj.map((neighbors) => [...neighbors]);
    const roll = Math.random();

    if (roll < 0.33) {
      return this.addEdge(newAdj, n);
    } else if (roll < 0.66) {
      return this.removeEdge(newAdj, n);
    } else {
      return this.twoOptSwap(newAdj, n);
    }
  }

  /** Add a random edge between two non-adjacent vertices. */
  private static addEdge(adj: number[][], n: number): number[][] | null {
    const u = Math.floor(Math.random() * n);
    const v = Math.floor(Math.random() * n);

    if (u === v) return null;
    if (adj[u]!.includes(v)) return null;

    adj[u]!.push(v);
    adj[v]!.push(u);
    return adj;
  }

  /** Remove a random edge, but only if both endpoints keep degree >= 3. */
  private static removeEdge(adj: number[][], n: number): number[][] | null {
    const u = Math.floor(Math.random() * n);
    if (adj[u]!.length <= 3) return null;

    const v = adj[u]![Math.floor(Math.random() * adj[u]!.length)]!;
    if (adj[v]!.length <= 3) return null;

    adj[u] = adj[u]!.filter((node) => node !== v);
    adj[v] = adj[v]!.filter((node) => node !== u);
    return adj;
  }

  /** 2-opt swap: remove edges (u,v) and (x,y), add (u,x) and (v,y). */
  private static twoOptSwap(adj: number[][], n: number): number[][] | null {
    const u = Math.floor(Math.random() * n);
    if (adj[u]!.length === 0) return null;
    const v = adj[u]![Math.floor(Math.random() * adj[u]!.length)]!;

    const x = Math.floor(Math.random() * n);
    if (adj[x]!.length === 0) return null;
    const y = adj[x]![Math.floor(Math.random() * adj[x]!.length)]!;

    // All four vertices must be distinct
    if (new Set([u, v, x, y]).size !== 4) return null;
    // New edges must not already exist
    if (adj[u]!.includes(x) || adj[v]!.includes(y)) return null;

    // Remove (u,v) and (x,y)
    adj[u] = adj[u]!.filter((node) => node !== v);
    adj[v] = adj[v]!.filter((node) => node !== u);
    adj[x] = adj[x]!.filter((node) => node !== y);
    adj[y] = adj[y]!.filter((node) => node !== x);

    // Add (u,x) and (v,y)
    adj[u]!.push(x);
    adj[x]!.push(u);
    adj[v]!.push(y);
    adj[y]!.push(v);

    return adj;
  }
}
