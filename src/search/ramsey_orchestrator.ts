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
import { extractTopHotZone } from "./hot_zone_extractor";
import { runMicroSATPatch, nukeScaffold } from "./micro_sat_patcher";

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
  /** Optional warm-start graph (memetic handoff from previous SA run) */
  initialGraph?: AdjacencyMatrix;
  /**
   * Tabu hashes: Zobrist hashes of Z3-certified sterile energy basins.
   * Forwarded to every SA worker so they hard-reject re-entry into known
   * glass floors. Decimal strings (JSON-safe BigInt transport).
   */
  tabuHashes?: string[];
  /** Temperature reheat when a tabu basin is entered (default: 3.0) */
  tabuPenaltyTemperature?: number;
  /**
   * Energy threshold below which STERILE_BASIN triggers MicroSAT repair.
   * E.g. 15 = route any sterile basin at bestEnergy ≤ 15 to Z3 surgery.
   * Default: disabled (undefined).
   */
  microSatThreshold?: number;
  /** Progress callback */
  onProgress?: (worker: number, iter: number, energy: number, bestEnergy: number, temp: number) => void;
}

export interface OrchestratedSearchResult {
  /** Best result across all workers */
  best: RamseySearchResult;
  /** All individual worker results (for multi-candidate LNS) */
  allResults: RamseySearchResult[];
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
    // Memetic warm-start: prefer explicit initialGraph over random seed
    initialGraph: config.initialGraph ?? seeds[0],
    symmetry: config.symmetry,
    // Tabu hashes: prevents re-entry into Z3-certified sterile basins
    tabuHashes: config.tabuHashes,
    tabuPenaltyTemperature: config.tabuPenaltyTemperature,
    // MicroSAT: single-worker path (no worker thread, callback is a no-op placeholder)
    microSatThreshold: config.microSatThreshold,
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
    allResults: [result],
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

  // ── Per-worker hyperparam diversity ──
  // Worker 0 = fastest cooling / most impatient (rapid basin hopper)
  // Worker N-1 = slowest cooling / most patient (deep explorer)
  // Spread is configurable; defaults give a 50x cooling range and 5x patience range.
  const coolingSpread = (config as any).coolingSpread ?? 50;  // max/min cooling rate ratio
  const patienceSpread = (config as any).patienceSpread ?? 5; // max/min patience ratio
  const baseCoolingRate = Math.exp(Math.log(0.01 / tInit) / (0.8 * itersPerWorker));
  const basePatience = Math.max(100_000, Math.floor(itersPerWorker * 0.1));

  function workerCoolingRate(w: number): number {
    // Spread diversity as "fraction of budget each worker uses to cool from T_init to T_min".
    // W0 (t=0): cools over 80% of budget  → slow, deep explorer
    // W(N-1) (t=1): cools over 20% of budget → fast basin-hopper
    //
    // The old formula spread log(coolingRate)≈-1.5e-8 by log(50)≈3.9,
    // producing rates like exp(-3.9)≈0.02 which kills T in 1 iteration.
    const t = numWorkers > 1 ? w / (numWorkers - 1) : 0;
    const T_MIN = 0.01;
    // Fraction of budget to spend cooling: 80% down to 20% across workers
    const coolBudgetFraction = 0.80 - t * 0.60;
    const coolIters = coolBudgetFraction * itersPerWorker;
    return Math.exp(Math.log(T_MIN / tInit) / coolIters);
  }

  function workerPatience(w: number): number {
    // Spread patience from basePatience/patienceSpread (impatient) to basePatience*patienceSpread (patient)
    const t = numWorkers > 1 ? w / (numWorkers - 1) : 0;
    const logBase = Math.log(basePatience);
    const logSpread = Math.log(patienceSpread);
    return Math.round(Math.exp(logBase + t * 2 * logSpread - logSpread));
  }

  // Shared state
  let bestResult: RamseySearchResult | null = null;
  let bestWorkerIndex = 0;
  let resolved = false;
  const allResults: RamseySearchResult[] = [];

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

