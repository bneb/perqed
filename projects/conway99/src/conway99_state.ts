/**
 * Conway99State — IState adapter for Conway's 99-Graph Problem.
 *
 * Wraps an AdjacencyMatrix behind the generic IState<Uint8Array> interface,
 * targeting SRG(99, 14, 1, 2) via the shared graph utilities.
 */

import type { IState } from "../../../src/math/optim/IState";
import { AdjacencyMatrix } from "../../../src/math/graph/AdjacencyMatrix";
import { srgEnergy } from "../../../src/math/graph/SRGEnergy";
import { degreePreservingSwap } from "../../../src/math/graph/DegreePreservingSwap";

const N = 99;
const K = 14;
const LAMBDA = 1;
const MU = 2;

export class Conway99State implements IState<Uint8Array> {
  private readonly graph: AdjacencyMatrix;
  private cachedEnergy: number | null = null;

  constructor(graph: AdjacencyMatrix) {
    this.graph = graph;
  }

  getPayload(): Uint8Array {
    return this.graph.raw;
  }

  getEnergy(): number {
    if (this.cachedEnergy === null) {
      this.cachedEnergy = srgEnergy(this.graph, K, LAMBDA, MU);
    }
    return this.cachedEnergy;
  }

  mutate(): IState<Uint8Array> | null {
    const swapped = degreePreservingSwap(this.graph);
    if (!swapped) return null;
    return new Conway99State(swapped);
  }

  /** Access the underlying graph for inspection/export. */
  getGraph(): AdjacencyMatrix {
    return this.graph;
  }

  /** Create a random 14-regular starting graph on 99 vertices. */
  static createRandom(): Conway99State {
    const g = AdjacencyMatrix.randomRegular(N, K);
    return new Conway99State(g);
  }
}
