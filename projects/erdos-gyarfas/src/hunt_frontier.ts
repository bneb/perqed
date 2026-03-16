/**
 * Sprint 22: The Stochastic Hunter — Simulated Annealing
 *
 * Uses Metropolis-Hastings to hunt for a counterexample to the
 * Erdős-Gyárfás conjecture in the high-dimensional graph space.
 *
 * The energy function counts power-of-2 cycles. If energy reaches 0,
 * we've found a graph with min degree >= 3 and no 4/8/16-cycles.
 *
 * Usage:
 *   bun run src/scripts/hunt_frontier.ts 18       # default 500K iterations
 *   bun run src/scripts/hunt_frontier.ts 20 1000000  # 1M iterations
 */

import { EnergyCalculator } from "./energy_calculator";
import { GraphMutator } from "./graph_mutator";
import * as fs from "node:fs/promises";
import { join } from "node:path";

/**
 * Bootstrap a circular cubic graph (3-regular) as the starting point.
 * Each vertex connects to its neighbors and the vertex across.
 * Requires even n for the "across" connection to be well-defined.
 */
function createInitialCubicGraph(n: number): number[][] {
  const adj: number[][] = Array.from({ length: n }, () => []);

  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const prev = (i - 1 + n) % n;
    const across = (i + Math.floor(n / 2)) % n;

    const neighbors = new Set([next, prev, across]);
    adj[i] = Array.from(neighbors);
  }

  return adj;
}

async function runSimulatedAnnealing(n: number, maxIterations: number) {
  console.log("═══════════════════════════════════════════════");
  console.log("  🐺 THE STOCHASTIC HUNTER");
  console.log(`  Target: n = ${n} vertices`);
  console.log(`  Budget: ${maxIterations.toLocaleString()} iterations`);
  console.log("  Engine: Simulated Annealing (Metropolis-Hastings)");
  console.log("═══════════════════════════════════════════════\n");

  let currentGraph = createInitialCubicGraph(n);
  let currentEnergy = EnergyCalculator.calculateEnergy(currentGraph);
  let bestEnergy = currentEnergy;
  let bestGraph = currentGraph;

  let temperature = 100.0;
  const coolingRate = 0.99998;
  let accepted = 0;
  let rejected = 0;

  const startTime = performance.now();

  console.log(`  Initial energy: ${currentEnergy}`);
  console.log(`  Initial degrees: [${currentGraph.map((a) => a.length).join(", ")}]\n`);

  for (let i = 0; i < maxIterations; i++) {
    if (currentEnergy === 0) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log("\n═══════════════════════════════════════════════");
      console.log(`  🚨 COUNTEREXAMPLE FOUND AT ITERATION ${i.toLocaleString()} 🚨`);
      console.log(`  Elapsed: ${elapsed}s`);
      console.log(`  Degrees: [${currentGraph.map((a) => a.length).join(", ")}]`);
      console.log(`  Edges: ${currentGraph.reduce((s, a) => s + a.length, 0) / 2}`);
      console.log(`  Graph: ${JSON.stringify(currentGraph)}`);
      console.log("═══════════════════════════════════════════════\n");

      // Write to file
      const dataDir = join(import.meta.dir, "../data");
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(
        join(dataDir, "counterexample.json"),
        JSON.stringify({ n, iteration: i, graph: currentGraph }, null, 2),
      );
      return;
    }

    const candidateGraph = GraphMutator.mutate(currentGraph);
    if (!candidateGraph) {
      rejected++;
      continue;
    }

    const candidateEnergy = EnergyCalculator.calculateEnergy(candidateGraph);
    const deltaE = candidateEnergy - currentEnergy;

    // Metropolis-Hastings: accept improvements always,
    // accept worsening moves probabilistically based on temperature
    if (deltaE < 0 || Math.random() < Math.exp(-deltaE / temperature)) {
      currentGraph = candidateGraph;
      currentEnergy = candidateEnergy;
      accepted++;

      if (currentEnergy < bestEnergy) {
        bestEnergy = currentEnergy;
        bestGraph = currentGraph.map((a) => [...a]);
        console.log(`  📉 [Iter ${i.toLocaleString()}] New best energy: ${bestEnergy} (temp: ${temperature.toFixed(2)})`);
      }
    } else {
      rejected++;
    }

    temperature *= coolingRate;

    if (i % 50_000 === 0 && i > 0) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      const acceptRate = ((accepted / (accepted + rejected)) * 100).toFixed(1);
      console.log(
        `  [Iter ${i.toLocaleString().padStart(9)}] energy: ${currentEnergy.toString().padStart(4)} | best: ${bestEnergy.toString().padStart(4)} | temp: ${temperature.toFixed(2).padStart(8)} | accept: ${acceptRate}% | ${elapsed}s`,
      );
    }
  }

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log("\n═══════════════════════════════════════════════");
  console.log(`  ❌ Search exhausted after ${elapsed}s`);
  console.log(`  Lowest energy reached: ${bestEnergy}`);
  console.log(`  Best degrees: [${bestGraph.map((a) => a.length).join(", ")}]`);
  console.log(`  Accepted: ${accepted.toLocaleString()} | Rejected: ${rejected.toLocaleString()}`);
  console.log("═══════════════════════════════════════════════\n");
}

const targetN = parseInt(process.argv[2] || "18", 10);
const maxIter = parseInt(process.argv[3] || "500000", 10);

if (targetN % 2 !== 0) {
  console.error("❌ Initialization requires an even N to construct a cubic base graph.");
  process.exit(1);
}

runSimulatedAnnealing(targetN, maxIter).catch((err) => {
  console.error("💥 Stochastic Hunter failed:", err);
  process.exit(1);
});
