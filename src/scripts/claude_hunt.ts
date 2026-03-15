/**
 * Sprint 26: Claude's Cycles — Hunt for Knuth's m=4 Decomposition
 *
 * Uses the generalized SA engine to find 3 directed Hamiltonian cycles
 * in the 4×4×4 torus graph. When energy hits 0, we have the decomposition.
 *
 * Usage:
 *   bun run src/scripts/claude_hunt.ts              # 10 restarts × 500K
 *   bun run src/scripts/claude_hunt.ts 20 1000000   # 20 restarts × 1M
 */

import { SimulatedAnnealing } from "../math/optim/SimulatedAnnealing";
import { ClaudeState } from "../math/claude_state";
import * as fs from "node:fs/promises";
import { join } from "node:path";

const TARGET_M = parseInt(process.argv[2] || "4", 10);
const NUM_RESTARTS = parseInt(process.argv[3] || "10", 10);
const ITERS_PER_RESTART = parseInt(process.argv[4] || "500000", 10);
const START_TEMP = 50.0;
const COOLING_RATE = 0.999998; // Fast cooling: T≈1.0 at iter ~1.5M

async function huntClaudeCycles() {
  const vCount = TARGET_M ** 3;
  console.log("═══════════════════════════════════════════════");
  console.log(`  🧊 KNUTH'S CLAUDE'S CYCLES — m=${TARGET_M} HUNT`);
  console.log(`  Graph: ${TARGET_M}×${TARGET_M}×${TARGET_M} directed torus (${vCount} vertices, ${3 * vCount} arcs)`);
  console.log(`  Goal: Decompose into 3 directed Hamiltonian cycles`);
  console.log(`  Search space: 6^${vCount} ≈ ${(6 ** vCount).toExponential(1)}`);
  console.log(`  Restarts: ${NUM_RESTARTS} × ${ITERS_PER_RESTART.toLocaleString()} iterations`);
  console.log("  Engine: Generalized SA (IState<T> → Metropolis-Hastings)");
  console.log("═══════════════════════════════════════════════\n");

  let ultimateBestEnergy = Infinity;
  let ultimateBestPayload: number[] | null = null;
  const startTime = performance.now();

  for (let restart = 1; restart <= NUM_RESTARTS; restart++) {
    console.log(`  🔄 [Restart ${restart}/${NUM_RESTARTS}] Spawning Markov Chain...`);

    const initialState = ClaudeState.createRandom(TARGET_M);
    console.log(`     Initial energy: ${initialState.getEnergy()}`);

    const result = SimulatedAnnealing.run(initialState, {
      maxIterations: ITERS_PER_RESTART,
      initialTemp: START_TEMP,
      coolingRate: COOLING_RATE,
      adaptiveReheatWindow: 100_000,
      onImprovement: (iter, energy, temp) => {
        console.log(`     📉 [Iter ${iter.toLocaleString()}] energy: ${energy} (temp: ${temp.toFixed(4)})`);
      },
      onProgress: (iter, current, best, temp) => {
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
        console.log(
          `     [Iter ${iter.toLocaleString().padStart(9)}] current: ${current.toString().padStart(3)} | best: ${best.toString().padStart(3)} | temp: ${temp.toFixed(4).padStart(9)} | ${elapsed}s`,
        );
      },
      progressInterval: 100_000,
    });

    console.log(`     ↳ Restart ${restart} done. Local best: ${result.bestEnergy}`);

    if (result.bestEnergy < ultimateBestEnergy) {
      ultimateBestEnergy = result.bestEnergy;
      ultimateBestPayload = result.bestState.getPayload() as number[];
      console.log(`     🌟 NEW GLOBAL BEST: ${ultimateBestEnergy}`);
    }

    if (result.foundZero) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log("\n═══════════════════════════════════════════════");
      console.log(`  🎉🎉🎉 SOLUTION FOUND ON RESTART ${restart} 🎉🎉🎉`);
      console.log(`  Elapsed: ${elapsed}s`);
      console.log(`  Payload: [${ultimateBestPayload}]`);
      console.log("═══════════════════════════════════════════════\n");

      // Save solution
      const dataDir = join(import.meta.dir, "../../data");
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(
        join(dataDir, `claude_cycles_m${TARGET_M}.json`),
        JSON.stringify(
          {
            m: TARGET_M,
            restart,
            elapsed_seconds: parseFloat(elapsed),
            payload: ultimateBestPayload,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log("");
  }

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log("═══════════════════════════════════════════════");
  console.log(`  ❌ Hunt exhausted after ${elapsed}s`);
  console.log(`  🏆 Lowest energy: ${ultimateBestEnergy}`);
  console.log("═══════════════════════════════════════════════\n");
}

huntClaudeCycles().catch((err) => {
  console.error("💥 Claude's Cycles hunt failed:", err);
  process.exit(1);
});
