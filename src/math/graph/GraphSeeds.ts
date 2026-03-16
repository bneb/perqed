/**
 * Graph Seeds — Algebraic graph constructions for SA seeding.
 *
 * These provide structured starting points that are much closer to
 * valid Ramsey witnesses than random graphs.
 */

import { AdjacencyMatrix } from "./AdjacencyMatrix";

/**
 * Paley graph on p vertices (p must be prime, p ≡ 1 mod 4).
 *
 * Vertices: {0, 1, ..., p-1}
 * Edge (i,j) iff (i-j) is a quadratic residue mod p.
 *
 * Paley graphs are self-complementary and strongly regular
 * with parameters (p, (p-1)/2, (p-5)/4, (p-1)/4).
 *
 * The Paley(17) graph is the unique R(4,4) witness.
 */
export function paleyGraph(p: number): AdjacencyMatrix {
  if (!isPrime(p)) throw new Error(`Paley graph requires prime p, got ${p}`);
  if (p % 4 !== 1) throw new Error(`Paley graph requires p ≡ 1 mod 4, got p ≡ ${p % 4} mod 4`);

  const adj = new AdjacencyMatrix(p);

  // Compute quadratic residues mod p
  const isQR = new Set<number>();
  for (let i = 1; i < p; i++) {
    isQR.add((i * i) % p);
  }

  // Add edges for quadratic residue differences
  for (let i = 0; i < p; i++) {
    for (let j = i + 1; j < p; j++) {
      const diff = ((j - i) % p + p) % p;
      if (isQR.has(diff)) {
        adj.addEdge(i, j);
      }
    }
  }

  return adj;
}

/**
 * Circulant graph C(n, S) — connect i to j iff |i-j| mod n ∈ S.
 *
 * @param n Number of vertices
 * @param connections Set of distances that create edges
 */
export function circulantGraph(n: number, connections: number[]): AdjacencyMatrix {
  const adj = new AdjacencyMatrix(n);
  const connSet = new Set(connections);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const diff = Math.min((j - i + n) % n, (i - j + n) % n);
      if (connSet.has(diff)) {
        adj.addEdge(i, j);
      }
    }
  }

  return adj;
}

/**
 * Perturbed copy — clone a graph and randomly flip `count` edges.
 * Useful for creating diverse starting points from a known seed.
 */
export function perturbGraph(adj: AdjacencyMatrix, count: number): AdjacencyMatrix {
  const g = adj.clone();
  const n = g.n;

  for (let k = 0; k < count; k++) {
    const u = Math.floor(Math.random() * n);
    let v = Math.floor(Math.random() * (n - 1));
    if (v >= u) v++;

    if (g.hasEdge(u, v)) {
      g.removeEdge(u, v);
    } else {
      g.addEdge(u, v);
    }
  }

  return g;
}

function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}
