/**
 * Ramsey Search Orchestrator — Multi-strategy search dispatcher.
 *
 * Runs multiple SA workers with diverse seeds and strategies,
 * returns the best result. The ARCHITECT can request any strategy
 * via the SearchPhase config.
 */

import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import { paleyGraph, circulantGraph, perturbGraph } from "../math/graph/GraphSeeds";
import { ramseySearch, type RamseySearchConfig, type RamseySearchResult } from "./ramsey_worker";

export type SearchStrategy = "single" | "island_model";
export type SeedType = "random" | "paley" | "circulant";

export interface OrchestratedSearchConfig {
  /** Number of vertices */
  n: number;
  /** Clique size (red) */
  r: number;
  /** Independent set size (blue) */
  s: number;
  /** Total SA iterations per worker */
  saIterations: number;
  /** Search strategy */
  strategy: SearchStrategy;
  /** Number of workers (only for island_model) */
  workers: number;
  /** Seed type for initial graphs */
  seed: SeedType;
  /** Circulant connections (only for seed="circulant") */
  circulantConnections?: number[];
  /** Progress callback */
  onProgress?: (worker: number, iter: number, energy: number, bestEnergy: number, temp: number) => void;
}

export interface OrchestratedSearchResult {
  /** Best result across all workers */
  best: RamseySearchResult;
  /** Number of workers that ran */
  workersRan: number;
  /** Which worker found the best result */
  bestWorkerIndex: number;
  /** Total wall time */
  totalWallTime: number;
}

/**
 * Run the orchestrated search with the given strategy.
 */
export function orchestratedSearch(config: OrchestratedSearchConfig): OrchestratedSearchResult {
  const startTime = Date.now();
  const numWorkers = config.strategy === "island_model" ? config.workers : 1;

  // Build seed graphs
  const seeds = buildSeeds(config, numWorkers);

  // Run workers sequentially (Bun Workers for true parallelism is a future enhancement)
  let bestResult: RamseySearchResult | null = null;
  let bestWorkerIndex = 0;

  for (let w = 0; w < numWorkers; w++) {
    const itersPerWorker = config.strategy === "island_model"
      ? Math.floor(config.saIterations / numWorkers)
      : config.saIterations;

    const edges = config.n * (config.n - 1) / 2;
    const tInit = edges < 50 ? 1.0 : edges < 200 ? 2.0 : edges < 600 ? 3.0 : 5.0;
    const coolingRate = Math.exp(Math.log(0.01 / tInit) / (0.8 * itersPerWorker));

    const saConfig: RamseySearchConfig = {
      n: config.n,
      r: config.r,
      s: config.s,
      maxIterations: itersPerWorker,
      initialTemp: tInit,
      coolingRate,
      initialGraph: seeds[w],
    };

    if (config.onProgress) {
      const workerNum = w;
      const workerProgress = (iter: number, energy: number, best: number, temp: number) => {
        config.onProgress!(workerNum, iter, energy, best, temp);
      };

      const result = ramseySearch(saConfig, workerProgress);
      if (!bestResult || result.bestEnergy < bestResult.bestEnergy) {
        bestResult = result;
        bestWorkerIndex = w;
      }

      // Early exit if witness found
      if (result.bestEnergy === 0) break;
    } else {
      const result = ramseySearch(saConfig);
      if (!bestResult || result.bestEnergy < bestResult.bestEnergy) {
        bestResult = result;
        bestWorkerIndex = w;
      }
      if (result.bestEnergy === 0) break;
    }
  }

  const totalWallTime = (Date.now() - startTime) / 1000;

  return {
    best: bestResult!,
    workersRan: numWorkers,
    bestWorkerIndex,
    totalWallTime,
  };
}

/**
 * Build seed graphs for each worker based on the seed type.
 */
function buildSeeds(
  config: OrchestratedSearchConfig,
  numWorkers: number,
): (AdjacencyMatrix | undefined)[] {
  const seeds: (AdjacencyMatrix | undefined)[] = [];

  switch (config.seed) {
    case "paley": {
      // Check if Paley is possible (n must be prime, ≡ 1 mod 4)
      if (isPaleyEligible(config.n)) {
        const base = paleyGraph(config.n);
        seeds.push(base); // Worker 0 gets the pure Paley
        // Remaining workers get perturbed copies
        for (let i = 1; i < numWorkers; i++) {
          const perturbCount = Math.floor(config.n * (i / numWorkers));
          seeds.push(perturbGraph(base, perturbCount));
        }
      } else {
        // Fall through to random if Paley not possible
        for (let i = 0; i < numWorkers; i++) seeds.push(undefined);
      }
      break;
    }

    case "circulant": {
      if (config.circulantConnections && config.circulantConnections.length > 0) {
        const base = circulantGraph(config.n, config.circulantConnections);
        seeds.push(base);
        for (let i = 1; i < numWorkers; i++) {
          seeds.push(perturbGraph(base, Math.floor(config.n * 0.5)));
        }
      } else {
        for (let i = 0; i < numWorkers; i++) seeds.push(undefined);
      }
      break;
    }

    case "random":
    default: {
      // All workers start from random (undefined = random init in worker)
      for (let i = 0; i < numWorkers; i++) seeds.push(undefined);
      break;
    }
  }

  return seeds;
}

function isPaleyEligible(n: number): boolean {
  if (n < 5 || n % 4 !== 1) return false;
  // Check primality
  if (n < 4) return n >= 2;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}
