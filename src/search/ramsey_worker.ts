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
  ramseyEnergyDeltaBatch,
  flipEdge,
} from "../math/graph/RamseyEnergy";
import {
  getEdgesForDistance,
  buildCirculantGraph,
  extractDistanceColors,
} from "./symmetry";

import type { SearchTelemetry } from "./search_failure_digest";

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
  /** Optional: start from this graph instead of random */
  initialGraph?: AdjacencyMatrix;
  /**
   * Symmetry constraint for the search space.
   * - 'none' (default): unconstrained search on 2^C(n,2) graphs
   * - 'circulant': restrict to circulant graphs (2^floor(n/2) states)
   *
   * For R(4,6) on n=35: reduces space from 2^595 → 2^17.
   * The known Exoo (1989) witness IS a circulant graph.
   */
  symmetry?: 'none' | 'circulant';
}

export interface RamseySearchResult {
  /** Best energy found */
  bestEnergy: number;
  /** The witness graph (if E=0) */
  witness: AdjacencyMatrix | null;
  /** Best graph regardless of energy (for LNS repair when E>0) */
  bestAdj: AdjacencyMatrix;
  /** Total iterations performed */
  iterations: number;
  /** Iterations per second */
  ips: number;
  /** Full thermodynamic telemetry for diagnosis */
  telemetry: SearchTelemetry;
}

/**
 * Run a single SA worker searching for a Ramsey witness.
 */
