/**
 * Ramsey SA Worker Thread Entrypoint.
 *
 * Runs inside a Bun Worker thread. Receives search config via
 * postMessage, runs the SA search, and posts back progress + result.
 *
 * Messages:
 *   IN:  { type: "start", config: RamseySearchConfig (with raw graph data), workerIndex: number }
 *   OUT: { type: "progress", worker, iter, energy, best, temp }
 *   OUT: { type: "done", worker, result: RamseySearchResult }
 */

import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import { ramseySearch, type RamseySearchConfig } from "./ramsey_worker";

declare var self: Worker;

self.onmessage = (event: MessageEvent) => {
  const { type, config, workerIndex } = event.data;

  if (type === "start") {
    // Reconstruct AdjacencyMatrix from raw data if present
    const saConfig: RamseySearchConfig = {
      n: config.n,
      r: config.r,
      s: config.s,
      maxIterations: config.maxIterations,
      initialTemp: config.initialTemp,
      coolingRate: config.coolingRate,
    };

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
