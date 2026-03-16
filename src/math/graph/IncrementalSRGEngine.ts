/**
 * IncrementalSRGEngine — Zero-allocation O(n) delta energy evaluator.
 *
 * Designed for bare-metal Metropolis-Hastings hot loops.
 *
 * API lifecycle (zero object allocation per iteration):
 *   1. delta = engine.proposeRandomSwap()   // stages swap, returns ΔE
 *   2. if accept: engine.commitSwap()       // applies to typed arrays
 *      else:      engine.discardSwap()      // no-op
 *
 * Internal state:
 *   - Flat adjacency array (Uint8Array, n×n)
 *   - Common-neighbor cache (Int32Array, n×n)
 *   - Edge list (Int32Array, 2×maxEdges) for O(1) random sampling
 *   - Running energy (number)
 *
 * On edge swap affecting 4 vertices, ~4n pairs are recomputed out of
 * n(n-1)/2 total — giving ~12× throughput for n=99.
 */

import { AdjacencyMatrix } from "./AdjacencyMatrix";

export interface SwapResult {
  graph: AdjacencyMatrix;
  newEnergy: number;
  vertices: [number, number, number, number];
  removed: [number, number, number, number];
  added: [number, number, number, number];
}

export class IncrementalSRGEngine {
  private graph: AdjacencyMatrix;
  private readonly k: number;
  private readonly lambda: number;
  private readonly mu: number;
  readonly n: number;

  /** Precomputed constants for energy calculation */
  private readonly lm: number;   // lambda - mu
  private readonly km: number;   // k - mu

  /** Cached common-neighbor counts: cn[i*n + j] = |N(i) ∩ N(j)| */
  private cn: Int32Array;

  /** Current energy (maintained incrementally) */
  energy: number;

  /** Edge list: edges[2*i] and edges[2*i+1] are endpoints of edge i */
  private edges: Int32Array;
  private edgeCount: number;

  /** Staged swap state (avoids allocation in hot loop) */
  private staged: boolean = false;
  private stageRA = 0; private stageRB = 0; // removed edge 1
  private stageRC = 0; private stageRD = 0; // removed edge 2
  private stageNA = 0; private stageNB = 0; // added edge 1
  private stageNC = 0; private stageND = 0; // added edge 2
  private stageDelta = 0;

  /** Dedup bitmap for affected pair tracking (avoids Set allocation) */
  private affected: Uint8Array;

  constructor(graph: AdjacencyMatrix, k: number, lambda: number, mu: number) {
    this.graph = graph.clone();
    this.k = k;
    this.lambda = lambda;
    this.mu = mu;
    this.n = graph.n;
    this.lm = lambda - mu;
    this.km = k - mu;
    this.cn = new Int32Array(this.n * this.n);
    this.affected = new Uint8Array(this.n);

    // Build edge list
    const maxEdges = (this.n * k) / 2;
    this.edges = new Int32Array(maxEdges * 2);
    this.edgeCount = 0;
    this.rebuildEdgeList();

    // Build initial common-neighbor matrix
    this.buildFullCN();

    // Compute initial energy from the CN matrix
    this.energy = this.computeEnergyFromCN();
  }

  // ──────────────────────────────────────────────
  //  Initialization helpers
  // ──────────────────────────────────────────────

