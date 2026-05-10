/**
 * DegreePreservingSwap — Edge swap mutation for k-regular graphs.
 *
 * Picks two random edges (a,b) and (c,d), removes them, and adds
 * either (a,c)+(b,d) or (a,d)+(b,c). This preserves the degree of
 * all four vertices.
 *
 * Returns a new AdjacencyMatrix (immutable), or null if no valid
 * swap could be found after a few attempts.
 */

import { AdjacencyMatrix } from "./AdjacencyMatrix";

/**
 * Perform a single degree-preserving edge swap.
 *
 * @param g - The source graph (not modified)
 * @returns A new AdjacencyMatrix with one edge swap, or null if no valid swap exists
 */
export function degreePreservingSwap(
  g: AdjacencyMatrix,
): AdjacencyMatrix | null {
  const n = g.n;

  // Collect all edges
  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (g.hasEdge(i, j)) edges.push([i, j]);
    }
  }

  if (edges.length < 2) return null;

  // Try up to 20 random pairs of edges
  for (let attempt = 0; attempt < 20; attempt++) {
    const idx1 = Math.floor(Math.random() * edges.length);
    let idx2 = Math.floor(Math.random() * (edges.length - 1));
    if (idx2 >= idx1) idx2++;

    const [a, b] = edges[idx1]!;
    const [c, d] = edges[idx2]!;

    // Ensure all four vertices are distinct
    if (a === c || a === d || b === c || b === d) continue;

    // Try swap variant 1: remove (a,b)+(c,d), add (a,c)+(b,d)
    if (!g.hasEdge(a, c) && !g.hasEdge(b, d)) {
      const h = g.clone();
      h.removeEdge(a, b);
      h.removeEdge(c, d);
      h.addEdge(a, c);
      h.addEdge(b, d);
      return h;
    }

    // Try swap variant 2: remove (a,b)+(c,d), add (a,d)+(b,c)
    if (!g.hasEdge(a, d) && !g.hasEdge(b, c)) {
      const h = g.clone();
      h.removeEdge(a, b);
      h.removeEdge(c, d);
      h.addEdge(a, d);
      h.addEdge(b, c);
      return h;
    }
  }

  return null;
}