        if (msg.type === "STERILE_BASIN") {
          // Synchronized MicroSAT: worker is Atomics.wait-parked on msg.lock.
          // We run Z3 async, then wake the worker with the patched adj.
          const w_idx = msg.worker as number;
          const basinEnergy = msg.energy as number;
          const workerRef = workers[w_idx]!;
          const lock = msg.lock as SharedArrayBuffer | undefined;
          console.log(`   🔬 [W${w_idx}] Sterile basin at E=${basinEnergy} — routing to MicroSAT (worker paused)`);

          if (msg.bestAdjRaw && msg.bestAdjN) {
            const basinAdj = new AdjacencyMatrix(msg.bestAdjN as number);
            const rawData = new Int8Array(msg.bestAdjRaw as number[]);
            for (let i = 0; i < rawData.length; i++) basinAdj.raw[i] = rawData[i]!;

            const zone = extractTopHotZone(basinAdj, config.r, config.s);

            (async () => {
              const patchStart = Date.now();
              const result = await runMicroSATPatch(basinAdj, config.r, config.s, zone, { timeoutMs: 120_000 });
              const ms = Date.now() - patchStart;

              if (result.status === "sat" && result.adj && !resolved) {
                // E=0 witness found — terminate all workers
                resolved = true;
                console.log(`   🎯 [MicroSAT] SAT witness found in ${ms}ms (hot zone ${result.hotZoneSize}v) — terminating all workers`);
                const satResult: RamseySearchResult = {
                  bestEnergy: 0,
                  witness: result.adj,
                  bestAdj: result.adj,
                  iterations: 0,
                  ips: 0,
                  telemetry: {} as any,
                };
                if (!bestResult || satResult.bestEnergy < bestResult.bestEnergy) {
                  bestResult = satResult;
                }
                for (let i = 0; i < workers.length; i++) {
                  try { workers[i]!.terminate(); } catch {}
                  resolvers[i]!();
                }
              } else if (result.status === "unsat") {
                // Z3 proved cold zone is toxic — nuke scaffold, send patched adj back
                console.log(`   ☢️  [MicroSAT] UNSAT in ${ms}ms — nuking cold zone, waking W${w_idx} with patch`);
                nukeScaffold(basinAdj, zone.frozenVertices);
                
                if (lock) {
                  // Write patch into the shared buffer starting at byte 4
                  const patchRaw = new Int8Array(lock, 4);
                  for (let i = 0; i < basinAdj.raw.length; i++) {
                    patchRaw[i] = basinAdj.raw[i]!;
                  }
                  
                  // Wake the worker's Atomics.wait via the shared lock.
                  // Status 1 = PATCH
                  const lockView = new Int32Array(lock, 0, 1);
                  Atomics.store(lockView, 0, 1);
                  Atomics.notify(lockView, 0, 1);
                }
              } else {
                console.log(`   ⏱️  [MicroSAT] ${result.status} in ${ms}ms (hot zone ${result.hotZoneSize}v) — waking W${w_idx} to scatter`);
                
                if (lock) {
                  // Wake the worker's Atomics.wait via the shared lock.
                  // Status 2 = NO PATCH (SCATTER)
                  const lockView = new Int32Array(lock, 0, 1);
                  Atomics.store(lockView, 0, 2);
                  Atomics.notify(lockView, 0, 1);
                }
              }
            })();

          }
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
          let bestAdj: AdjacencyMatrix;
          if (raw.bestAdjRaw && raw.bestAdjN) {
            bestAdj = new AdjacencyMatrix(raw.bestAdjN);
            const data = new Int8Array(raw.bestAdjRaw);
            for (let i = 0; i < data.length; i++) bestAdj.raw[i] = data[i]!;
          } else {
            bestAdj = witness ?? new AdjacencyMatrix(config.n);
          }
          const result: RamseySearchResult = {
            bestEnergy: raw.bestEnergy,
            witness,
            bestAdj,
            iterations: raw.iterations,
            ips: raw.ips,
            telemetry: raw.telemetry,
          };

          allResults.push(result);
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
    const seedGraph = w === 0 && config.initialGraph ? config.initialGraph : seeds[w];
    const wCoolingRate = workerCoolingRate(w);
    const wPatience = workerPatience(w);
    const saConfigForWorker: any = {
      n: config.n,
      r: config.r,
      s: config.s,
      maxIterations: itersPerWorker,
      initialTemp: tInit,
      coolingRate: wCoolingRate,
      minPatience: wPatience,
      symmetry: config.symmetry,
      // ── Tabu hash injection ──────────────────────────────────────────────
      // Every worker gets the full set of known-sterile basin hashes so they
      // all hard-reject re-entry regardless of which basin they scatter into.
      tabuHashes: config.tabuHashes,
      tabuPenaltyTemperature: config.tabuPenaltyTemperature,
      // MicroSAT: pass threshold so workers know when to emit STERILE_BASIN
      microSatThreshold: config.microSatThreshold,
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
    allResults,
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
