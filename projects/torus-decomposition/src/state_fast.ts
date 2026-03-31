/**
 * ClaudeStateFast — Mutable, Incremental Energy for Torus Decomposition
 *
 * Unlike ClaudeState (immutable, full recalc), this class mutates in-place
 * and maintains cached energy with O(1) in-degree deltas and O(V) cycle
 * recount only for changed colors. Rejected moves are undone via rollback.
 *
 * This class is NOT compatible with the IState interface (which requires
 * immutable mutate()). Instead, it exposes tryMutation/acceptMutation/
 * rejectMutation for direct SA integration.
 *
 * For IState compatibility (fuzz testing), it also provides a mutate()
 * method that clones.
 */

import type { IState } from "../../../src/math/optim/IState";

export class ClaudeStateFast implements IState<number[]> {
  readonly payload: number[];
  readonly m: number;
  readonly vCount: number;

  /** Per-color successor cache */
  readonly succ: Int32Array[];

  /** Per-color in-degree counts */
  readonly inDeg: Uint8Array[];

  /** Cached cycle counts per color */
  private colorCycles: [number, number, number];

  /** Cached in-degree violations */
  private inDegViolations: number;

  /** Rollback state for rejected mutations */
  private rollback: {
    vertex: number;
    oldPerm: number;
    oldSucc: [number, number, number]; // old successors per color
    oldInDegViolations: number;
    oldColorCycles: [number, number, number];
    inDegChanges: Array<{ color: number; target: number; oldVal: number }>;
  } | null = null;

