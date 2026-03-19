/**
 * neighborhood_funnel.ts — TS neighborhood mutator + surrogate funnel orchestrator.
 *
 * Generates hundreds of cheap edge-flip mutations of an LLM-synthesised base
 * matrix, ranks them via the PyTorch surrogate model, and returns the most
 * promising candidate to the exact C++ evaluator.
 */

import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import { SurrogateClient } from "./surrogate_client";

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Flatten the upper triangle of an adjacency matrix to a binary string,
 * matching the format expected by the Python Value Network.
 *
 * For N=35: length = 35*34/2 = 595 characters.
 */
export function flattenMatrix(adj: AdjacencyMatrix): string {
  const n = adj.n;
  const chars: string[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      chars.push(adj.hasEdge(i, j) ? "1" : "0");
    }
  }
  return chars.join("");
}

// ── Neighbourhood Generation ──────────────────────────────────────────────────

/**
 * Generate `count` neighbours of `baseMatrix` by randomly flipping between
 * 1 and `maxFlips` edges in the upper triangle.  Symmetry is always enforced.
 *
 * The base matrix is never mutated.
 *
 * @param baseMatrix  Starting adjacency matrix (read-only)
 * @param count       Number of mutant neighbours to produce
 * @param maxFlips    Maximum number of edges to flip per neighbour (default 3)
 */
export function generateNeighbors(
  baseMatrix: AdjacencyMatrix,
  count: number,
  maxFlips: number = 3
): AdjacencyMatrix[] {
  const n = baseMatrix.n;

  // Pre-build the list of upper-triangle (i,j) pairs once
  const upperTriangle: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      upperTriangle.push([i, j]);
    }
  }
  const edgeCount = upperTriangle.length;

  const neighbors: AdjacencyMatrix[] = [];

  for (let k = 0; k < count; k++) {
    const neighbor = baseMatrix.clone();

    // Pick a random number of flips in [1..maxFlips]
    const numFlips = 1 + Math.floor(Math.random() * maxFlips);

    // Fisher-Yates partial shuffle to pick numFlips distinct indices efficiently
    const indices = Array.from({ length: edgeCount }, (_, i) => i);
    for (let f = 0; f < numFlips; f++) {
      const swapIdx = f + Math.floor(Math.random() * (edgeCount - f));
      [indices[f], indices[swapIdx]] = [indices[swapIdx]!, indices[f]!];
    }

    for (let f = 0; f < numFlips; f++) {
      const [i, j] = upperTriangle[indices[f]!]!;
      if (neighbor.hasEdge(i, j)) {
        neighbor.removeEdge(i, j); // removeEdge enforces symmetry
      } else {
        neighbor.addEdge(i, j); // addEdge enforces symmetry
      }
    }

    neighbors.push(neighbor);
  }

  return neighbors;
}

// ── Funnel Orchestrator ───────────────────────────────────────────────────────

export interface FunnelResult {
  bestMatrix: AdjacencyMatrix;
  predictedEnergy: number;
}

/**
 * Run 500 neighbourhood mutations through the surrogate model concurrently and
 * return the neighbour with the lowest predicted energy.
 *
 * @param baseMatrix    LLM-compiled adjacency matrix to search from
 * @param client        SurrogateClient pointing at the FastAPI server
 * @param neighborCount Number of neighbours to generate (default 500)
 * @param maxFlips      Max edge flips per neighbour (default 3)
 */
export async function optimizeThroughFunnel(
  baseMatrix: AdjacencyMatrix,
  client: SurrogateClient = new SurrogateClient(),
  neighborCount: number = 500,
  maxFlips: number = 3
): Promise<FunnelResult> {
  // 1. Generate neighbours
  const neighbors = generateNeighbors(baseMatrix, neighborCount, maxFlips);

  // 2. Flatten all matrices to binary strings
  const flats = neighbors.map(flattenMatrix);

  // 3. Concurrently predict energies for all neighbours
  const predictedEnergies = await Promise.all(flats.map((f) => client.predict(f)));

  // 4. Sort ascending by predicted energy, pick the winner
  let bestIdx = 0;
  let bestEnergy = predictedEnergies[0]!;
  for (let i = 1; i < predictedEnergies.length; i++) {
    if (predictedEnergies[i]! < bestEnergy) {
      bestEnergy = predictedEnergies[i]!;
      bestIdx = i;
    }
  }

  return {
    bestMatrix: neighbors[bestIdx]!,
    predictedEnergy: bestEnergy,
  };
}
