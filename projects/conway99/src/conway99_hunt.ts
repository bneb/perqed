/**
 * Conway's 99-Graph Problem — Multi-Restart SA Hunt
 *
 * Searches for SRG(99, 14, 1, 2): a 99-vertex strongly regular graph
 * where every edge has exactly 1 common neighbor (λ=1) and every
 * non-edge has exactly 2 common neighbors (μ=2).
 *
 * This is Conway's $1,000 prize problem (posed 2014).
 *
 * Usage:
 *   bun run projects/conway99/src/conway99_hunt.ts
 *   bun run projects/conway99/src/conway99_hunt.ts 5 500000  # 5 restarts × 500K iters
 */

import { SimulatedAnnealing } from "../../../src/math/optim/SimulatedAnnealing";
import { Conway99State } from "./conway99_state";
import * as fs from "node:fs/promises";
import { join } from "node:path";

const NUM_RESTARTS = parseInt(process.argv[2] || "10", 10);
const ITERS_PER_RESTART = parseInt(process.argv[3] || "1000000", 10);

async function runHunt() {
  console.log("═══════════════════════════════════════════════");
  console.log("  🔍 CONWAY'S 99-GRAPH PROBLEM");
  console.log("  Target: SRG(99, 14, 1, 2)");
  console.log(`  Restarts: ${NUM_RESTARTS} × ${ITERS_PER_RESTART.toLocaleString()} iterations`);
  console.log(`  Total budget: ${(NUM_RESTARTS * ITERS_PER_RESTART).toLocaleString()} iterations`);
  console.log("  Engine: Simulated Annealing (adaptive E^0.4 reheat)");
  console.log("═══════════════════════════════════════════════\n");

  let globalBestEnergy = Infinity;
  const startTime = performance.now();

  for (let restart = 1; restart <= NUM_RESTARTS; restart++) {
    console.log(`  🔄 [Restart ${restart}/${NUM_RESTARTS}] Generating random 14-regular graph...`);

    const initialState = Conway99State.createRandom();
    console.log(`     Initial energy: ${initialState.getEnergy()}`);

    const result = SimulatedAnnealing.run(initialState, {
      maxIterations: ITERS_PER_RESTART,
      initialTemp: 50,
      coolingRate: 0.999998,
      adaptiveReheatWindow: 50_000,
      onImprovement: (iter, energy, temp) => {
        console.log(`     📉 [Iter ${iter.toLocaleString()}] energy: ${energy} (temp: ${temp.toFixed(2)})`);
      },
      onProgress: (iter, current, best, temp) => {
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
        console.log(
          `     [Iter ${iter.toLocaleString().padStart(9)}] current: ${current.toString().padStart(6)} | best: ${best.toString().padStart(6)} | temp: ${temp.toFixed(2).padStart(8)} | ${elapsed}s`,
        );
      },
    });

    console.log(`     ↳ Restart ${restart} done. Local best: ${result.bestEnergy}`);

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
          adjacency: Array.from(result.bestState.getPayload()),
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

runHunt().catch((err) => {
  console.error("💥 Conway 99 hunt failed:", err);
  process.exit(1);
});