export function ramseySearch(
  config: RamseySearchConfig,
  onProgress?: (iter: number, energy: number, bestEnergy: number, temp: number) => void,
): RamseySearchResult {
  const { n, r, s, maxIterations, initialTemp, coolingRate } = config;
  const useCirculant = config.symmetry === 'circulant';
  // For circulant search, track distance colors (17 bits for N=35)
  let distanceColors: Map<number, number> | null = null;
  const maxDist = Math.floor(n / 2);
  // Adaptive reheat: patience = % of budget, strength decays over time
  const minPatience = Math.max(100_000, Math.floor(maxIterations * 0.1));

  // Initialize: use seed graph, or random (circulant or unconstrained)
  let adj: AdjacencyMatrix;
  if (config.initialGraph) {
    adj = config.initialGraph.clone();
    if (useCirculant) {
      distanceColors = extractDistanceColors(adj, n);
    }
  } else if (useCirculant) {
    // Circulant init: assign random color (0=absent, 1=present) to each distance
    distanceColors = new Map<number, number>();
    for (let d = 1; d <= maxDist; d++) {
      distanceColors.set(d, Math.floor(Math.random() * 2));
    }
    adj = buildCirculantGraph(distanceColors, n);
  } else {
    adj = new AdjacencyMatrix(n);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.random() < 0.5) adj.addEdge(i, j);
      }
    }
  }

  let energy = ramseyEnergy(adj, r, s);
  let bestEnergy = energy;
  let bestAdj = adj.clone();
  let temp = initialTemp;
  let staleCount = 0;
  let reheatCount = 0;

  // Trajectory tracking: 10 checkpoints at 10%, 20%, ..., 100%
  const checkpointInterval = Math.max(1, Math.floor(maxIterations / 10));
  const energyTrajectory: number[] = [];
  const temperatureTrajectory: number[] = [];

  const startTime = Date.now();

  for (let iter = 0; iter < maxIterations; iter++) {
    let delta: number;

    if (useCirculant && distanceColors) {
      // ── Circulant mutation: flip all N edges at a random distance ──
      const mutatedDist = Math.floor(Math.random() * maxDist) + 1;
      const affectedEdges = getEdgesForDistance(mutatedDist, n);

      // Batch delta: apply all flips, measure Δ, roll back
      delta = ramseyEnergyDeltaBatch(adj, affectedEdges, r, s);

      // Metropolis acceptance
      if (delta <= 0 || Math.random() < Math.exp(-delta / temp)) {
        // Accept: apply all flips permanently
        const oldColor = distanceColors.get(mutatedDist)!;
        const newColor = 1 - oldColor;
        distanceColors.set(mutatedDist, newColor);
        for (const [u, v] of affectedEdges) flipEdge(adj, u, v);
        energy += delta;

        if (energy < bestEnergy) {
          bestEnergy = energy;
          bestAdj = adj.clone();
          staleCount = 0;

          if (energy === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            const ips = elapsed > 0 ? Math.round(iter / elapsed) : Infinity;
            while (energyTrajectory.length < 10) energyTrajectory.push(0);
            while (temperatureTrajectory.length < 10) temperatureTrajectory.push(temp);
            return {
              bestEnergy: 0, witness: bestAdj, bestAdj, iterations: iter, ips,
              telemetry: {
                bestEnergy: 0, finalEnergy: 0, finalTemperature: temp,
                initialTemperature: initialTemp, totalIterations: iter,
                ips, wallTimeSeconds: elapsed, reheatCount,
                energyTrajectory, temperatureTrajectory,
              },
            };
          }
        }
      }
      // Reject: ramseyEnergyDeltaBatch already rolled back — nothing to do
    } else {
      // ── Standard unconstrained mutation: flip one random edge ──
      const u = Math.floor(Math.random() * n);
      let v = Math.floor(Math.random() * (n - 1));
      if (v >= u) v++;

      delta = ramseyEnergyDelta(adj, u, v, r, s);

      // Metropolis acceptance
      if (delta <= 0 || Math.random() < Math.exp(-delta / temp)) {
        flipEdge(adj, u, v);
        energy += delta;

        if (energy < bestEnergy) {
          bestEnergy = energy;
          bestAdj = adj.clone();
          staleCount = 0;

          if (energy === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            const ips = elapsed > 0 ? Math.round(iter / elapsed) : Infinity;
            while (energyTrajectory.length < 10) energyTrajectory.push(0);
            while (temperatureTrajectory.length < 10) temperatureTrajectory.push(temp);
            return {
              bestEnergy: 0, witness: bestAdj, bestAdj, iterations: iter, ips,
              telemetry: {
                bestEnergy: 0, finalEnergy: 0, finalTemperature: temp,
                initialTemperature: initialTemp, totalIterations: iter,
                ips, wallTimeSeconds: elapsed, reheatCount,
                energyTrajectory, temperatureTrajectory,
              },
            };
          }
        }
      }
    }

    // Cooling
    temp *= coolingRate;
    staleCount++;

    // Adaptive reheat: fires only when stuck long enough, strength proportional to stale duration
    if (staleCount >= minPatience) {
      // Reheat strength: how much of the budget has been spent stuck?
      const staleFraction = staleCount / maxIterations;
      // Reheat to a fraction of initialTemp, proportional to how stuck we are
      // staleFraction=0.1 → mild reheat (30% of T₀), staleFraction=0.5 → strong reheat (80% of T₀)
      const reheatStrength = Math.min(0.9, 0.2 + staleFraction * 1.5);
      temp = initialTemp * reheatStrength;
      staleCount = 0;
      reheatCount++;
    }

    // Trajectory checkpoint
    if ((iter + 1) % checkpointInterval === 0 && energyTrajectory.length < 10) {
      energyTrajectory.push(bestEnergy);
      temperatureTrajectory.push(temp);
    }

    // Progress callback
    if (onProgress && iter % 10000 === 0) {
      onProgress(iter, energy, bestEnergy, temp);
    }
  }

  // Fill trajectory if needed
  while (energyTrajectory.length < 10) energyTrajectory.push(bestEnergy);
  while (temperatureTrajectory.length < 10) temperatureTrajectory.push(temp);

  const elapsed = (Date.now() - startTime) / 1000;
  const ips = elapsed > 0 ? Math.round(maxIterations / elapsed) : Infinity;

  return {
    bestEnergy,
    witness: bestEnergy === 0 ? bestAdj : null,
    bestAdj,
    iterations: maxIterations,
    ips,
    telemetry: {
      bestEnergy, finalEnergy: energy, finalTemperature: temp,
      initialTemperature: initialTemp, totalIterations: maxIterations,
      ips, wallTimeSeconds: elapsed, reheatCount,
      energyTrajectory, temperatureTrajectory,
    },
  };
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
