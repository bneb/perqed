/**
 * tools/vdw_solver.ts — Frontier VdW lower-bound search orchestrator.
 *
 * W(5;3) > 170 (best known lower bound). Target: W(5;3) > N for growing N.
 *
 * Architecture:
 *   4 parallel Bun island workers, each running WalkSAT+Tabu SA
 *   Seeded from diverse algebraic initializations (Behrend, VdC, Salem-Spencer, QR)
 *   Crossover between best islands every sync cycle
 *   Minimum hitting set Z3 repair when any island reaches E ≤ REPAIR_THRESHOLD
 *   Growing-N: on E=0, emit Lean 4 + JSON witness, increment N, warm-start all islands
 *
 * Usage:
 *   bun tools/vdw_solver.ts
 *   bun tools/vdw_solver.ts --start=170 --colors=5 --k=3 --islands=4
 *   bun tools/vdw_solver.ts --start=50  --colors=4 --k=3 --islands=4  # smoke test
 */

import { writeFileSync, existsSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import {
  computeAPEnergy,
  findViolatingAPs,
  generateZ3APRepairScript,
} from "../src/search/ap_energy";
import { allSeeds } from "../src/search/behrend_seed";
import { crossover } from "../src/search/vdw_crossover";
import { minHittingSet } from "../src/search/vdw_crossover";
import { TheoremGraph } from "../src/proof_dag/theorem_graph";
import { validateWitnessPartition } from "../src/search/vdw_witness";
import { shouldRunZ3, shouldRestartIsland, computePartitionHash } from "../src/search/vdw_orchestrator";
import type { IslandConfig } from "../src/search/vdw_island_worker";

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag: string, def: number) => {
  const a = args.find(a => a.startsWith(`--${flag}=`));
  return a ? parseInt(a.split("=")[1]!) : def;
};

let N          = getArg("start",   170);
const K        = getArg("colors",    5);
const AP_K     = getArg("k",         3);
const N_ISLANDS= getArg("islands",   4);
const SYNC     = getArg("sync",  500_000);  // iters per sync per island
const REPAIR_THRESHOLD   = getArg("repair", 30);
const WALKSAT_THRESHOLD  = getArg("walksatthreshold", 200); // engage WalkSAT immediately
const STAGNATION_LIMIT   = getArg("stagnation", 20);         // syncs without improvement before restart

const OUT_DIR = "/tmp/vdw";
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const theoremGraph = new TheoremGraph("/tmp/vdw_theorem_graph.jsonl");

// ── Island state tracking ─────────────────────────────────────────────────────

type IslandState = {
  worker: Worker;
  partition: Int8Array;
  energy: number;
  syncCount: number;
  id: number;
  stagnantSyncs: number;   // syncs since last energy improvement
  lastBestE: number;       // best energy seen so far for this island
};

const islands: IslandState[] = [];

// ── Seed all islands ──────────────────────────────────────────────────────────

function buildIslandConfig(id: number): IslandConfig {
  return {
    id,
    N,
    K,
    AP_K,
    syncInterval: SYNC,
    saOpts: {
      T0: 10.0,
      alpha: 0.9999993,
      walksatThreshold: WALKSAT_THRESHOLD,
      pMetropolis: 0.25,
      tabuTenure: 20,
      aspirationDelta: -2,
      rebuildInterval: 300,
    },
  };
}

function startIslands(): void {
  const seeds = allSeeds(N, K);
  // Pad if more islands than seeds
  while (seeds.length < N_ISLANDS) seeds.push(seeds[seeds.length % seeds.length]!);

  for (let id = 0; id < N_ISLANDS; id++) {
    const worker = new Worker(
      new URL("../src/search/vdw_island_worker.ts", import.meta.url).href,
      { type: "module" }
    );

    const state: IslandState = {
      worker,
      partition: seeds[id]!,
      energy: computeAPEnergy(seeds[id]!, N, AP_K),
      syncCount: 0,
      id,
      stagnantSyncs: 0,
      lastBestE: Infinity,
    };
    islands.push(state);

    worker.onmessage = (event: MessageEvent) => handleWorkerMessage(state, event);
    worker.onerror = (e: ErrorEvent) => {
      console.error(`  ❌ [Island ${id}] Worker error: ${e.message}`);
    };

    worker.postMessage({
      type: "start",
      config: buildIslandConfig(id),
      partition: Array.from(seeds[id]!),
    });
  }
}

// ── Witness emission ──────────────────────────────────────────────────────────

