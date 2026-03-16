/**
 * Ramsey SA Worker — Simulated Annealing search for Ramsey witnesses.
 *
 * State:   AdjacencyMatrix (undirected, simple graph on n vertices)
 * Mutation: flip one random edge
 * Energy:  ramseyEnergy(adj, r, s) = (# red K_r) + (# blue K_s)
 * Goal:    E = 0  →  valid R(r,s) lower bound witness
 */

import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import {
  ramseyEnergy,
  ramseyEnergyDelta,
  flipEdge,
} from "../math/graph/RamseyEnergy";

export interface RamseySearchConfig {
  /** Number of vertices in the graph */
  n: number;
  /** Clique size (red) */
  r: number;
  /** Independent set size (blue) */
  s: number;
  /** Maximum SA iterations per worker */
  maxIterations: number;
  /** Initial temperature */
  initialTemp: number;
  /** Cooling rate (multiplied each step, e.g. 0.99999) */
  coolingRate: number;
  /** Reheat temperature when stuck */
  reheatTemp: number;
  /** Iterations without improvement before reheat */
  reheatAfter: number;
}

export interface RamseySearchResult {
  /** Best energy found */
  bestEnergy: number;
  /** The witness graph (if E=0) */
  witness: AdjacencyMatrix | null;
  /** Total iterations performed */
  iterations: number;
  /** Iterations per second */
  ips: number;
}

/**
 * Run a single SA worker searching for a Ramsey witness.
 *
 * @param config SA search configuration
 * @param onProgress Optional callback for progress reporting
 * @returns search result with best energy and witness (if found)
 */
export function ramseySearch(
  config: RamseySearchConfig,
  onProgress?: (iter: number, energy: number, bestEnergy: number, temp: number) => void,
): RamseySearchResult {
  const { n, r, s, maxIterations, initialTemp, coolingRate, reheatTemp, reheatAfter } = config;

  // Initialize random graph (~50% density)
  const adj = new AdjacencyMatrix(n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.random() < 0.5) adj.addEdge(i, j);
    }
  }

  let energy = ramseyEnergy(adj, r, s);
  let bestEnergy = energy;
  let bestAdj = adj.clone();
  let temp = initialTemp;
  let staleCount = 0;

  const startTime = Date.now();

  for (let iter = 0; iter < maxIterations; iter++) {
    // Pick random edge to flip
    const u = Math.floor(Math.random() * n);
    let v = Math.floor(Math.random() * (n - 1));
    if (v >= u) v++;

    // Compute delta
    const delta = ramseyEnergyDelta(adj, u, v, r, s);

    // Metropolis acceptance
    if (delta <= 0 || Math.random() < Math.exp(-delta / temp)) {
      flipEdge(adj, u, v);
      energy += delta;

      if (energy < bestEnergy) {
        bestEnergy = energy;
        bestAdj = adj.clone();
        staleCount = 0;

        if (energy === 0) {
          // 🏆 Found witness!
          const elapsed = (Date.now() - startTime) / 1000;
          const ips = Math.round(iter / elapsed);
          return { bestEnergy: 0, witness: bestAdj, iterations: iter, ips };
        }
      }
    }

    // Cooling
    temp *= coolingRate;
    staleCount++;

    // Reheat if stuck
    if (staleCount >= reheatAfter) {
      temp = reheatTemp;
      staleCount = 0;
    }

    // Progress callback
    if (onProgress && iter % 10000 === 0) {
      onProgress(iter, energy, bestEnergy, temp);
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  const ips = Math.round(maxIterations / elapsed);
  return { bestEnergy, witness: bestEnergy === 0 ? bestAdj : null, iterations: maxIterations, ips };
}

/**
 * Export adjacency matrix as a flat boolean[][] for Lean codegen.
 */
export function adjToMatrix(adj: AdjacencyMatrix): boolean[][] {
  const n = adj.n;
  const result: boolean[][] = [];
  for (let i = 0; i < n; i++) {
    const row: boolean[] = [];
    for (let j = 0; j < n; j++) {
      row.push(adj.hasEdge(i, j));
    }
    result.push(row);
  }
  return result;
}
