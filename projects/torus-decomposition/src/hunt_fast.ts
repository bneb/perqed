/**
 * Claude's Cycles — Fast SA for m=6 Torus Decomposition
 *
 * Uses ClaudeStateFast with in-place mutation + rollback for ~12x speedup.
 * Drop-in replacement for claude_hunt.ts.
 *
 * Usage:
 *   bun run src/scripts/claude_hunt_fast.ts              # m=6, 10 restarts × 500K
 *   bun run src/scripts/claude_hunt_fast.ts 6 50 5000000 # 50 restarts × 5M
 */

import { ClaudeStateFast } from "./state_fast";
import * as fs from "node:fs/promises";
import { join } from "node:path";

const TARGET_M = parseInt(process.argv[2] || "6", 10);
const NUM_RESTARTS = parseInt(process.argv[3] || "10", 10);
const ITERS_PER_RESTART = parseInt(process.argv[4] || "500000", 10);
const START_TEMP = 50.0;
const COOLING_RATE = 0.999998;
const ADAPTIVE_REHEAT_WINDOW = 100_000;

async function huntFast() {
  const vCount = TARGET_M ** 3;
  console.log("═══════════════════════════════════════════════");
  console.log(`  🚀 FAST HUNT — m=${TARGET_M}`);
  console.log(`  Graph: ${TARGET_M}×${TARGET_M}×${TARGET_M} directed torus (${vCount} vertices, ${3 * vCount} arcs)`);
  console.log(`  Search space: 6^${vCount} ≈ ${(6 ** Math.min(vCount, 300)).toExponential(1)}`);
  console.log(`  Restarts: ${NUM_RESTARTS} × ${ITERS_PER_RESTART.toLocaleString()} iterations`);
  console.log("  Engine: In-place SA with incremental energy (~12x faster)");
  console.log("═══════════════════════════════════════════════\n");

  let ultimateBestEnergy = Infinity;
  let ultimateBestPayload: number[] | null = null;
  const startTime = performance.now();

  for (let restart = 1; restart <= NUM_RESTARTS; restart++) {
    console.log(`  🔄 [Restart ${restart}/${NUM_RESTARTS}] Spawning Markov Chain...`);

    const state = ClaudeStateFast.createRandom(TARGET_M);
    let currentEnergy = state.getEnergy();
    let bestEnergy = currentEnergy;

    let temperature = START_TEMP;
    let itersSinceImprovement = 0;
    let currentReheatWindow = ADAPTIVE_REHEAT_WINDOW;

    console.log(`     Initial energy: ${currentEnergy}`);

    for (let iter = 0; iter < ITERS_PER_RESTART; iter++) {
      // Generate random mutation
      const vertex = Math.floor(Math.random() * (vCount - 1)) + 1;
      let newPerm = Math.floor(Math.random() * 5);
      if (newPerm >= state.payload[vertex]!) newPerm++;

      // Try mutation in-place
      const deltaE = state.tryMutation(vertex, newPerm);
      const candidateEnergy = currentEnergy + deltaE;

      // Metropolis-Hastings
      if (deltaE < 0 || Math.random() < Math.exp(-deltaE / temperature)) {
        state.acceptMutation();
        currentEnergy = candidateEnergy;

        if (currentEnergy < bestEnergy) {
          bestEnergy = currentEnergy;
          itersSinceImprovement = 0;
          currentReheatWindow = ADAPTIVE_REHEAT_WINDOW;

          if (bestEnergy < ultimateBestEnergy) {
            ultimateBestEnergy = bestEnergy;
            ultimateBestPayload = [...state.getPayload()];
            console.log(`     📉 [Iter ${iter.toLocaleString()}] energy: ${bestEnergy} (temp: ${temperature.toFixed(4)})`);
          }
        }

        if (currentEnergy === 0) {
          const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
          console.log("\n═══════════════════════════════════════════════");
          console.log(`  🎉🎉🎉 SOLUTION FOUND ON RESTART ${restart} 🎉🎉🎉`);
          console.log(`  Elapsed: ${elapsed}s`);
          console.log(`  Payload: [${ultimateBestPayload}]`);
          console.log("═══════════════════════════════════════════════\n");

          const dataDir = join(import.meta.dir, "../data");
          await fs.mkdir(dataDir, { recursive: true });
          await fs.writeFile(
            join(dataDir, `claude_cycles_m${TARGET_M}.json`),
            JSON.stringify({
              m: TARGET_M, restart,
              elapsed_seconds: parseFloat(elapsed),
              payload: ultimateBestPayload,
              timestamp: new Date().toISOString(),
            }, null, 2),
          );
          return;
        }
      } else {
        state.rejectMutation();
      }

      temperature *= COOLING_RATE;
      itersSinceImprovement++;

      // Adaptive reheating with exponential backoff
      if (itersSinceImprovement >= currentReheatWindow) {
        temperature = Math.max(1.0, Math.pow(bestEnergy, 0.4));
        itersSinceImprovement = 0;
        currentReheatWindow = Math.min(currentReheatWindow * 2, ITERS_PER_RESTART);
      }

      if (iter % 500_000 === 0 && iter > 0) {
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
        console.log(
          `     [Iter ${iter.toLocaleString().padStart(12)}] current: ${currentEnergy.toString().padStart(3)} | best: ${bestEnergy.toString().padStart(3)} | temp: ${temperature.toFixed(4).padStart(9)} | ${elapsed}s`,
        );
      }
    }

    console.log(`     ↳ Restart ${restart} done. Local best: ${bestEnergy}`);

    if (bestEnergy < ultimateBestEnergy) {
      ultimateBestEnergy = bestEnergy;
      ultimateBestPayload = [...state.getPayload()];
      console.log(`     🌟 NEW GLOBAL BEST: ${ultimateBestEnergy}`);
    }

    console.log("");
  }

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log("═══════════════════════════════════════════════");
  console.log(`  ❌ Hunt exhausted after ${elapsed}s`);
  console.log(`  🏆 Lowest energy: ${ultimateBestEnergy}`);
  console.log("═══════════════════════════════════════════════\n");
}

huntFast().catch((err) => {
  console.error("💥 Fast hunt failed:", err);
  process.exit(1);
});
