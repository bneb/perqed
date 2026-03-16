/**
 * Conway's 99-Graph Problem — Bare-Metal Custom Hot Loop
 *
 * Bypasses all generic IState/SimulatedAnnealing interfaces.
 * Runs a raw Metropolis-Hastings while loop directly against
 * IncrementalSRGEngine's zero-allocation API:
 *
 *   delta = engine.proposeRandomSwap()
 *   if accept: engine.commitSwap()
 *   else:      engine.discardSwap()
 *
 * No object allocations in the inner loop.
 *
 * Usage:
 *   bun run projects/conway99/src/conway99_custom_hunt.ts
 *   bun run projects/conway99/src/conway99_custom_hunt.ts --benchmark
 *   bun run projects/conway99/src/conway99_custom_hunt.ts --restarts 50 --iters 10000000
 */

import { AdjacencyMatrix } from "../../../src/math/graph/AdjacencyMatrix";
import { IncrementalSRGEngine } from "../../../src/math/graph/IncrementalSRGEngine";
import * as fs from "node:fs/promises";
import { join } from "node:path";

// ──────────────────────────────────────────────
// CLI args
// ──────────────────────────────────────────────
const args = process.argv.slice(2);
const isBenchmark = args.includes("--benchmark");

function getArg(name: string, def: number): number {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? parseInt(args[idx + 1]!, 10) : def;
}

const NUM_RESTARTS = getArg("restarts", isBenchmark ? 1 : 10);
const ITERS_PER_RESTART = getArg("iters", isBenchmark ? 0 : 5_000_000);
const BENCHMARK_SECONDS = getArg("seconds", 10);

// ──────────────────────────────────────────────
// SA hyperparameters
// ──────────────────────────────────────────────
const T0 = 100.0;
const ALPHA = 0.99999;
const REHEAT_WINDOW_INIT = 50_000;
const REHEAT_EXPONENT = 0.4;   // E^(2/5) reheat
const PROGRESS_INTERVAL = 100_000;

// ──────────────────────────────────────────────
// The hot loop
// ──────────────────────────────────────────────

function runHotLoop(
  engine: IncrementalSRGEngine,
  maxIters: number,
  maxTimeMs: number,
  onProgress?: (iter: number, energy: number, bestEnergy: number, temp: number, ips: number) => void,
): { bestEnergy: number; iterations: number; foundZero: boolean } {
  let temp = T0;
  let bestEnergy = engine.energy;
  let lastImproveIter = 0;
  let reheatWindow = REHEAT_WINDOW_INIT;
  let proposals = 0;
  let accepts = 0;

  const startMs = performance.now();
  let iter = 0;

  // The bare-metal loop: ZERO allocations per iteration
  while (iter < maxIters || (maxTimeMs > 0 && (performance.now() - startMs) < maxTimeMs)) {
    if (engine.energy === 0) {
      return { bestEnergy: 0, iterations: iter, foundZero: true };
    }

    const delta = engine.proposeRandomSwap();

    if (delta !== null) {
      proposals++;

      // Metropolis-Hastings acceptance
      if (delta < 0 || Math.random() < Math.exp(-delta / temp)) {
        engine.commitSwap();
        accepts++;

        if (engine.energy < bestEnergy) {
          bestEnergy = engine.energy;
          lastImproveIter = iter;
          reheatWindow = REHEAT_WINDOW_INIT; // reset backoff
        }
      } else {
        engine.discardSwap();
      }
    }

    // Exponential cooling
    temp *= ALPHA;

    // Adaptive reheat with exponential backoff
    if (iter - lastImproveIter > reheatWindow) {
      const reheatTemp = Math.max(1, Math.pow(bestEnergy, REHEAT_EXPONENT));
      temp = reheatTemp;
      lastImproveIter = iter;
      reheatWindow = Math.min(reheatWindow * 2, 10_000_000); // cap at 10M
    }

    // Progress callback
    if (onProgress && iter > 0 && iter % PROGRESS_INTERVAL === 0) {
      const elapsedMs = performance.now() - startMs;
      const ips = Math.round(iter / (elapsedMs / 1000));
      onProgress(iter, engine.energy, bestEnergy, temp, ips);
    }

    iter++;

    // Time limit check (check every 10K iters to avoid overhead)
    if (maxTimeMs > 0 && iter % 10_000 === 0) {
      if ((performance.now() - startMs) >= maxTimeMs) break;
    }
  }

  return { bestEnergy, iterations: iter, foundZero: false };
}

// ──────────────────────────────────────────────
// Benchmark mode: measure raw IPS
// ──────────────────────────────────────────────

