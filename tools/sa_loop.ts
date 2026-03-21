#!/usr/bin/env bun
/**
 * sa_loop.ts — Population-based SA + Z3 repair loop for Schur S(6) ≥ 537.
 *
 * Architecture:
 *   - Maintains an elite pool of N_POP best partitions (elitist GA style).
 *   - Each outer iteration spawns N_WORKERS parallel SA workers, each with a
 *     different seed strategy (diverse basin exploration).
 *   - When any worker hits E ≤ REPAIR_THRESHOLD, runs:
 *       1. Deep SA freeze pass (low temperature)
 *       2. Z3 boolean SAT repair (expanded window ~200-300 elements)
 *   - Saves E=0 witness to /tmp and exits.
 *
 * Usage:
 *   bun tools/sa_loop.ts [--rounds N] [--iters N] [--workers N]
 *
 * Examples:
 *   bun tools/sa_loop.ts                           # run 10000 rounds, 4 workers, 10M iters
 *   bun tools/sa_loop.ts --rounds=50 --workers=8  # 8 parallel workers per round
 */

import { runPartitionSA, type SeedStrategy } from "../src/search/partition_sa_worker";
import { runParallelSA, buildDiverseWorkerConfigs } from "../src/search/parallel_sa_coordinator";
import { findRepairWindow, generateZ3RepairScript } from "../src/search/z3_partition_repair";
import { runSphericalGradientDescent } from "../src/search/spherical_relaxation";
import { TheoremGraph } from "../src/proof_dag/theorem_graph";
import { SurrogateClient } from "../src/search/surrogate_client";
import { BridgeLearner, discreteSchurEnergy } from "../src/search/bridge_learner";
import { execSync } from "child_process";
import { writeFileSync, appendFileSync } from "fs";

// ── Config ────────────────────────────────────────────────────────────────────

const N = 537;
const K = 6;
const SA_ITERS  = parseInt(process.argv.find(a => a.startsWith("--iters="))?.split("=")[1]   ?? "10000000");
const MAX_ROUNDS = parseInt(process.argv.find(a => a.startsWith("--rounds="))?.split("=")[1]  ?? "10000");
const N_WORKERS  = parseInt(process.argv.find(a => a.startsWith("--workers="))?.split("=")[1] ?? "4");
const REPAIR_THRESHOLD = 50;  // trigger Z3 at or below this energy
const N_POP = 8;              // elite pool size

// Theorem graph: JSONL-backed obstruction tracker for ARCHITECT context injection
const theoremGraph = new TheoremGraph("/tmp/schur_theorem_graph.jsonl");
// Surrogate: partition value network (optional — graceful fallback if server offline)
const surrogate = new SurrogateClient("http://localhost:8765");
// Bridge Learner: self-improving manifold selection
const bridgeLearner = new BridgeLearner("/tmp/bridge_experiences.jsonl");

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeEnergy(p: Int8Array): number {
  let E = 0;
  for (let x = 1; x <= N; x++)
    for (let y = x; y <= N; y++) {
      const z = x + y;
      if (z > N) break;
      if (p[x] === p[y] && p[y] === p[z]) E++;
    }
  return E;
}

function saveWitness(partition: Int8Array, round: number, label = "witness"): void {
  const colorClasses: number[][] = Array.from({ length: K }, () => []);
  for (let i = 1; i <= N; i++) colorClasses[partition[i]!]!.push(i);

  const data = {
    label,
    round,
    timestamp: new Date().toISOString(),
    domain_size: N,
    num_partitions: K,
    energy: computeEnergy(partition),
    partition: Array.from(partition).slice(1),
    color_classes: colorClasses,
  };

  const path = `/tmp/schur_${label}_${Date.now()}.json`;
  writeFileSync(path, JSON.stringify(data, null, 2));
  console.log(`  💾 Saved to ${path}`);
  console.log(`\n  Coloring (first 50): ${Array.from(partition).slice(1, 51).join(",")}`);
  console.log(`  Coloring (last 50):  ${Array.from(partition).slice(N - 49).join(",")}`);
}

// Elite pool management
const elitePartitions: Int8Array[] = [];
const eliteEnergies: number[] = [];

function updateElite(partition: Int8Array, energy: number): boolean {
  const improved = eliteEnergies.length === 0 || energy < Math.min(...eliteEnergies);

  // Add unconditionally if pool not full
  if (elitePartitions.length < N_POP) {
    elitePartitions.push(new Int8Array(partition));
    eliteEnergies.push(energy);
    return improved;
  }

  // Replace worst if this is better
  const worstIdx = eliteEnergies.indexOf(Math.max(...eliteEnergies));
  if (energy < eliteEnergies[worstIdx]!) {
    elitePartitions[worstIdx] = new Int8Array(partition);
    eliteEnergies[worstIdx] = energy;
    return improved;
  }

  return improved;
}

function bestEliteEnergy(): number {
  return eliteEnergies.length === 0 ? Infinity : Math.min(...eliteEnergies);
}

