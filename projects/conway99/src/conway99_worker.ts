/**
 * Conway 99 Worker — Independent SA island running in a Web Worker.
 *
 * Runs an infinite Metropolis-Hastings loop against IncrementalSRGEngine.
 * Communicates with orchestrator via postMessage:
 *   - HEARTBEAT every 500K iterations (workerId, energy, temp, ips, iter)
 *   - NEW_BEST when a new local best is found (includes adjacency matrix)
 *
 * Uses E^(2/5) adaptive reheat with exponential backoff.
 */

import { AdjacencyMatrix } from "../../../src/math/graph/AdjacencyMatrix";
import { IncrementalSRGEngine } from "../../../src/math/graph/IncrementalSRGEngine";

declare var self: Worker;

// SA hyperparameters
const T0 = 100.0;
const ALPHA = 0.99999;
const REHEAT_WINDOW_INIT = 50_000;
const REHEAT_EXPONENT = 0.4;    // E^(2/5) reheat
const HEARTBEAT_INTERVAL = 500_000;

self.onmessage = (event: MessageEvent) => {
  const { workerId } = event.data;

  // Generate random initial graph
  const g = AdjacencyMatrix.randomRegular(99, 14);
  const engine = new IncrementalSRGEngine(g, 14, 1, 2);

  let temp = T0;
  let bestEnergy = engine.energy;
  let lastImproveIter = 0;
  let reheatWindow = REHEAT_WINDOW_INIT;
  let iter = 0;
  let lastHeartbeatTime = performance.now();

  // Signal ready
  self.postMessage({
    type: "READY",
    workerId,
    initialEnergy: engine.energy,
  });

  // The infinite hot loop
  while (true) {
    // Check for E=0
    if (engine.energy === 0) {
      const raw = engine.getGraph().raw;
      self.postMessage({
        type: "SOLUTION",
        workerId,
        energy: 0,
        iter,
        state: new Uint8Array(raw),
      });
      return; // Exit worker — we found it!
    }

    const delta = engine.proposeRandomSwap();

    if (delta !== null) {
      if (delta < 0 || Math.random() < Math.exp(-delta / temp)) {
        engine.commitSwap();

        if (engine.energy < bestEnergy) {
          bestEnergy = engine.energy;
          lastImproveIter = iter;
          reheatWindow = REHEAT_WINDOW_INIT;

          // Report new local best with state
          const raw = engine.getGraph().raw;
          self.postMessage({
            type: "NEW_BEST",
            workerId,
            energy: bestEnergy,
            iter,
            state: new Uint8Array(raw),
          });
        }
      } else {
        engine.discardSwap();
      }
    }

    // Exponential cooling
    temp *= ALPHA;

    // Adaptive E^(2/5) reheat with exponential backoff
    if (iter - lastImproveIter > reheatWindow) {
      const reheatTemp = Math.max(1, Math.pow(bestEnergy, REHEAT_EXPONENT));
      temp = reheatTemp;
      lastImproveIter = iter;
      reheatWindow = Math.min(reheatWindow * 2, 10_000_000);
    }

    // Heartbeat every 500K iters
    if (iter > 0 && iter % HEARTBEAT_INTERVAL === 0) {
      const now = performance.now();
      const ips = Math.round(HEARTBEAT_INTERVAL / ((now - lastHeartbeatTime) / 1000));
      lastHeartbeatTime = now;

      self.postMessage({
        type: "HEARTBEAT",
        workerId,
        energy: engine.energy,
        bestEnergy,
        temp,
        ips,
        iter,
      });
    }

    iter++;
  }
};