  static readonly PERMUTATIONS: readonly number[][] = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];

  private constructor(
    payload: number[],
    m: number,
    succ: Int32Array[],
    inDeg: Uint8Array[],
    colorCycles: [number, number, number],
    inDegViolations: number,
  ) {
    this.payload = payload;
    this.m = m;
    this.vCount = m * m * m;
    this.succ = succ;
    this.inDeg = inDeg;
    this.colorCycles = colorCycles;
    this.inDegViolations = inDegViolations;
  }

  getPayload(): number[] { return this.payload; }

  getEnergy(): number {
    return (this.colorCycles[0] + this.colorCycles[1] + this.colorCycles[2] - 3)
      + this.inDegViolations;
  }

  /**
   * Try a mutation in-place. Call acceptMutation() or rejectMutation() after.
   * Returns the energy delta (negative = improvement).
   */
  tryMutation(vertex: number, newPerm: number): number {
    const oldPerm = this.payload[vertex]!;
    const oldSucc: [number, number, number] = [
      this.succ[0]![vertex]!,
      this.succ[1]![vertex]!,
      this.succ[2]![vertex]!,
    ];
    const oldInDegViolations = this.inDegViolations;
    const oldColorCycles: [number, number, number] = [...this.colorCycles];
    const inDegChanges: Array<{ color: number; target: number; oldVal: number }> = [];

    for (let color = 0; color < 3; color++) {
      const oldS = this.succ[color]![vertex]!;
      const newS = this.computeSuccessorWithPerm(vertex, color, newPerm);

      if (oldS === newS) continue;

      // In-degree delta (O(1))
      const oldValOldS = this.inDeg[color]![oldS]!;
      const oldValNewS = this.inDeg[color]![newS]!;

      // Save for rollback
      inDegChanges.push({ color, target: oldS, oldVal: oldValOldS });
      inDegChanges.push({ color, target: newS, oldVal: oldValNewS });

      if (oldValOldS !== 1) this.inDegViolations--;
      if (oldValNewS !== 1) this.inDegViolations--;

      this.inDeg[color]![oldS] = (this.inDeg[color]![oldS] ?? 0) - 1;
      this.inDeg[color]![newS] = (this.inDeg[color]![newS] ?? 0) + 1;

      if (this.inDeg[color]![oldS] !== 1) this.inDegViolations++;
      if (this.inDeg[color]![newS] !== 1) this.inDegViolations++;

      // Cycle delta: recount this color's cycles
      this.succ[color]![vertex] = newS;
      this.colorCycles[color] = this.countColorCycles(color);
    }

    this.payload[vertex] = newPerm;

    this.rollback = {
      vertex, oldPerm, oldSucc,
      oldInDegViolations, oldColorCycles, inDegChanges,
    };

    return this.getEnergy() -
      ((oldColorCycles[0] + oldColorCycles[1] + oldColorCycles[2] - 3) + oldInDegViolations);
  }

  /** Accept the last mutation (no-op, just clear rollback). */
  acceptMutation(): void {
    this.rollback = null;
  }

  /** Reject the last mutation, restore previous state. */
  rejectMutation(): void {
    const rb = this.rollback!;

    this.payload[rb.vertex] = rb.oldPerm;

    // Restore successors
    for (let color = 0; color < 3; color++) {
      this.succ[color]![rb.vertex] = rb.oldSucc[color]!;
    }

    // Restore in-degrees
    for (const { color, target, oldVal } of rb.inDegChanges) {
      this.inDeg[color]![target] = oldVal;
    }

    this.inDegViolations = rb.oldInDegViolations;
    this.colorCycles = rb.oldColorCycles;
    this.rollback = null;
  }

  /**
   * IState-compatible mutate() for testing. Creates a clone.
   * Not used in the fast SA loop.
   */
  mutate(): IState<number[]> | null {
    const vertex = Math.floor(Math.random() * (this.vCount - 1)) + 1;
    let newPerm = Math.floor(Math.random() * 5);
    if (newPerm >= this.payload[vertex]!) newPerm++;

    // Clone, then mutate the clone in-place
    const child = this.cloneState();
    child.tryMutation(vertex, newPerm);
    child.acceptMutation();
    return child;
  }

  /** Count cycles in a single color's successor graph (O(V)). */
  private countColorCycles(color: number): number {
    const visited = new Uint8Array(this.vCount);
    let cycles = 0;
    const succArr = this.succ[color]!;
    for (let start = 0; start < this.vCount; start++) {
      if (!visited[start]) {
        cycles++;
        let node = start;
        while (!visited[node]) {
          visited[node] = 1;
          node = succArr[node]!;
        }
      }
    }
    return cycles;
  }

  /** Full energy recalculation (for fuzz validation). */
  fullEnergy(): number {
    let totalCycles = 0;
    let violations = 0;

    for (let color = 0; color < 3; color++) {
      totalCycles += this.countColorCycles(color);

      const deg = new Uint8Array(this.vCount);
      for (let v = 0; v < this.vCount; v++) {
        deg[this.succ[color]![v]!] = (deg[this.succ[color]![v]!] ?? 0) + 1;
      }
      for (let v = 0; v < this.vCount; v++) {
        if (deg[v] !== 1) violations++;
      }
    }

    return (totalCycles - 3) + violations;
  }

  private computeSuccessorWithPerm(
    nodeIndex: number, targetColor: number, perm: number,
  ): number {
    const m = this.m;
    const k = nodeIndex % m;
    const j = Math.floor(nodeIndex / m) % m;
    const i = Math.floor(nodeIndex / (m * m));

    const assignment = ClaudeStateFast.PERMUTATIONS[perm]!;

    if (assignment[0] === targetColor) {
      return ((i + 1) % m) * m * m + j * m + k;
    } else if (assignment[1] === targetColor) {
      return i * m * m + ((j + 1) % m) * m + k;
    } else {
      return i * m * m + j * m + ((k + 1) % m);
    }
  }

  private cloneState(): ClaudeStateFast {
    return new ClaudeStateFast(
      [...this.payload],
      this.m,
      [new Int32Array(this.succ[0]!), new Int32Array(this.succ[1]!), new Int32Array(this.succ[2]!)],
      [new Uint8Array(this.inDeg[0]!), new Uint8Array(this.inDeg[1]!), new Uint8Array(this.inDeg[2]!)],
      [...this.colorCycles],
      this.inDegViolations,
    );
  }

  static create(payload: number[], m: number = 4): ClaudeStateFast {
    const vCount = m * m * m;
    const succ = [new Int32Array(vCount), new Int32Array(vCount), new Int32Array(vCount)];
    const inDeg = [new Uint8Array(vCount), new Uint8Array(vCount), new Uint8Array(vCount)];
    const PERMS = ClaudeStateFast.PERMUTATIONS;

    for (let v = 0; v < vCount; v++) {
      const ki = v % m;
      const ji = Math.floor(v / m) % m;
      const ii = Math.floor(v / (m * m));
      const assignment = PERMS[payload[v]!]!;

      for (let color = 0; color < 3; color++) {
        let s: number;
        if (assignment[0] === color) s = ((ii + 1) % m) * m * m + ji * m + ki;
        else if (assignment[1] === color) s = ii * m * m + ((ji + 1) % m) * m + ki;
        else s = ii * m * m + ji * m + ((ki + 1) % m);
        succ[color]![v] = s;
        inDeg[color]![s] = (inDeg[color]![s] ?? 0) + 1;
      }
    }

    // Count cycles per color
    const colorCycles: [number, number, number] = [0, 0, 0];
    for (let color = 0; color < 3; color++) {
      const visited = new Uint8Array(vCount);
      for (let start = 0; start < vCount; start++) {
        if (!visited[start]) {
          colorCycles[color]!++;
          let node = start;
          while (!visited[node]) { visited[node] = 1; node = succ[color]![node]!; }
        }
      }
    }

    let inDegViolations = 0;
    for (let color = 0; color < 3; color++) {
      for (let v = 0; v < vCount; v++) {
        if (inDeg[color]![v] !== 1) inDegViolations++;
      }
    }

    return new ClaudeStateFast([...payload], m, succ, inDeg, colorCycles, inDegViolations);
  }

  static createRandom(m: number = 4): ClaudeStateFast {
    const vCount = m * m * m;
    const payload = new Array(vCount);
    payload[0] = 0;
    for (let i = 1; i < vCount; i++) {
      payload[i] = Math.floor(Math.random() * 6);
    }
    return ClaudeStateFast.create(payload, m);
  }
}