// Online surrogate data collection — emits to partition_experiences.jsonl
const EXPERIENCE_PATH = "/tmp/partition_experiences.jsonl";
function emitSurrogateExperience(partition: Int8Array, energy: number): void {
  try {
    const enc = SurrogateClient.encodePartition(partition, N, K);
    const record = JSON.stringify({ partition_enc: enc, energy });
    appendFileSync(EXPERIENCE_PATH, record + "\n");
  } catch { /* non-fatal */ }
}

// Z3 repair
function runZ3Repair(partition: Int8Array, round: number, label: string): Int8Array | null {
  const { violatingTriples, repairElements } = findRepairWindow(partition, N);

  console.log(`  [${label}] 📐 ${violatingTriples.length} triples, ${repairElements.length} elements in repair window`);

  if (repairElements.length > 400) {
    console.log(`  [${label}] ⏭️  Window too large (${repairElements.length} > 400), skipping Z3`);
    return null;
  }

  console.log(`  [${label}] 🔧 Z3 SAT repair: ${repairElements.length} elements...`);
  const z3Script = generateZ3RepairScript(partition, N, K, repairElements);
  const scriptPath = "/tmp/schur_z3_repair.py";
  writeFileSync(scriptPath, z3Script);

  try {
    const z3Output = execSync(`python3 ${scriptPath}`, { timeout: 180_000 }).toString();
    if (z3Output.includes("sat") && !z3Output.includes("unsat")) {
      const repaired = new Int8Array(partition);
      for (const line of z3Output.split("\n")) {
        const match = line.match(/c_(\d+)=(\d+)/);
        if (match) repaired[parseInt(match[1]!)] = parseInt(match[2]!);
      }
      return repaired;
    }
    console.log(`  [${label}] ❌ Z3: ${z3Output.trim().split("\n")[0]}`);
    // Record to TheoremGraph as a structural obstruction
    theoremGraph.addNode({
      kind: "OBSTRUCTION",
      label: `Z3 UNSAT on ${repairElements.length}-elem window`,
      energy: computeEnergy(partition),
      evidence: `z3 returned unsat, ${repairElements.length} free vars`,
    });
  } catch (e: any) {
    console.log(`  [${label}] ❌ Z3 error: ${String(e.message).slice(0, 100)}`);
  }

  return null;
}

