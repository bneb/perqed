/**
 * vdw_island_worker.ts — Bun Worker for one parallel SA island.
 *
 * Receives messages from the main vdw_solver.ts orchestrator and runs
 * WalkSAT+Tabu SA autonomously, posting progress every syncInterval iterations.
 *
 * Protocol:
 *   Main → Worker: { type: 'start', config: IslandConfig }
 *   Worker → Main: { type: 'progress', partition: number[], energy: number, island: number }
 *   Worker → Main: { type: 'witness',  partition: number[], energy: number, island: number }
 *   Main → Worker: { type: 'inject', partition: number[], resetTemp?: boolean }
 */

import { computeAPEnergy } from "./ap_energy";
import { runWalkSATTabu, type WalkSATOpts } from "./walksat_tabu";

export interface IslandConfig {
  id: number;
  N: number;
  K: number;
  AP_K: number;
  syncInterval: number;   // iters per progress report
  saOpts: WalkSATOpts;
}

let cfg: IslandConfig;
let current: Int8Array;
let generation = 0; // incremented on each "start" message; old loops exit early

self.onmessage = (event: MessageEvent) => {
  const { type } = event.data as { type: string };

  if (type === "start") {
    cfg = event.data.config as IslandConfig;
    current = new Int8Array(event.data.partition as number[]);
    const myGen = ++generation;
    void runIsland(myGen);

  } else if (type === "inject") {
    // Crossover offspring injected — update current for next iteration
    current = new Int8Array(event.data.partition as number[]);
  }
};

async function runIsland(myGen: number): Promise<void> {
  while (myGen === generation) {
    const result = runWalkSATTabu(
      new Int8Array(current),
      cfg.N, cfg.K, cfg.AP_K,
      cfg.syncInterval,
      cfg.saOpts,
    );

    // If generation changed while running, silently discard result
    if (myGen !== generation) return;

    current = result.partition;

    if (result.energy === 0) {
      self.postMessage({
        type: "witness",
        partition: Array.from(current),
        energy: 0,
        island: cfg.id,
      });
      return; // stop — main thread will send a new "start" for N+1
    }

    self.postMessage({
      type: "progress",
      partition: Array.from(current),
      energy: result.energy,
      island: cfg.id,
    });

    // Yield to allow inject/start messages to be processed
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
}
