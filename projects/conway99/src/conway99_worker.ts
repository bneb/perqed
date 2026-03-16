/**
 * Conway 99 Worker — Valley-Depth Proportional Reheat
 *
 * Reheat strategy: the deeper the valley (measured by iterations since
 * new best), the harder the kick.
 *
 *   reheatTemp = E^(2/5) × min(1, log₂(itersSinceBest / BASE_WINDOW))
 *
 * - Stuck < BASE_WINDOW: no reheat (still exploring current basin)
 * - Stuck 2× BASE_WINDOW: gentle (1× scale)
 * - Stuck 10× BASE_WINDOW: moderate (3.3× scale)
 * - Stuck 100× BASE_WINDOW: full (6.6× scale)
 *
 * Cooling rate: α = 0.999999 (10× slower than original for deeper exploration)
 */

import { AdjacencyMatrix } from "../../../src/math/graph/AdjacencyMatrix";
import { IncrementalSRGEngine } from "../../../src/math/graph/IncrementalSRGEngine";

declare var self: Worker;

// SA hyperparameters
const T0 = 100.0;
const ALPHA = 0.999999;          // 10× slower cooling
const REHEAT_EXPONENT = 0.4;     // E^(2/5) base
const BASE_WINDOW = 500_000;     // minimum iters before first reheat
const MAX_REHEAT_SCALE = 6.0;    // cap on log₂ scale

const HEARTBEAT_INTERVAL = 500_000;

self.onmessage = (event: MessageEvent) => {
  const { workerId } = event.data;

  const g = AdjacencyMatrix.randomRegular(99, 14);
  const engine = new IncrementalSRGEngine(g, 14, 1, 2);

  let temp = T0;
  let bestEnergy = engine.energy;
  let lastBestIter = 0;
  let iter = 0;
  let lastHeartbeatTime = performance.now();

  self.postMessage({
    type: "READY",
    workerId,
    initialEnergy: engine.energy,
  });

  while (true) {
    if (engine.energy === 0) {
      self.postMessage({
        type: "SOLUTION",
        workerId,
        energy: 0,
        iter,
        state: new Uint8Array(engine.getGraph().raw),
      });
      return;
    }

    const delta = engine.proposeRandomSwap();

    if (delta !== null) {
      if (delta < 0 || Math.random() < Math.exp(-delta / temp)) {
        engine.commitSwap();

        if (engine.energy < bestEnergy) {
          bestEnergy = engine.energy;
          lastBestIter = iter;

          self.postMessage({
            type: "NEW_BEST",
            workerId,
            energy: bestEnergy,
            iter,
            state: new Uint8Array(engine.getGraph().raw),
          });
        }
      } else {
        engine.discardSwap();
      }
    }

    // Exponential cooling
    temp *= ALPHA;

    // Valley-depth proportional reheat
    const itersSinceBest = iter - lastBestIter;
    if (itersSinceBest > BASE_WINDOW && temp < 0.01) {
      // Scale proportional to log₂(depth / BASE_WINDOW)
      const depthRatio = itersSinceBest / BASE_WINDOW;
      const scale = Math.min(MAX_REHEAT_SCALE, Math.log2(depthRatio));
      const reheatTemp = Math.pow(bestEnergy, REHEAT_EXPONENT) * (scale / MAX_REHEAT_SCALE);
      temp = Math.max(1, reheatTemp);
      lastBestIter = iter; // reset to prevent immediate re-trigger
    }

    // Heartbeat
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