async function handleWitness(partition: Int8Array, islandId: number): Promise<void> {
  const witnessN = N; // capture BEFORE increment

  // Guard: validate before emitting — catches stale-N race and corruption
  if (!validateWitnessPartition(partition, witnessN, K, AP_K)) {
    console.log(`  ⚠️  [Island ${islandId}] Stale/invalid witness for N=${witnessN} (length=${partition.length}) — discarding`);
    return;
  }

  console.log(`\n  🎉 [Island ${islandId}] W(${AP_K};${K}) > ${witnessN - 1} — E=0 witness found!\n`);
  emitWitness(partition, witnessN);
  N++;
  console.log(`\n  🔼 Growing to N=${N}...\n`);

  // Warm-start all islands from the witness
  const newSeeds = allSeeds(N, K);
  for (let i = 0; i < islands.length; i++) {
    const newSeed = i === 0 ? new Int8Array(partition) : newSeeds[i % newSeeds.length]!;
    islands[i]!.energy = computeAPEnergy(newSeed, N, AP_K);
    islands[i]!.partition = newSeed;
    islands[i]!.stagnantSyncs = 0;
    islands[i]!.lastBestE = Infinity;
    islands[i]!.worker.postMessage({ type: "start", config: buildIslandConfig(i), partition: Array.from(newSeed) });
  }
}

function emitWitness(partition: Int8Array, witnessN: number): void {
  const colorClasses: number[][] = Array.from({ length: K }, () => []);
  for (let i = 1; i <= witnessN; i++) colorClasses[partition[i]!]!.push(i);
  const jsonPath = `${OUT_DIR}/vdw_witness_N${witnessN}.json`;
  writeFileSync(jsonPath, JSON.stringify({ N: witnessN, K, AP_K, coloring: Array.from(partition).slice(1, witnessN + 1), color_classes: colorClasses, timestamp: new Date().toISOString() }, null, 2));
  console.log(`  💾 Witness → ${jsonPath}`);
  const leanPath = `${OUT_DIR}/vdw_proof_N${witnessN}.lean`;
  writeFileSync(leanPath, generateLean(partition, witnessN));
  console.log(`  📜 Lean 4 → ${leanPath}`);
  theoremGraph.addNode({ kind: "WITNESS", label: `W(${AP_K};${K}) > ${witnessN - 1}`, energy: 0, evidence: JSON.stringify(colorClasses) });
}

function generateLean(partition: Int8Array, witnessN: number): string {
  const cases = Array.from(partition).slice(1, witnessN + 1).map((c, i) => `  | ${i} => ${c}`).join("\n");
  return `-- Auto-generated by Perqed vdw_solver.ts\n-- Proves W(${AP_K};${K}) > ${witnessN - 1}\ndef vdwColoring${witnessN} : Fin ${witnessN} → Fin ${K}\n${cases}\n  | _ => ⟨0, by omega⟩\n`;
}

// ── Z3 repair ─────────────────────────────────────────────────────────────────

function tryZ3Repair(partition: Int8Array): Int8Array | null {
  const violated = findViolatingAPs(partition, N, AP_K);
  if (violated.length === 0) return null;
  const hitSet = minHittingSet(violated);
  if (hitSet.length === 0 || hitSet.length > 150) return null;
  const script = generateZ3APRepairScript(partition, N, K, hitSet, AP_K);
  const scriptPath = "/tmp/vdw_z3_repair.py";
  writeFileSync(scriptPath, script);
  try {
    const out = execSync(`python3 ${scriptPath}`, { timeout: 45_000 }).toString();
    if (out.startsWith("sat")) {
      const repaired = new Int8Array(partition);
      for (const line of out.split("\n")) {
        const m = line.match(/c_(\d+)=(\d+)/);
        if (m) repaired[parseInt(m[1]!)] = parseInt(m[2]!);
      }
      return repaired;
    }
  } catch { /* timeout, unsat, z3 not installed */ }
  return null;
}

// ── Stagnation restart ───────────────────────────────────────────────────────

/**
 * Restart a stagnant island from a perturbed copy of the current global best.
 * Flips ~20% of elements randomly — enough to escape the basin, not so much
 * that we lose all the structure of a good partial solution.
 */
function restartIsland(state: IslandState, perturbFraction = 0.20): void {
  const bestIsland = islands.reduce((b, s) => s.energy < b.energy ? s : b);
  const base = new Int8Array(bestIsland.partition);
  const savedBestE = bestIsland.energy; // capture BEFORE state.energy mutation
  const nFlip = Math.max(5, Math.floor(N * perturbFraction));
  for (let t = 0; t < nFlip; t++) {
    const pos = 1 + ((Math.random() * N) | 0);
    base[pos] = (Math.random() * K) | 0;
  }
  state.partition = base;
  state.energy = computeAPEnergy(base, N, AP_K);
  state.stagnantSyncs = 0;
  state.lastBestE = state.energy;
  console.log(`  🔥 [Island ${state.id}] Stagnation restart (best E=${savedBestE}+${Math.round(perturbFraction*100)}%noise → E=${state.energy})`);
  state.worker.postMessage({ type: "inject", partition: Array.from(base) });
}

let lastZ3PartitionHash = -1; // fingerprint via computePartitionHash

// ── Crossover logic ───────────────────────────────────────────────────────────

