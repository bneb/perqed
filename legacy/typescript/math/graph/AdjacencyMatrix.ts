/**
 * AdjacencyMatrix — Flat Uint8Array representation of an undirected graph.
 *
 * Reusable across all graph existence problems. Stores the upper triangle
 * of the adjacency matrix in a flat array for cache-friendly access.
 */

export class AdjacencyMatrix {
  readonly n: number;
  private readonly data: Uint8Array;

  constructor(n: number) {
    this.n = n;
    // Store full n×n matrix for O(1) symmetric access
    this.data = new Uint8Array(n * n);
  }

  private idx(u: number, v: number): number {
    return u * this.n + v;
  }

  hasEdge(u: number, v: number): boolean {
    return this.data[this.idx(u, v)] === 1;
  }

  addEdge(u: number, v: number): void {
    this.data[this.idx(u, v)] = 1;
    this.data[this.idx(v, u)] = 1;
  }

  removeEdge(u: number, v: number): void {
    this.data[this.idx(u, v)] = 0;
    this.data[this.idx(v, u)] = 0;
  }

  degree(v: number): number {
    let d = 0;
    const base = v * this.n;
    for (let j = 0; j < this.n; j++) {
      d += this.data[base + j]!;
    }
    return d;
  }

  neighbors(v: number): number[] {
    const result: number[] = [];
    const base = v * this.n;
    for (let j = 0; j < this.n; j++) {
      if (this.data[base + j] === 1) result.push(j);
    }
    return result;
  }

  edgeCount(): number {
    let count = 0;
    for (let i = 0; i < this.n; i++) {
      for (let j = i + 1; j < this.n; j++) {
        if (this.data[this.idx(i, j)] === 1) count++;
      }
    }
    return count;
  }

  clone(): AdjacencyMatrix {
    const g = new AdjacencyMatrix(this.n);
    g.data.set(this.data);
    return g;
  }

  /** The raw data buffer (for fast Lean export). */
  get raw(): Uint8Array {
    return this.data;
  }

  /**
   * Scatter: randomly flip each edge in the upper triangle with probability
   * `mutationRate`. Used by the Progressive Thermal Reheating system to
   * teleport the graph to a new region of the search space when a basin
   * proves inescapable after `MAX_LOCAL_REHEATS` consecutive failed escape
   * attempts.
   *
   * @param mutationRate  Fraction of edges to flip in [0, 1].
   *                      0 = no-op; 1 = flip every edge (full complement).
   */
  scatter(mutationRate: number): void {
    for (let i = 0; i < this.n; i++) {
      for (let j = i + 1; j < this.n; j++) {
        if (Math.random() < mutationRate) {
          if (this.hasEdge(i, j)) {
            this.removeEdge(i, j);
          } else {
            this.addEdge(i, j);
          }
        }
      }
    }
  }

  /**
   * Generate a random k-regular graph on n vertices.
   *
   * Uses a two-phase approach:
   *   1. Greedy: repeatedly pair under-degree vertices with random edges
   *   2. Repair: fix any remaining degree violations via edge swaps
   */
  static randomRegular(n: number, k: number): AdjacencyMatrix {
    if ((n * k) % 2 !== 0) {
      throw new Error(`n*k must be even: n=${n}, k=${k}`);
    }

    for (let attempt = 0; attempt < 200; attempt++) {
      const g = new AdjacencyMatrix(n);
      const deg = new Int32Array(n);

      // Phase 1: Greedy edge assignment
      // Shuffle vertices, try to pair under-degree ones
      const verts = Array.from({ length: n }, (_, i) => i);

      for (let round = 0; round < k; round++) {
        // Shuffle
        for (let i = verts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [verts[i], verts[j]] = [verts[j]!, verts[i]!];
        }

        // Try to pair consecutive under-degree vertices
        for (let i = 0; i < n - 1; i += 2) {
          const u = verts[i]!;
          const v = verts[i + 1]!;
          if (u !== v && !g.hasEdge(u, v) && deg[u]! < k && deg[v]! < k) {
            g.addEdge(u, v);
            deg[u]!++;
            deg[v]!++;
          }
        }
      }

      // Phase 2: Repair — add missing edges for under-degree vertices
      let repairAttempts = 0;
      while (repairAttempts < n * k * 10) {
        // Find under-degree vertices
        const under: number[] = [];
        for (let v = 0; v < n; v++) {
          if (deg[v]! < k) under.push(v);
        }
        if (under.length === 0) break;

        // Try random pair from under-degree set
        if (under.length >= 2) {
          const i = Math.floor(Math.random() * under.length);
          let j = Math.floor(Math.random() * (under.length - 1));
          if (j >= i) j++;
          const u = under[i]!;
          const v = under[j]!;
          if (!g.hasEdge(u, v)) {
            g.addEdge(u, v);
            deg[u]!++;
            deg[v]!++;
          }
        }
        repairAttempts++;
      }

      // Verify
      let valid = true;
      for (let v = 0; v < n; v++) {
        if (g.degree(v) !== k) {
          valid = false;
          break;
        }
      }
      if (valid) return g;
    }

    throw new Error(`Failed to generate random ${k}-regular graph on ${n} vertices after 200 attempts`);
  }
}
