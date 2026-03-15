/**
 * Sprint 23: Deep Hunt — Multi-Restart Simulated Annealing Orchestrator
 *
 * Runs K independent annealing schedules from random initial states,
 * tracking the global best across all restarts. Designed for overnight
 * burns targeting n=32+ (the theoretical counterexample boundary).
 *
 * Usage:
 *   bun run src/scripts/deep_hunt.ts 32          # 10 restarts × 200K iters
 *   bun run src/scripts/deep_hunt.ts 24 5 100000 # 5 restarts × 100K iters
 */

import { SimulatedAnnealing } from "../math/optim/SimulatedAnnealing";
import { ErdosState } from "../math/erdos_state";
import { HunterTelemetry } from "../telemetry/hunter_telemetry";
import * as fs from "node:fs/promises";
import { join } from "node:path";

function getDegreeSequence(adj: number[][] | null): number[] {
  if (!adj) return [];
  return adj.map((neighbors) => neighbors.length).sort((a, b) => a - b);
}

const TARGET_N = parseInt(process.argv[2] || "32", 10);
const NUM_RESTARTS = parseInt(process.argv[3] || "10", 10);
const ITERS_PER_RESTART = parseInt(process.argv[4] || "200000", 10);
const START_TEMP = 100.0;
const COOLING_RATE = 0.99995;

async function runDeepHunt() {
  console.log("═══════════════════════════════════════════════");
  console.log("  🌲 DEEP FOREST MULTI-RESTART HUNT");
  console.log(`  Target: n = ${TARGET_N} vertices`);
  console.log(`  Restarts: ${NUM_RESTARTS} × ${ITERS_PER_RESTART.toLocaleString()} iterations`);
  console.log(`  Total budget: ${(NUM_RESTARTS * ITERS_PER_RESTART).toLocaleString()} iterations`);
  console.log("  Engine: Generalized SA (IState<T> → Metropolis-Hastings)");
  console.log("═══════════════════════════════════════════════\n");

  if (TARGET_N % 2 !== 0) {
    console.error("❌ Initialization requires an even N.");
    process.exit(1);
  }

  let ultimateBestEnergy = Infinity;
  let ultimateBestGraph: number[][] | null = null;
  const startTime = performance.now();

  for (let restart = 1; restart <= NUM_RESTARTS; restart++) {
    console.log(`  🔄 [Restart ${restart}/${NUM_RESTARTS}] Spawning Markov Chain...`);

    const initialState = ErdosState.createCubic(TARGET_N);

    const result = SimulatedAnnealing.run(initialState, {
      maxIterations: ITERS_PER_RESTART,
      initialTemp: START_TEMP,
      coolingRate: COOLING_RATE,
      onImprovement: (iter, energy, temp) => {
        console.log(`     📉 [Iter ${iter.toLocaleString()}] energy: ${energy} (temp: ${temp.toFixed(2)})`);
      },
      onProgress: (iter, current, best, temp) => {
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
        console.log(
          `     [Iter ${iter.toLocaleString().padStart(9)}] current: ${current.toString().padStart(4)} | best: ${best.toString().padStart(4)} | temp: ${temp.toFixed(2).padStart(8)} | ${elapsed}s`,
        );
      },
    });

    console.log(`     ↳ Restart ${restart} done. Local best: ${result.bestEnergy}`);

    if (result.bestEnergy < ultimateBestEnergy) {
      ultimateBestEnergy = result.bestEnergy;
      ultimateBestGraph = result.bestState.getPayload();
      console.log(`     🌟 NEW GLOBAL BEST: ${ultimateBestEnergy}`);
    }

    // Fire-and-forget telemetry uplink
    HunterTelemetry.push({
      n: TARGET_N,
      restartsCompleted: restart,
      totalRestarts: NUM_RESTARTS,
      globalBestEnergy: ultimateBestEnergy,
      globalBestGraph: ultimateBestGraph,
      latestDegrees: getDegreeSequence(ultimateBestGraph),
      elapsedSeconds: parseFloat(((performance.now() - startTime) / 1000).toFixed(2)),
      timestamp: new Date().toISOString(),
    }).catch(() => {}); // Extra safety catch

    if (result.foundZero) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log("\n═══════════════════════════════════════════════");
      console.log(`  🚨 COUNTEREXAMPLE FOUND ON RESTART ${restart} 🚨`);
      console.log(`  Elapsed: ${elapsed}s`);
      console.log(`  Graph: ${JSON.stringify(ultimateBestGraph)}`);
      console.log("═══════════════════════════════════════════════\n");

      const dataDir = join(import.meta.dir, "../../data");
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(
        join(dataDir, "counterexample.json"),
        JSON.stringify({ n: TARGET_N, restart, graph: ultimateBestGraph }, null, 2),
      );
      return;
    }

    console.log("");
  }

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log("═══════════════════════════════════════════════");
  console.log(`  ❌ Deep Hunt exhausted after ${elapsed}s`);
  console.log(`  🏆 Ultimate lowest energy: ${ultimateBestEnergy}`);
  if (ultimateBestGraph) {
    console.log(`  Degrees: [${ultimateBestGraph.map((a) => a.length).join(", ")}]`);
  }
  console.log("═══════════════════════════════════════════════\n");
}

runDeepHunt().catch((err) => {
  console.error("💥 Deep Hunt failed:", err);
  process.exit(1);
});