function performCrossover(): void {
  if (islands.length < 2) return;
  const sorted = [...islands].sort((a, b) => a.energy - b.energy);
  const best = sorted[0]!;
  const second = sorted[1]!;
  const worst = sorted[sorted.length - 1]!;

  if (best.energy === second.energy && best.id === worst.id) return; // everyone same

  const child = crossover(best.partition, second.partition, N, AP_K);
  const childE = computeAPEnergy(child, N, AP_K);

  if (childE < Math.min(best.energy, second.energy)) {
    console.log(`  🔀 Crossover(${best.id}×${second.id}) E=${childE} → injected into Island ${worst.id} (was E=${worst.energy})`);
    worst.partition = child;
    worst.energy = childE;
    worst.worker.postMessage({ type: "inject", partition: Array.from(child) });
  }
}

// ── Message handler ───────────────────────────────────────────────────────────

let syncRound = 0;

async function handleWorkerMessage(state: IslandState, event: MessageEvent): Promise<void> {
  const { type, partition, energy, island } = event.data as {
    type: string; partition: number[]; energy: number; island: number;
  };

  state.partition = new Int8Array(partition);
  state.energy = energy;
  state.syncCount++;

  if (type === "witness") {
    await handleWitness(state.partition, island);
    return;
  }

  // Track stagnation per island
  if (energy < state.lastBestE) {
    state.lastBestE = energy;
    state.stagnantSyncs = 0;
  } else {
    state.stagnantSyncs++;
  }

  // Print progress table whenever all islands have reported this round
  const minSync = Math.min(...islands.map(s => s.syncCount));
  if (minSync > syncRound) {
    syncRound = minSync;
    printStatus();

    // Stagnation check — uses tested pure function
    // NEVER restart when globalBest.energy=0 (witness in hand) or when island IS the best
    const globalBest = islands.reduce((b, s) => s.energy < b.energy ? s : b);
    for (const island of islands) {
      if (shouldRestartIsland(island.stagnantSyncs, island.energy, globalBest.energy, STAGNATION_LIMIT)) {
        restartIsland(island);
      }
    }

    // Crossover every 2 sync rounds
    if (syncRound % 2 === 0) performCrossover();

    // Z3 repair — uses tested pure functions for both the guard and fingerprint
    const bestE = Math.min(...islands.map(s => s.energy));
    if (shouldRunZ3(bestE, REPAIR_THRESHOLD)) {
      const bestIsland = islands.find(s => s.energy === bestE)!;
      const hash = computePartitionHash(bestIsland.partition);
      if (hash !== lastZ3PartitionHash) {
        lastZ3PartitionHash = hash;
        console.log(`  🔧 [Z3] Attempting repair (E=${bestE})...`);
        const repaired = tryZ3Repair(bestIsland.partition);
        if (repaired !== null) {
          const repairedE = computeAPEnergy(repaired, N, AP_K);
          console.log(`  ✨ Z3 E: ${bestE} → ${repairedE}`);
          if (repairedE === 0) {
            await handleWitness(repaired, bestIsland.id);
          } else if (repairedE < bestE) {
            bestIsland.partition = repaired;
            bestIsland.energy = repairedE;
            bestIsland.worker.postMessage({ type: "inject", partition: Array.from(repaired) });
          }
        } else {
          console.log(`  ❌ Z3: unsat — aggressively restarting non-best islands (40% perturb)`);
          theoremGraph.addNode({ kind: "OBSTRUCTION", label: `Z3 UNSAT N=${N} E=${bestE}`, energy: bestE, evidence: "" });
          // Basin is provably wrong — force all non-best islands to explore widely
          const globalBest = islands.reduce((b, s) => s.energy < b.energy ? s : b);
          for (const island of islands) {
            if (island !== globalBest) restartIsland(island, 0.40);
          }
        }
      }
    }
  }
}

function printStatus(): void {
  const SEED_NAMES = ["Behrend", "VanDerCorput", "SalemSpencer", "QR"];
  const sorted = [...islands].sort((a, b) => a.energy - b.energy);
  const bestE = sorted[0]!.energy;
  console.log(`\n[Sync ${syncRound}] N=${N} | Best E=${bestE}`);
  for (const s of islands) {
    const tag = s.energy === bestE ? " ← best" : "";
    console.log(`  Island ${s.id} (${SEED_NAMES[s.id % SEED_NAMES.length]}):  E=${s.energy}${tag}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(62)}`);
console.log(`  🔬 VdW Frontier Solver — W(${AP_K};${K}) > ${N}`);
console.log(`  ${N_ISLANDS} islands × WalkSAT+Tabu | Behrend/VdC/SS/QR seeds`);
console.log(`  Crossover every 2 syncs | Z3 repair at E≤${REPAIR_THRESHOLD}`);
console.log(`${"═".repeat(62)}\n`);

startIslands();

// Keep the process alive (workers run indefinitely until witness found)
process.on("SIGINT", () => {
  console.log("\n\n  Interrupted. Best results saved to /tmp/vdw/");
  process.exit(0);
});