async function tryRepair(partition: Int8Array, energy: number, label: string, round: number): Promise<boolean> {
  console.log(`  [${label}] 🔬 E=${energy} — attempting repair...`);

  // Phase: Deep freeze SA pass (cold temperature, slow cooling)
  const freezeIters = Math.floor(SA_ITERS * 0.5);
  console.log(`  [${label}] ❄️  Deep freeze (T=0.5, ${(freezeIters / 1e6).toFixed(1)}M iters)...`);
  const frozen = await runPartitionSA({
    domain_size: N,
    num_partitions: K,
    sa_iterations: freezeIters,
    initial_temperature: 0.5,
    cooling_rate: 0.999999,
    warmStart: partition,
    description: `${label} freeze`,
  });

  let best = frozen.energy < energy ? frozen.partition : partition;
  let bestE = Math.min(frozen.energy, energy);

  if (frozen.energy < energy) {
    console.log(`  [${label}] 📉 Freeze: E=${energy} → ${frozen.energy}`);
    updateElite(frozen.partition, frozen.energy);
    if (frozen.energy === 0) {
      console.log(`\n  🎉🎉🎉 WITNESS via deep freeze! 🎉🎉🎉\n`);
      saveWitness(frozen.partition, round);
      return true;
    }
  } else {
    console.log(`  [${label}] 🧊 Freeze did not improve (${frozen.energy})`);
  }

  // Phase: Spherical Riemannian GD (S^(K-1) non-Euclidean continuous relaxation)
  console.log(`  [${label}] 📐 Spherical Riemannian GD...`);
  const { hardPartition: sphProjected, finalSphereEnergy } =
    await runSphericalGradientDescent(best, N, K, 8000, 0.01);
  const sphE = computeEnergy(sphProjected);
  console.log(`  [${label}] 📊 Spherical E=${sphE} (sphere energy=${finalSphereEnergy.toFixed(3)})`);
  if (sphE < bestE) {
    console.log(`  [${label}] ✨ Spherical improved: E=${bestE} → ${sphE}`);
    best = sphProjected;
    bestE = sphE;
    updateElite(sphProjected, sphE);
    if (sphE === 0) {
      console.log(`\n  🎉🎉🎉 WITNESS via spherical projection! 🎉🎉🎉\n`);
      saveWitness(sphProjected, round);
      return true;
    }
  }

  // Phase: Z3 repair
  const repaired = runZ3Repair(best, round, label);
  if (repaired) {
    const verifiedE = computeEnergy(repaired);
    if (verifiedE === 0) {
      console.log(`\n  🎉🎉🎉 WITNESS via Z3 repair! 🎉🎉🎉\n`);
      saveWitness(repaired, round);
      return true;
    }
    console.log(`  [${label}] ⚠️  Z3 SAT but verified E=${verifiedE}`);
    updateElite(repaired, verifiedE);
  }

  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${"═".repeat(65)}`);
  console.log(`  🔁 Population SA Loop — Schur S(6) ≥ 537`);
  console.log(`  SA iterations per worker: ${SA_ITERS.toLocaleString()}`);
  console.log(`  Workers per round: ${N_WORKERS}`);
  console.log(`  Max rounds: ${MAX_ROUNDS.toLocaleString()}`);
  console.log(`  Elite pool size: ${N_POP}`);
  console.log(`${"═".repeat(65)}\n`);

  // Surrogate: check if partition value network server is up
  const surrogateOnline = await surrogate.checkPartitionHealth().catch(() => false);
  if (surrogateOnline) {
    console.log(`  🧠 [Surrogate] Partition value network online (localhost:8765/partition)`);
  } else {
    console.log(`  💤 [Surrogate] Server offline — will collect data for future training`);
  }

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const t0 = Date.now();

    // Build diverse worker configs using elite pool for crossover
    const workerConfigs = buildDiverseWorkerConfigs(
      N_WORKERS,
      { domain_size: N, num_partitions: K, sa_iterations: SA_ITERS },
      elitePartitions.length >= 2 ? elitePartitions : undefined,
    );

    // Run all workers in parallel
    const { best: roundBest, allResults, wallTimeMs } = await runParallelSA({ workerConfigs });

    // Update elite pool with all results
    for (const r of allResults) {
      updateElite(r.partition, r.energy);
    }

    const newBest = bestEliteEnergy();
    const marker = roundBest.energy <= newBest ? "🔥 NEW BEST" : "";
    const strategies = workerConfigs.map(c => c.seed_strategy ?? "modular").join(",");
    console.log(`[Round ${round}] best=${roundBest.energy} elite=${newBest} (${(wallTimeMs / 1000).toFixed(1)}s) [${strategies}] ${marker}`);

    // Check for immediate success
    if (roundBest.energy === 0) {
      console.log(`\n  🎉🎉🎉 WITNESS FOUND directly from SA! 🎉🎉🎉\n`);
      saveWitness(roundBest.partition, round);
      return;
    }

    // Try repair on any result that's close enough
    // Also emit surrogate training data for all sub-threshold results
    for (let wi = 0; wi < allResults.length; wi++) {
      const r = allResults[wi]!;
      if (r.energy <= REPAIR_THRESHOLD) {
        emitSurrogateExperience(r.partition, r.energy);
      }
      if (r.energy > 0 && r.energy <= REPAIR_THRESHOLD) {
        const won = await tryRepair(r.partition, r.energy, `R${round}W${wi}`, round);
        if (won) return;
      }
    }

    // Score best round result via surrogate (observability, non-blocking)
    if (surrogateOnline && roundBest.energy <= REPAIR_THRESHOLD) {
      surrogate.predictPartition(SurrogateClient.encodePartition(roundBest.partition, N, K))
        .then(pred => console.log(`  🧠 [Surrogate] Predicted E=${pred.toFixed(1)} vs actual E=${roundBest.energy}`))
        .catch(() => {});
    }

    // ── Bridge Learner: propose + evaluate top-2 manifold candidates ──────────
    // Runs on every round, non-blocking relative to Z3. Updates reward model
    // and keeps result if it improves on the current best elite energy.
    if (round % 3 === 0) { // run every 3 rounds to avoid overhead
      const candidates = bridgeLearner.propose().slice(0, 2);
      for (const cand of candidates) {
        const elite = elitePartitions[eliteEnergies.indexOf(bestEliteEnergy())]!;
        const result = await bridgeLearner.evaluate(cand, elite, N, K, 500);
        bridgeLearner.updateRewardModel(cand, result);
        const reduction = result.discreteEBefore - result.discreteEAfter;
        if (reduction > 0) {
          console.log(`  🔬 [Bridge:${cand.manifold}] E ${result.discreteEBefore} → ${result.discreteEAfter} (−${reduction})`);
          // Re-compute hard partition from the manifold result for elite pool
          const enc = cand.encode(elite, N, K);
          const projected = cand.decode(enc, N); // warm start decoded
          const projectedE = result.discreteEAfter;
          updateElite(projected, projectedE);
          if (projectedE === 0) {
            console.log(`\n  🎉🎉🎉 WITNESS via ${cand.manifold} bridge! 🎉🎉🎉\n`);
            saveWitness(projected, round);
            return;
          }
        }
      }
    }
  }

  console.log(`\n  ⏱️  ${MAX_ROUNDS} rounds complete. Best E=${bestEliteEnergy()}. No witness found.`);
  if (elitePartitions.length > 0) {
    const bestIdx = eliteEnergies.indexOf(bestEliteEnergy());
    saveWitness(elitePartitions[bestIdx]!, MAX_ROUNDS, "best");
  }
}

main().catch(console.error);