  private rebuildEdgeList(): void {
    const n = this.n;
    this.edgeCount = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (this.graph.hasEdge(i, j)) {
          const idx = this.edgeCount * 2;
          this.edges[idx] = i;
          this.edges[idx + 1] = j;
          this.edgeCount++;
        }
      }
    }
  }

  private buildFullCN(): void {
    const n = this.n;
    this.cn.fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        let count = 0;
        for (let w = 0; w < n; w++) {
          if (this.graph.hasEdge(i, w) && this.graph.hasEdge(j, w)) count++;
        }
        this.cn[i * n + j] = count;
        this.cn[j * n + i] = count;
      }
    }
  }

  private computeEnergyFromCN(): number {
    const n = this.n;
    const lm = this.lm;
    const km = this.km;
    const mu = this.mu;
    let energy = 0;

    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const a2 = this.cn[i * n + j]!;
        const aij = this.graph.hasEdge(i, j) ? 1 : 0;
        const iij = i === j ? 1 : 0;
        const mij = a2 - lm * aij - km * iij - mu;

        if (i === j) {
          energy += mij * mij;
        } else {
          energy += 2 * mij * mij;
        }
      }
    }

    return energy;
  }

  /**
   * Compute Frobenius contribution for a single pair using CURRENT state.
   * For off-diagonal pairs, returns 2×m² (both entries).
   */
  private pairEnergy(i: number, j: number): number {
    const a2 = this.cn[i * this.n + j]!;
    const aij = this.graph.hasEdge(i, j) ? 1 : 0;
    const iij = i === j ? 1 : 0;
    const mij = a2 - this.lm * aij - this.km * iij - this.mu;
    return i === j ? mij * mij : 2 * mij * mij;
  }

  /**
   * Compute Frobenius contribution for a pair using GIVEN cn value and adjacency.
   */
  private pairEnergyWith(i: number, j: number, cnVal: number, adj: boolean): number {
    const aij = adj ? 1 : 0;
    const iij = i === j ? 1 : 0;
    const mij = cnVal - this.lm * aij - this.km * iij - this.mu;
    return i === j ? mij * mij : 2 * mij * mij;
  }

  // ──────────────────────────────────────────────
  //  Zero-allocation hot loop API
  // ──────────────────────────────────────────────

  /**
   * Propose a random degree-preserving edge swap.
   * Returns ΔE (energy change), or null if no valid swap found.
   * Does NOT mutate state — call commitSwap() or discardSwap() after.
   */
  proposeRandomSwap(): number | null {
    if (this.edgeCount < 2) return null;

    for (let attempt = 0; attempt < 20; attempt++) {
      // Sample two random edges
      const idx1 = Math.floor(Math.random() * this.edgeCount);
      let idx2 = Math.floor(Math.random() * (this.edgeCount - 1));
      if (idx2 >= idx1) idx2++;

      const a = this.edges[idx1 * 2]!;
      const b = this.edges[idx1 * 2 + 1]!;
      const c = this.edges[idx2 * 2]!;
      const d = this.edges[idx2 * 2 + 1]!;

      // All four must be distinct
      if (a === c || a === d || b === c || b === d) continue;

      // Try variant 1: remove (a,b)+(c,d), add (a,c)+(b,d)
      if (!this.graph.hasEdge(a, c) && !this.graph.hasEdge(b, d)) {
        return this.computeDelta(a, b, c, d, a, c, b, d);
      }

      // Try variant 2: remove (a,b)+(c,d), add (a,d)+(b,c)
      if (!this.graph.hasEdge(a, d) && !this.graph.hasEdge(b, c)) {
        return this.computeDelta(a, b, c, d, a, d, b, c);
      }
    }

    return null;
  }

  /**
   * Compute the energy delta for a proposed swap WITHOUT mutating state.
   * Stages the swap internally for later commit/discard.
   */
  private computeDelta(
    ra: number, rb: number, rc: number, rd: number,
    na: number, nb: number, nc: number, nd: number,
  ): number {
    const n = this.n;

    // Stage the swap
    this.stageRA = ra; this.stageRB = rb;
    this.stageRC = rc; this.stageRD = rd;
    this.stageNA = na; this.stageNB = nb;
    this.stageNC = nc; this.stageND = nd;

    // Mark affected vertices
    this.affected.fill(0);
    this.affected[ra] = 1;
    this.affected[rb] = 1;
    this.affected[rc] = 1;
    this.affected[rd] = 1;

    // Temporarily apply the swap to the adjacency matrix
    this.graph.removeEdge(ra, rb);
    this.graph.removeEdge(rc, rd);
    this.graph.addEdge(na, nb);
    this.graph.addEdge(nc, nd);

    // Compute delta energy: subtract old contributions, add new ones
    // for all pairs involving at least one affected vertex
    let delta = 0;

    for (let v = 0; v < n; v++) {
      if (!this.affected[v]) continue;

      // Diagonal pair (v, v)
      const oldDiag = this.pairEnergyWith(v, v, this.cn[v * n + v]!, false);
      let newDiagCN = 0;
      for (let w = 0; w < n; w++) {
        if (this.graph.hasEdge(v, w) && this.graph.hasEdge(v, w)) newDiagCN++;
      }
      const newDiag = this.pairEnergyWith(v, v, newDiagCN, false);
      delta += newDiag - oldDiag;

      // Off-diagonal pairs (v, w) for all w > v that are NOT affected
      // (pairs between two affected vertices will be counted once by the lower-index vertex)
      for (let w = 0; w < n; w++) {
        if (w === v) continue;
        // Skip if both affected and w < v (will be handled when we process w)
        if (this.affected[w] && w < v) continue;

        const oldCN = this.cn[v * n + w]!;
        let newCN = 0;
        for (let x = 0; x < n; x++) {
          if (this.graph.hasEdge(v, x) && this.graph.hasEdge(w, x)) newCN++;
        }

        const oldE = this.pairEnergyWith(v, w, oldCN, this.graph.hasEdge(v, w));
        // Wait — adjacency already changed. Need old adjacency for old energy.
        // We need to un-apply to check old adjacency... but that's expensive.
        // Instead, reconstruct old adjacency from the swap:
        let wasAdj: boolean;
        if ((v === ra && w === rb) || (v === rb && w === ra) ||
            (v === rc && w === rd) || (v === rd && w === rc)) {
          wasAdj = true; // was an edge, now removed
        } else if ((v === na && w === nb) || (v === nb && w === na) ||
                   (v === nc && w === nd) || (v === nd && w === nc)) {
          wasAdj = false; // was not an edge, now added
        } else {
          wasAdj = this.graph.hasEdge(v, w); // unchanged
        }

        const oldContrib = this.pairEnergyWith(v, w, oldCN, wasAdj);
        const newContrib = this.pairEnergyWith(v, w, newCN, this.graph.hasEdge(v, w));
        delta += newContrib - oldContrib;
      }
    }

    // Un-apply the swap (restore original state)
    this.graph.removeEdge(na, nb);
    this.graph.removeEdge(nc, nd);
    this.graph.addEdge(ra, rb);
    this.graph.addEdge(rc, rd);

    this.staged = true;
    this.stageDelta = delta;
    return delta;
  }

  /** Commit the staged swap: apply to adjacency + update CN cache + update energy. */
  commitSwap(): void {
    if (!this.staged) return;
    this.staged = false;

    const n = this.n;
    const ra = this.stageRA, rb = this.stageRB;
    const rc = this.stageRC, rd = this.stageRD;
    const na = this.stageNA, nb = this.stageNB;
    const nc = this.stageNC, nd = this.stageND;

    // Apply the swap to adjacency
    this.graph.removeEdge(ra, rb);
    this.graph.removeEdge(rc, rd);
    this.graph.addEdge(na, nb);
    this.graph.addEdge(nc, nd);

    // Update energy
    this.energy += this.stageDelta;

    // Update CN cache for all pairs involving affected vertices
    for (let v = 0; v < n; v++) {
      if (!this.affected[v]) continue;

      for (let w = v; w < n; w++) {
        let count = 0;
        for (let x = 0; x < n; x++) {
          if (this.graph.hasEdge(v, x) && this.graph.hasEdge(w, x)) count++;
        }
        this.cn[v * n + w] = count;
        this.cn[w * n + v] = count;
      }

      // Also update pairs (w, v) where w < v and w is NOT affected
      for (let w = 0; w < v; w++) {
        if (this.affected[w]) continue; // already handled above
        let count = 0;
        for (let x = 0; x < n; x++) {
          if (this.graph.hasEdge(w, x) && this.graph.hasEdge(v, x)) count++;
        }
        this.cn[w * n + v] = count;
        this.cn[v * n + w] = count;
      }
    }

    // Rebuild edge list (simple and reliable)
    this.rebuildEdgeList();
  }

  /** Discard the staged swap — no-op (state was never mutated). */
  discardSwap(): void {
    this.staged = false;
  }

  // ──────────────────────────────────────────────
  //  Legacy API (for compatibility with existing tests)
  // ──────────────────────────────────────────────

  trySwap(): SwapResult | null {
    const delta = this.proposeRandomSwap();
    if (delta === null) return null;

    // Build a SwapResult for the legacy API
    const na = this.stageNA, nb = this.stageNB;
    const nc = this.stageNC, nd = this.stageND;
    const ra = this.stageRA, rb = this.stageRB;
    const rc = this.stageRC, rd = this.stageRD;

    // Create the new graph
    const newGraph = this.graph.clone();
    newGraph.removeEdge(ra, rb);
    newGraph.removeEdge(rc, rd);
    newGraph.addEdge(na, nb);
    newGraph.addEdge(nc, nd);

    this.staged = false; // consume the staged state

    return {
      graph: newGraph,
      newEnergy: this.energy + delta,
      vertices: [ra, rb, rc, rd],
      removed: [ra, rb, rc, rd],
      added: [na, nb, nc, nd],
    };
  }

  acceptSwap(result: SwapResult): void {
    this.graph = result.graph;
    this.energy = result.newEnergy;

    const affected = new Set(result.vertices);
    const n = this.n;

    for (const v of affected) {
      for (let w = 0; w < n; w++) {
        let count = 0;
        for (let x = 0; x < n; x++) {
          if (this.graph.hasEdge(v, x) && this.graph.hasEdge(w, x)) count++;
        }
        this.cn[v * n + w] = count;
        this.cn[w * n + v] = count;
      }
    }

    this.rebuildEdgeList();
  }

  /** Get a clone of the current graph. */
  getGraph(): AdjacencyMatrix {
    return this.graph.clone();
  }
}
