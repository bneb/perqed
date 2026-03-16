/**
 * Conway99State — IState adapter for Conway's 99-Graph Problem.
 *
 * Uses IncrementalSRGEngine for O(n) energy evaluation per swap,
 * targeting SRG(99, 14, 1, 2).
 *
 * The incremental engine maintains a cached common-neighbor matrix
 * and running energy, recomputing only ~396 affected pairs per swap
 * instead of all 4,851 — a ~12× throughput improvement.
 */

import type { IState } from "../../../src/math/optim/IState";
import { AdjacencyMatrix } from "../../../src/math/graph/AdjacencyMatrix";
import { IncrementalSRGEngine } from "../../../src/math/graph/IncrementalSRGEngine";
import type { SwapResult } from "../../../src/math/graph/IncrementalSRGEngine";

const N = 99;
const K = 14;
const LAMBDA = 1;
const MU = 2;

export class Conway99State implements IState<Uint8Array> {
  private readonly engine: IncrementalSRGEngine;

  constructor(engine: IncrementalSRGEngine) {
    this.engine = engine;
  }

  getPayload(): Uint8Array {
    return this.engine.getGraph().raw;
  }

  getEnergy(): number {
    return this.engine.energy;
  }

  mutate(): IState<Uint8Array> | null {
    const result = this.engine.trySwap();
    if (!result) return null;

    // Create a new state with accepted swap
    // Clone the engine state for immutability
    const newEngine = new IncrementalSRGEngine(
      result.graph, K, LAMBDA, MU,
    );

    return new Conway99State(newEngine);
  }

  /** Access the underlying graph for inspection/export. */
  getGraph(): AdjacencyMatrix {
    return this.engine.getGraph();
  }

  /** Create a random 14-regular starting graph on 99 vertices. */
  static createRandom(): Conway99State {
    const g = AdjacencyMatrix.randomRegular(N, K);
    const engine = new IncrementalSRGEngine(g, K, LAMBDA, MU);
    return new Conway99State(engine);
  }
}
