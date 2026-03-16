/**
 * SRG Worker — Frozen Anchor + Triangle Penalty + Valley-Depth Reheat
 *
 * Stacked optimizations:
 * 1. Frozen Anchor: Freeze vertex 0's existing k edges + λ edges among
 *    its neighbors. Preserves k-regularity perfectly.
 * 2. Triangle Penalty: |triangles - target| × weight in Metropolis.
 * 3. Valley-Depth Reheat: proportional to (itersSinceBest)^0.4 × E^0.4.
 */

import { AdjacencyMatrix } from "../../../src/math/graph/AdjacencyMatrix";
import { IncrementalSRGEngine } from "../../../src/math/graph/IncrementalSRGEngine";

declare var self: Worker;

// SA hyperparameters
const T0 = 100.0;
const ALPHA = 0.999995;
const REHEAT_EXPONENT = 0.4;
const BASE_WINDOW = 500_000;
const MAX_REHEAT_SCALE = 6.0;
const TRIANGLE_WEIGHT = 10.0;

const HEARTBEAT_INTERVAL = 500_000;

self.onmessage = (event: MessageEvent) => {
  const { workerId, v, k, lambda, mu, targetTriangles } = event.data;

  const g = AdjacencyMatrix.randomRegular(v, k);
  const engine = new IncrementalSRGEngine(g, k, lambda, mu);

  // Frozen Anchor: freeze vertex 0's existing edges (preserves k-regularity)
  const neighbors0 = g.neighbors(0);
  for (const nb of neighbors0) {
    engine.freezeEdge(0, nb);
  }
  // Also freeze λ-edges among vertex 0's neighbors
  if (lambda > 0) {
    for (let i = 0; i < neighbors0.length; i++) {
      for (let j = i + 1; j < neighbors0.length; j++) {
        if (g.hasEdge(neighbors0[i]!, neighbors0[j]!)) {
          engine.freezeEdge(neighbors0[i]!, neighbors0[j]!);
        }
      }
    }
  }

  const triTarget = targetTriangles ?? 0;
  let temp = T0;
  let bestCombined = Infinity;
  let bestFrob = engine.energy;
  let lastBestIter = 0;
  let iter = 0;
  let lastHeartbeatTime = performance.now();

  function getCombined(): number {
    return engine.energy + Math.abs(engine.getTriangleCount() - triTarget) * TRIANGLE_WEIGHT;
  }

  bestCombined = getCombined();

  self.postMessage({
    type: "READY",
    workerId,
    initialEnergy: engine.energy,
    triangles: engine.getTriangleCount(),
  });

  while (true) {
    if (engine.energy === 0 && engine.getTriangleCount() === triTarget) {
      self.postMessage({
        type: "SOLUTION",
        workerId,
        energy: 0,
        iter,
        triangles: engine.getTriangleCount(),
        state: new Uint8Array(engine.getGraph().raw),
      });
      return;
    }

    const frobDelta = engine.proposeRandomSwap();

    if (frobDelta !== null) {
      const triDelta = engine.getProposedTriangleDelta();
      const oldTriPenalty = Math.abs(engine.getTriangleCount() - triTarget);
      const newTriPenalty = Math.abs(engine.getTriangleCount() + triDelta - triTarget);
      const combinedDelta = frobDelta + (newTriPenalty - oldTriPenalty) * TRIANGLE_WEIGHT;

      if (combinedDelta < 0 || Math.random() < Math.exp(-combinedDelta / temp)) {
        engine.commitSwap();

        const ce = getCombined();
        if (ce < bestCombined) {
          bestCombined = ce;
          bestFrob = engine.energy;
          lastBestIter = iter;

          self.postMessage({
            type: "NEW_BEST",
            workerId,
            energy: engine.energy,
            combinedEnergy: ce,
            triangles: engine.getTriangleCount(),
            iter,
            state: new Uint8Array(engine.getGraph().raw),
          });
        }
      } else {
        engine.discardSwap();
      }
    }

    temp *= ALPHA;

    // Valley-depth reheat: proportional to both depth AND energy level
    const itersSinceBest = iter - lastBestIter;
    if (itersSinceBest > BASE_WINDOW && temp < 0.01) {
      const depthRatio = itersSinceBest / BASE_WINDOW;
      const depthScale = Math.pow(depthRatio, REHEAT_EXPONENT);
      const energyScale = Math.pow(Math.max(1, bestFrob), REHEAT_EXPONENT);
      const reheatTemp = energyScale * Math.min(1, depthScale / MAX_REHEAT_SCALE);
      temp = Math.max(0.5, reheatTemp);
      lastBestIter = iter;
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
        bestEnergy: bestFrob,
        triangles: engine.getTriangleCount(),
        temp,
        ips,
        iter,
      });
    }

    iter++;
  }
};
