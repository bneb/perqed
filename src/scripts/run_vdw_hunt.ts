/**
 * run_vdw_hunt.ts
 *
 * An autonomous execution script to hunt for the unknown Van der Waerden number W(5,3) > 170.
 *
 * The Van der Waerden number W(5,3) is the smallest integer N such that any 5-coloring
 * of [1..N] contains a monochromatic arithmetic progression of length 3.
 *
 * Current math records show W(5,3) > 170. If we can find a coloring of length 171
 * with ZERO monochromatic 3-term APs, we have extended the boundary of mathematical
 * knowledge (proving W(5,3) > 171).
 *
 * This script runs the heavily optimized `partition_sa_worker` targeting `vdw` energy.
 */

import { runPartitionSA } from "../search/partition_sa_worker";
import type { PartitionSAConfig, SeedStrategy } from "../search/partition_sa_worker";

const N = 171; // Target domain size
const K = 5;   // 5 Colors
const AP = 3;  // AP length 3

async function main() {
  console.log(`\n======================================================`);
  console.log(`🚀 HUNTING VAN DER WAERDEN BOUNDARY W(${K}, ${AP}) > ${N - 1}`);
  console.log(`======================================================\n`);

  const strategies: SeedStrategy[] = ["random", "random", "random", "random", "blocks"];
  
  // We'll run a few heavy SA instances concurrently to see if any can melt to 0
  const promises = strategies.map(async (strat, idx) => {
    const config: PartitionSAConfig = {
      domain_size: N,
      num_partitions: K,
      energy_target: "vdw",
      ap_length: AP,
      sa_iterations: 10_000_000,
      initial_temperature: 3.0,
      seed_strategy: strat,
      description: `Worker ${idx} (${strat})`,
    };

    console.log(`[Worker ${idx}] Starting SA run with seed strategy: ${strat}...`);
    const start = performance.now();
    const result = await runPartitionSA(config);
    const timeMs = performance.now() - start;

    console.log(`\n[Worker ${idx}] FINISHED in ${(timeMs / 1000).toFixed(2)}s`);
    console.log(`[Worker ${idx}] Final Energy: ${result.energy}`);
    
    if (result.energy === 0) {
      console.log(`\n🎉🎉🎉 HOLY GRAIL ACHIEVED! Witness found for W(${K}, ${AP}) > ${N}! 🎉🎉🎉`);
      console.log(`Partition Array: [${Array.from(result.partition).slice(1).join(", ")}]`);
      Bun.write(`vdw_witness_${N}.txt`, Array.from(result.partition).slice(1).join(""));
    }
    
    return result;
  });

  const results = await Promise.all(promises);

  const best = results.reduce((min, r) => (r.energy < min.energy ? r : min), results[0]);
  
  if (best.energy > 0) {
    console.log(`\n======================================================`);
    console.log(`⚠️ Search Complete. Best energy found was ${best.energy}`);
    console.log(`Attempting to push through local minima might require more iterations or crossovers.`);
    console.log(`======================================================\n`);
  }
}

main().catch(console.error);
