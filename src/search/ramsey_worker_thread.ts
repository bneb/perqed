/**
 * Ramsey SA Worker Thread Entrypoint.
 *
 * Runs inside a Bun Worker thread. Receives search config via
 * postMessage, runs the SA search, and posts back progress + result.
 *
 * MicroSAT Synchronization Protocol:
 *   1. Thread allocates a SharedArrayBuffer(4) [the "lock"] and passes it
 *      in the STERILE_BASIN message alongside the basin snapshot.
 *   2. ramseySearch() Atomics.wait-parks on the lock after posting.
 *   3. Orchestrator runs Z3 async, then Atomics.notify wakes this thread.
 *   4. Thread reads config.microSatPatch.adj:
 *        non-null → apply, skip scatter
 *        null     → proceed to scatter normally
 *
 * Messages:
 *   IN:  { type: "start", config: RamseySearchConfig (with raw graph data), workerIndex: number }
 *   OUT: { type: "progress", worker, iter, energy, best, temp }
 *   OUT: { type: "STERILE_BASIN", worker, energy, bestAdjRaw, bestAdjN, lock }
 *   OUT: { type: "done", worker, result: RamseySearchResult }
 *   IN:  { type: "RESUME_WITH_PATCH", patchedAdjRaw: number[] | null, patchedAdjN: number }
 */

import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import { ramseySearch, type RamseySearchConfig } from "./ramsey_worker";

declare var self: Worker;

// Shared state for MicroSAT synchronization — one per sterile basin event.
// Allocated fresh for each basin so concurrent basins across workers
// don't share state (each worker has its own thread + lock).
let activeLock: SharedArrayBuffer | null = null;
let activeLockView: Int32Array | null = null;
let activePatch: { adj: AdjacencyMatrix | null } = { adj: null };

self.onmessage = (event: MessageEvent) => {
  const { type, config, workerIndex } = event.data;

  if (type === "RESUME_WITH_PATCH") {
    // Orchestrator finished MicroSAT — write the patch and wake the SA loop.
    const { patchedAdjRaw, patchedAdjN } = event.data;
    if (patchedAdjRaw && patchedAdjN) {
      const patched = new AdjacencyMatrix(patchedAdjN);
      const raw = new Int8Array(patchedAdjRaw);
      for (let i = 0; i < raw.length; i++) patched.raw[i] = raw[i]!;
      activePatch.adj = patched;
    } else {
      activePatch.adj = null;  // no patch → scatter normally
    }
    if (activeLockView) {
      // Write non-zero to wake Atomics.wait in the SA loop.
      Atomics.store(activeLockView, 0, 1);
      Atomics.notify(activeLockView, 0, 1);
    }
    return;
  }

  if (type === "start") {
    // Reconstruct AdjacencyMatrix from raw data if present
    const saConfig: RamseySearchConfig = {
      n: config.n,
      r: config.r,
      s: config.s,
      maxIterations: config.maxIterations,
      initialTemp: config.initialTemp,
      coolingRate: config.coolingRate,
      symmetry: config.symmetry,
      minPatience: config.minPatience,
      // ── Tabu hash injection ──────────────────────────────────────────────
      tabuHashes: config.tabuHashes,
      tabuPenaltyTemperature: config.tabuPenaltyTemperature,
      // ── MicroSAT synchronization ─────────────────────────────────────────
      microSatThreshold: config.microSatThreshold,
      microSatPatch: activePatch,
    };

    if (config.microSatThreshold !== undefined) {
      // Allocate a fresh lock for this worker's lifetime.
      // Reset to 0 so Atomics.wait will block correctly.
      activeLock = new SharedArrayBuffer(4);
      activeLockView = new Int32Array(activeLock);
      Atomics.store(activeLockView, 0, 0);
      saConfig.microSatLock = activeLock;

      // Wire the STERILE_BASIN postMessage as the onSterilBasin callback.
      // The SA loop will call this synchronously just before Atomics.wait.
      saConfig.onSterilBasin = (bestAdj: AdjacencyMatrix, bestEnergy: number) => {
        // Reset lock to 0 so the next Atomics.wait will block.
        Atomics.store(activeLockView!, 0, 0);
        activePatch.adj = null;
        self.postMessage({
          type: "STERILE_BASIN",
          worker: workerIndex,
          energy: bestEnergy,
          bestAdjRaw: Array.from(bestAdj.raw),
          bestAdjN: bestAdj.n,
          // Send the lock so the orchestrator can Atomics.notify us.
          lock: activeLock,
        });
      };
    }

    // Boot telemetry — visible in the main thread log via progress messages
    const tabuCount = saConfig.tabuHashes?.length ?? 0;
    self.postMessage({
      type: "progress",
      worker: workerIndex,
      iter: 0,
      energy: -1,
      best: -1,
      temp: saConfig.initialTemp,
      tabuCount,
    });

    if (config.initialGraphRaw && config.initialGraphN) {
      const g = new AdjacencyMatrix(config.initialGraphN);
      const raw = new Int8Array(config.initialGraphRaw);
      for (let i = 0; i < raw.length; i++) {
        g.raw[i] = raw[i]!;
      }
      saConfig.initialGraph = g;
    }

    const result = ramseySearch(saConfig, (iter, energy, best, temp) => {
      if (iter % 10_000_000 === 0) {
        self.postMessage({ type: "progress", worker: workerIndex, iter, energy, best, temp });
      }
    });

    // Serialize the witness for transfer (AdjacencyMatrix → raw Int8Array)
    const serializedResult = {
      bestEnergy: result.bestEnergy,
      iterations: result.iterations,
      ips: result.ips,
      telemetry: result.telemetry,
      witnessRaw: result.witness ? Array.from(result.witness.raw) : null,
      witnessN: result.witness?.n ?? 0,
      // Always serialize bestAdj for multi-candidate LNS selection
      bestAdjRaw: Array.from(result.bestAdj.raw),
      bestAdjN: result.bestAdj.n,
    };

    self.postMessage({ type: "done", worker: workerIndex, result: serializedResult });
  }
};
