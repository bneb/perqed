/**
 * parallel_sa_coordinator.ts — Run N SA workers concurrently with different seeds.
 *
 * Uses true OS-level parallelism via Bun.Worker (one thread per worker).
 * Each worker receives a different PartitionSAConfig (seed strategy / warm start),
 * runs `runPartitionSA` independently, and returns the best partition found.
 *
 * The coordinator collects all results and returns the global best.
 */

import type { PartitionSAConfig, PartitionSAResult } from "./partition_sa_worker";
import { join } from "node:path";

export interface ParallelSAConfig {
  /** Per-worker configs. Length determines number of workers. */
  workerConfigs: PartitionSAConfig[];
  /** Optional timeout in ms. If a worker exceeds this, it is terminated. */
  timeoutMs?: number;
}

export interface ParallelSAResult {
  best: PartitionSAResult;
  allResults: PartitionSAResult[];
  wallTimeMs: number;
}

/**
 * Run all workerConfigs concurrently. Returns the global best result.
 */
export async function runParallelSA(cfg: ParallelSAConfig): Promise<ParallelSAResult> {
  const t0 = Date.now();
  const workerModulePath = new URL("./partition_sa_worker_thread.ts", import.meta.url).href;

  const promises = cfg.workerConfigs.map((workerConfig, idx) =>
    new Promise<PartitionSAResult>((resolve, reject) => {
      const worker = new Worker(workerModulePath, { type: "module" });
      let settled = false;

      const timeout = cfg.timeoutMs
        ? setTimeout(() => {
            if (!settled) {
              settled = true;
              worker.terminate();
              reject(new Error(`Worker ${idx} timed out after ${cfg.timeoutMs}ms`));
            }
          }, cfg.timeoutMs)
        : null;

      worker.onmessage = (e: MessageEvent<PartitionSAResult>) => {
        if (!settled) {
          settled = true;
          if (timeout) clearTimeout(timeout);
          worker.terminate();
          resolve(e.data);
        }
      };

      worker.onerror = (err: ErrorEvent) => {
        if (!settled) {
          settled = true;
          if (timeout) clearTimeout(timeout);
          worker.terminate();
          reject(new Error(`Worker ${idx} error: ${err.message}`));
        }
      };

      // Serialize warmStart and crossover_parents (Int8Arrays) for postMessage
      worker.postMessage(serializeConfig(workerConfig));
    })
  );

  const results = await Promise.all(promises);
  const best = results.reduce((a, b) => a.energy <= b.energy ? a : b);

  return { best, allResults: results, wallTimeMs: Date.now() - t0 };
}

/**
 * Build a diversified set of configs for N_WORKERS parallel workers.
 *
 * Strategy rotation ensures each worker explores a different basin:
 * - ~50% random seeds (maximum diversity)
 * - 1 gaussian_norm (quadratic residue basin)
 * - 1 lookup_shift (period-18 basin)
 * - 1 crossover (if elites available)
 * - remainder: modular (original basin)
 */
export function buildDiverseWorkerConfigs(
  n: number,
  base: Omit<PartitionSAConfig, "description" | "seed_strategy">,
  elitePool?: Int8Array[],
): PartitionSAConfig[] {
  const configs: PartitionSAConfig[] = [];

  for (let i = 0; i < n; i++) {
    if (i === 0) {
      configs.push({ ...base, seed_strategy: "gaussian_norm", description: `w${i} gaussian_norm` });
    } else if (i === 1) {
      configs.push({ ...base, seed_strategy: "lookup_shift", seed_offset: 3, description: `w${i} lookup_shift` });
    } else if (i === 2 && elitePool && elitePool.length >= 2) {
      const pa = elitePool[Math.floor(Math.random() * elitePool.length)]!;
      const pb = elitePool[Math.floor(Math.random() * elitePool.length)]!;
      configs.push({ ...base, seed_strategy: "crossover", crossover_parents: [pa, pb], description: `w${i} crossover` });
    } else if (i === n - 1) {
      configs.push({ ...base, seed_strategy: "modular", description: `w${i} modular` });
    } else {
      configs.push({ ...base, seed_strategy: "random", description: `w${i} random_${i}` });
    }
  }

  return configs;
}

// ── Serialization helpers ────────────────────────────────────────────────────

interface SerializedConfig {
  config: Omit<PartitionSAConfig, "warmStart" | "crossover_parents"> & {
    warmStart?: number[];
    crossover_parents?: [number[], number[]];
  };
}

function serializeConfig(config: PartitionSAConfig): SerializedConfig {
  return {
    config: {
      ...config,
      warmStart: config.warmStart ? Array.from(config.warmStart) : undefined,
      crossover_parents: config.crossover_parents
        ? [Array.from(config.crossover_parents[0]), Array.from(config.crossover_parents[1])]
        : undefined,
    },
  };
}
