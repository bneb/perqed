/**
 * ZobristHasher — Incremental O(1) Graph Hashing for Tabu Search
 *
 * Maps every graph state (adjacency matrix) to a 64-bit BigInt using Zobrist
 * hashing. The key property is:
 *
 *   toggleEdge(hash, u, v) === computeInitial(graphAfterFlippingEdge(u,v))
 *
 * This means the SA worker can maintain a running hash at zero cost during the
 * mutation loop — no matrix scan, just one XOR per accepted mutation.
 *
 * Deterministic initialization: pass an optional `seed` BigInt so tests can
 * verify exact values across runs. Production usage can use the default random
 * seed (Date.now() based) or any fixed value for reproducibility.
 */

import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";

// ─────────────────────────────────────────────────────────────────────────────
// Pseudo-random BigInt generator (deterministic, 64-bit output)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Splitmix64 — fast, high-quality 64-bit PRNG.
 * Returns a generator function that emits successive 64-bit BigInt values
 * from the given seed.
 */
function splitmix64(seed: bigint): () => bigint {
  const MASK64 = (1n << 64n) - 1n;
  let s = seed & MASK64;
  return () => {
    s = (s + 0x9e3779b97f4a7c15n) & MASK64;
    let z = s;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
    return z ^ (z >> 31n);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ZobristHasher
// ─────────────────────────────────────────────────────────────────────────────

export class ZobristHasher {
  private readonly n: number;
  /**
   * table[u][v] is the random 64-bit value XORed in when edge (u,v) is PRESENT.
   *
   * We only need one entry per undirected edge (u < v); the table is symmetric:
   * table[u][v] === table[v][u] so that toggleEdge(u,v) and toggleEdge(v,u) are
   * equivalent — the graph is undirected.
   */
  private readonly table: bigint[][];

  /**
   * @param n    - Number of vertices in the graph
   * @param seed - Optional deterministic seed (default: randomised from Date.now)
   */
  constructor(n: number, seed?: bigint) {
    this.n = n;
    const rng = splitmix64(seed ?? BigInt(Date.now()) ^ 0xdeadbeef1337n);

    // Allocate and fill the Zobrist table.
    // table[u][v] = random 64-bit value associated with edge {u,v} being present.
    // Stored symmetrically so toggleEdge(u,v) === toggleEdge(v,u).
    this.table = Array.from({ length: n }, () => new Array<bigint>(n).fill(0n));

    for (let u = 0; u < n; u++) {
      for (let v = u + 1; v < n; v++) {
        const rand = rng();
        this.table[u]![v] = rand;
        this.table[v]![u] = rand; // symmetric — same random value
      }
    }
  }

  /**
   * Compute the hash of a full graph from scratch.
   * O(n²) — only called once to initialize the running hash.
   *
   * @param adj - The graph to hash
   * @returns A 64-bit BigInt hash of the current adjacency structure
   */
  computeInitial(adj: AdjacencyMatrix): bigint {
    let hash = 0n;
    for (let u = 0; u < this.n; u++) {
      for (let v = u + 1; v < this.n; v++) {
        if (adj.hasEdge(u, v)) {
          hash ^= this.table[u]![v]!;
        }
      }
    }
    return hash;
  }

  /**
   * Incrementally update the hash after toggling edge {u,v}.
   * O(1) — just one XOR.
   *
   * Works because XOR is its own inverse: if edge is present, XORing its value
   * removes it from the hash; if absent, XORing adds it.
   *
   * @param currentHash - The hash of the graph BEFORE the toggle
   * @param u           - First endpoint of the edge to toggle
   * @param v           - Second endpoint of the edge to toggle
   * @returns The hash of the graph AFTER toggling edge {u,v}
   */
  toggleEdge(currentHash: bigint, u: number, v: number): bigint {
    return currentHash ^ this.table[u]![v]!;
  }
}
