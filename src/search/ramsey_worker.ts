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
  let reheatCount = 0;

  // Trajectory tracking: 10 checkpoints at 10%, 20%, ..., 100%
  const checkpointInterval = Math.max(1, Math.floor(maxIterations / 10));
  const energyTrajectory: number[] = [];
  const temperatureTrajectory: number[] = [];

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
          const ips = elapsed > 0 ? Math.round(iter / elapsed) : Infinity;
          // Fill remaining trajectory points
          while (energyTrajectory.length < 10) energyTrajectory.push(0);
          while (temperatureTrajectory.length < 10) temperatureTrajectory.push(temp);
          return {
            bestEnergy: 0,
            witness: bestAdj,
            iterations: iter,
            ips,
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

    // Cooling
    temp *= coolingRate;
    staleCount++;

    // Reheat if stuck
    if (staleCount >= reheatAfter) {
      temp = reheatTemp;
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
