/**
 * Sprint 26: ClaudeState — Knuth's 3D Directed Torus Decomposition
 *
 * Implements IState<number[]> for the m=4 Hamiltonian decomposition problem.
 *
 * The Problem (Knuth, March 2026):
 *   Given a 3D directed grid graph with m³ vertices (i,j,k < m) and edges
 *   pointing to (i+1,j,k), (i,j+1,k), (i,j,k+1) mod m, decompose the
 *   3m³ arcs into exactly 3 directed Hamiltonian cycles.
 *
 * The State:
 *   An array of 64 integers (0-5), where each value selects one of 3! = 6
 *   permutations assigning colors {0,1,2} to directions {X,Y,Z} at that vertex.
 *
 * The Energy:
 *   Each color subgraph is 1-regular (in-degree 1, out-degree 1), so it
 *   decomposes into disjoint cycles. Count total cycles across all 3 colors.
 *   Perfect decomposition = exactly 3 cycles. Energy = totalCycles - 3.
 *   Energy 0 = SOLUTION FOUND.
 */

import type { IState } from "../../../src/math/optim/IState";

export class ClaudeState implements IState<number[]> {
  private readonly payload: number[];
  private cachedEnergy: number | null = null;
  readonly m: number;
  readonly vCount: number;

  /** Maps permutation index (0-5) to [ColorX, ColorY, ColorZ] */
  static readonly PERMUTATIONS: readonly number[][] = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];

  constructor(payload: number[], m: number = 4) {
    this.payload = [...payload];
    this.m = m;
    this.vCount = m * m * m;
  }

  getPayload(): number[] {
    return this.payload;
  }

  getEnergy(): number {
    if (this.cachedEnergy === null) {
      this.cachedEnergy = this.calculateEnergy();
    }
    return this.cachedEnergy;
  }

  mutate(): IState<number[]> | null {
    const newPayload = [...this.payload];
    // Pin vertex 0 to permutation 0 (WLOG: breaks 3! color symmetry)
    const vertex = Math.floor(Math.random() * (this.vCount - 1)) + 1;

    let newPerm = Math.floor(Math.random() * 5);
    if (newPerm >= newPayload[vertex]!) newPerm++;

    newPayload[vertex] = newPerm;
    return new ClaudeState(newPayload, this.m);
  }

  private calculateEnergy(): number {
    let totalCycles = 0;
    let inDegreeViolations = 0;

    for (let color = 0; color < 3; color++) {
      // Count cycle components (functional graph traversal)
      const visited = new Uint8Array(this.vCount);
      for (let start = 0; start < this.vCount; start++) {
        if (!visited[start]) {
          totalCycles++;
          let node = start;
          while (!visited[node]) {
            visited[node] = 1;
            node = this.successor(node, color);
          }
        }
      }

      // Count in-degree violations: each vertex must receive exactly 1
      // incoming arc of this color. Without this, lassos score E=0.
      const inDeg = new Uint8Array(this.vCount);
      for (let v = 0; v < this.vCount; v++) {
        inDeg[this.successor(v, color)]++;
      }
      for (let v = 0; v < this.vCount; v++) {
        if (inDeg[v] !== 1) inDegreeViolations++;
      }
    }

    return (totalCycles - 3) + inDegreeViolations;
  }

  private successor(nodeIndex: number, targetColor: number): number {
    const m = this.m;
    const k = nodeIndex % m;
    const j = Math.floor(nodeIndex / m) % m;
    const i = Math.floor(nodeIndex / (m * m));

    const assignment = ClaudeState.PERMUTATIONS[this.payload[nodeIndex]!]!;

    if (assignment[0] === targetColor) {
      return ((i + 1) % m) * m * m + j * m + k;
    } else if (assignment[1] === targetColor) {
      return i * m * m + ((j + 1) % m) * m + k;
    } else {
      return i * m * m + j * m + ((k + 1) % m);
    }
  }

  static createRandom(m: number = 4): ClaudeState {
    const vCount = m * m * m;
    const payload = new Array(vCount);
    payload[0] = 0; // WLOG: pin vertex 0 to break 3! color symmetry
    for (let i = 1; i < vCount; i++) {
      payload[i] = Math.floor(Math.random() * 6);
    }
    return new ClaudeState(payload, m);
  }
}