async function runBenchmark() {
  console.log("═══════════════════════════════════════════════");
  console.log("  ⏱  CONWAY 99 — IPS BENCHMARK");
  console.log(`  Duration: ${BENCHMARK_SECONDS}s`);
  console.log("  Engine: IncrementalSRGEngine (zero-allocation)");
  console.log("═══════════════════════════════════════════════\n");

  console.log("  Generating random 14-regular graph on 99 vertices...");
  const g = AdjacencyMatrix.randomRegular(99, 14);
  const engine = new IncrementalSRGEngine(g, 14, 1, 2);
  console.log(`  Initial energy: ${engine.energy}\n`);

  const result = runHotLoop(engine, Infinity, BENCHMARK_SECONDS * 1000, (iter, energy, best, temp, ips) => {
    console.log(
      `  [${(iter / 1_000_000).toFixed(1)}M] energy: ${energy.toString().padStart(6)} | best: ${best.toString().padStart(6)} | temp: ${temp.toFixed(2).padStart(8)} | ${ips.toLocaleString()} iter/s`,
    );
  });

  const totalTime = BENCHMARK_SECONDS;
  const ips = Math.round(result.iterations / totalTime);

  console.log("\n═══════════════════════════════════════════════");
  console.log(`  📊 RESULTS`);
  console.log(`  Total iterations: ${result.iterations.toLocaleString()}`);
  console.log(`  Iterations/second: ${ips.toLocaleString()}`);
  console.log(`  Best energy: ${result.bestEnergy}`);
  console.log(`  Found E=0: ${result.foundZero}`);
  console.log("═══════════════════════════════════════════════\n");
}

// ──────────────────────────────────────────────
// Search mode: multi-restart campaign
// ──────────────────────────────────────────────

async function runSearch() {
  console.log("═══════════════════════════════════════════════");
  console.log("  🔍 CONWAY'S 99-GRAPH PROBLEM — CUSTOM HOT LOOP");
  console.log("  Target: SRG(99, 14, 1, 2)");
  console.log(`  Restarts: ${NUM_RESTARTS} × ${ITERS_PER_RESTART.toLocaleString()} iterations`);
  console.log(`  Total budget: ${(NUM_RESTARTS * ITERS_PER_RESTART).toLocaleString()} iterations`);
  console.log("  Engine: IncrementalSRGEngine (zero-allocation)");
  console.log(`  Schedule: T₀=${T0}, α=${ALPHA}, reheat=E^${REHEAT_EXPONENT}`);
  console.log("═══════════════════════════════════════════════\n");

  let globalBestEnergy = Infinity;
  const startTime = performance.now();

  for (let restart = 1; restart <= NUM_RESTARTS; restart++) {
    console.log(`  🔄 [Restart ${restart}/${NUM_RESTARTS}] Generating random 14-regular graph...`);

    const g = AdjacencyMatrix.randomRegular(99, 14);
    const engine = new IncrementalSRGEngine(g, 14, 1, 2);
    console.log(`     Initial energy: ${engine.energy}`);

    const result = runHotLoop(engine, ITERS_PER_RESTART, 0, (iter, energy, best, temp, ips) => {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      console.log(
        `     [${(iter / 1_000_000).toFixed(1)}M] E: ${energy.toString().padStart(6)} | best: ${best.toString().padStart(6)} | T: ${temp.toFixed(2).padStart(8)} | ${ips.toLocaleString()} ips | ${elapsed}s`,
      );
    });

    console.log(`     ↳ Restart ${restart}: best = ${result.bestEnergy} (${result.iterations.toLocaleString()} iters)`);

    if (result.bestEnergy < globalBestEnergy) {
      globalBestEnergy = result.bestEnergy;
      console.log(`     🌟 NEW GLOBAL BEST: ${globalBestEnergy}`);
    }

    if (result.foundZero) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log("\n═══════════════════════════════════════════════");
      console.log(`  🏆 SRG(99, 14, 1, 2) FOUND ON RESTART ${restart} 🏆`);
      console.log(`  Elapsed: ${elapsed}s`);
      console.log("═══════════════════════════════════════════════\n");

      const dataDir = join(import.meta.dir, "../data");
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(
        join(dataDir, "conway99_witness.json"),
        JSON.stringify({
          type: "SRG(99, 14, 1, 2)",
          restart,
          iterations: result.iterations,
          adjacency: Array.from(engine.getGraph().raw),
        }, null, 2),
      );
      console.log("  💾 Witness saved to data/conway99_witness.json");
      return;
    }

    console.log("");
  }

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log("═══════════════════════════════════════════════");
  console.log(`  ❌ Search exhausted after ${elapsed}s`);
  console.log(`  🏆 Lowest energy reached: ${globalBestEnergy}`);
  console.log("═══════════════════════════════════════════════\n");
}

// ──────────────────────────────────────────────
// Entry point
// ──────────────────────────────────────────────

if (isBenchmark) {
  runBenchmark().catch(console.error);
} else {
  runSearch().catch(console.error);
}
