/**
 * Ramsey Search Orchestrator — Multi-strategy search dispatcher.
 *
 * Runs multiple SA workers with diverse seeds and strategies.
 * Uses Bun Worker threads for true parallelism — all workers
 * race concurrently, and all are terminated when one hits E=0.
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
  /** Symmetry constraint passed to each SA worker */
  symmetry?: 'none' | 'circulant';
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
 * For island_model with multiple workers, uses Bun Worker threads
 * for true parallelism. Single strategy runs in the main thread.
 */
export async function orchestratedSearch(config: OrchestratedSearchConfig): Promise<OrchestratedSearchResult> {
  if (config.strategy === "island_model" && config.workers > 1) {
    return parallelSearch(config);
  }
  return singleSearch(config);
}

/**
 * Single-threaded search — runs in main thread.
 */
function singleSearch(config: OrchestratedSearchConfig): OrchestratedSearchResult {
  const startTime = Date.now();
  const seeds = buildSeeds(config, 1);
  const edges = config.n * (config.n - 1) / 2;
  const tInit = edges < 50 ? 1.0 : edges < 200 ? 2.0 : edges < 600 ? 3.0 : 5.0;
  const coolingRate = Math.exp(Math.log(0.01 / tInit) / (0.8 * config.saIterations));

  const saConfig: RamseySearchConfig = {
    n: config.n,
    r: config.r,
    s: config.s,
    maxIterations: config.saIterations,
    initialTemp: tInit,
    coolingRate,
    initialGraph: seeds[0],
    symmetry: config.symmetry,
  };

  let result: RamseySearchResult;
  if (config.onProgress) {
    const progress = (iter: number, energy: number, best: number, temp: number) => {
      config.onProgress!(0, iter, energy, best, temp);
    };
    result = ramseySearch(saConfig, progress);
  } else {
    result = ramseySearch(saConfig);
  }

  return {
    best: result,
    workersRan: 1,
    bestWorkerIndex: 0,
    totalWallTime: (Date.now() - startTime) / 1000,
  };
}

/**
 * Parallel search — spawns Bun Worker threads.
 * All workers race concurrently. When one hits E=0,
 * all others are terminated immediately.
 */
async function parallelSearch(config: OrchestratedSearchConfig): Promise<OrchestratedSearchResult> {
  const startTime = Date.now();
  const numWorkers = config.workers;
  const seeds = buildSeeds(config, numWorkers);

  const edges = config.n * (config.n - 1) / 2;
  const tInit = edges < 50 ? 1.0 : edges < 200 ? 2.0 : edges < 600 ? 3.0 : 5.0;
  const itersPerWorker = config.saIterations;
  const coolingRate = Math.exp(Math.log(0.01 / tInit) / (0.8 * itersPerWorker));

  // Shared state
  let bestResult: RamseySearchResult | null = null;
  let bestWorkerIndex = 0;
  let resolved = false;

  // Spawn workers
  const workers: Worker[] = [];
  const workerPromises: Promise<void>[] = [];
  const resolvers: (() => void)[] = [];

  for (let w = 0; w < numWorkers; w++) {
    const worker = new Worker(new URL("./ramsey_worker_thread.ts", import.meta.url).href);
    workers.push(worker);

    const promise = new Promise<void>((resolve) => {
      resolvers.push(resolve);

      worker.onmessage = (event: MessageEvent) => {
        const msg = event.data;

        if (msg.type === "progress" && config.onProgress) {
          config.onProgress(msg.worker, msg.iter, msg.energy, msg.best, msg.temp);
        }

        if (msg.type === "done") {
          // Reconstruct AdjacencyMatrix from serialized worker data
          const raw = msg.result;
          let witness: AdjacencyMatrix | null = null;
          if (raw.witnessRaw && raw.witnessN) {
            witness = new AdjacencyMatrix(raw.witnessN);
            const data = new Int8Array(raw.witnessRaw);
            for (let i = 0; i < data.length; i++) {
              witness.raw[i] = data[i]!;
            }
          }
          const result: RamseySearchResult = {
            bestEnergy: raw.bestEnergy,
            witness,
            iterations: raw.iterations,
            ips: raw.ips,
            telemetry: raw.telemetry,
          };

          if (!bestResult || result.bestEnergy < bestResult.bestEnergy) {
            bestResult = result;
            bestWorkerIndex = msg.worker;
          }

          // If a witness was found, terminate all other workers
          // and resolve their promises so Promise.all completes
          if (result.bestEnergy === 0 && !resolved) {
            resolved = true;
            for (let i = 0; i < workers.length; i++) {
              try { workers[i]!.terminate(); } catch {}
              resolvers[i]!(); // Resolve all promises including this one
            }
            return;
          }

          resolve();
        }
      };

      worker.onerror = (error: ErrorEvent) => {
        console.error(`[W${w}] Worker error:`, error.message);
        resolve();
      };
    });

    workerPromises.push(promise);

    // Build config for this worker (seeds need to be serialized as raw data)
    const seedGraph = seeds[w];
    const saConfigForWorker: any = {
      n: config.n,
      r: config.r,
      s: config.s,
      maxIterations: itersPerWorker,
      initialTemp: tInit,
      coolingRate,
      symmetry: config.symmetry, // Pass symmetry constraint to worker thread
    };

    // Serialize the seed graph as raw Int8Array if present
    // Note: for circulant mode, the worker ignores the seed and builds its own random circulant
    if (seedGraph && config.symmetry !== 'circulant') {
      saConfigForWorker.initialGraphRaw = seedGraph.raw;
      saConfigForWorker.initialGraphN = seedGraph.n;
    }

    worker.postMessage({ type: "start", config: saConfigForWorker, workerIndex: w });
  }

  // Wait for all workers or early termination
  await Promise.all(workerPromises);

  // Clean up any remaining workers
  for (const w of workers) {
    try { w.terminate(); } catch {}
  }

  return {
    best: bestResult!,
    workersRan: numWorkers,
    bestWorkerIndex,
    totalWallTime: (Date.now() - startTime) / 1000,
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
