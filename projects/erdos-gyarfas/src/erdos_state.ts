/**
 * Sprint 23: ErdosState — IState adapter for Erdős-Gyárfás
 *
 * Wraps the existing EnergyCalculator and GraphMutator behind the
 * generic IState<number[][]> interface. Provides lazy energy caching
 * and immutability guarantees via deep cloning.
 */

import type { IState } from "../../../src/math/optim/IState";
import { EnergyCalculator } from "./energy_calculator";
import { GraphMutator } from "./graph_mutator";

export class ErdosState implements IState<number[][]> {
  private readonly payload: number[][];
  private cachedEnergy: number | null = null;

  constructor(adj: number[][]) {
    // Deep clone to guarantee immutability
    this.payload = adj.map((neighbors) => [...neighbors]);
  }

  getPayload(): number[][] {
    return this.payload;
  }

  getEnergy(): number {
    if (this.cachedEnergy === null) {
      this.cachedEnergy = EnergyCalculator.calculateEnergy(this.payload);
    }
    return this.cachedEnergy;
  }

  mutate(): IState<number[][]> | null {
    const mutatedAdj = GraphMutator.mutate(this.payload);
    if (!mutatedAdj) return null;
    return new ErdosState(mutatedAdj);
  }

  /** Factory: create a circular cubic graph (3-regular) as starting point. */
  static createCubic(n: number): ErdosState {
    const adj: number[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      const prev = (i - 1 + n) % n;
      const across = (i + Math.floor(n / 2)) % n;
      adj[i] = Array.from(new Set([next, prev, across]));
    }
    return new ErdosState(adj);
  }
}
