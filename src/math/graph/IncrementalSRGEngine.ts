/**
 * IncrementalSRGEngine — Hyper-Optimized O(n) Delta Energy Evaluator
 *
 * Zero-allocation Metropolis-Hastings hot loop API for SRG search.
 *
 * Three critical optimizations over the naive approach:
 *   1. O(1) edge sampling via fixed adjacency list (Int32Array, n×k)
 *      + O(k) adjList updates on commit instead of O(n²) rebuild
 *   2. Scratchpad CN caching: compute CN delta once in propose,
 *      replay on commit with zero recomputation
 *   3. Versioned affected tracker: no array fill(0) per proposal
 *
 * API lifecycle:
 *   delta = engine.proposeRandomSwap()  // stages, returns ΔE
 *   if accept: engine.commitSwap()      // O(4k + scratchSize) apply
 *   else:      engine.discardSwap()     // no-op
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
  readonly n: number;
  private readonly k: number;
  private readonly lambda: number;
  private readonly mu: number;
  private readonly lm: number;   // lambda - mu
  private readonly km: number;   // k - mu

  /** Common-neighbor cache: cn[i*n + j] = |N(i) ∩ N(j)| */
  private cn: Int32Array;

  /** Current energy */
  energy: number;

  // ── Optimization 1: Fixed adjacency list for O(1) edge sampling ──
  /** adjList[v*k + i] = ith neighbor of vertex v */
  private adjList: Int32Array;

  // ── Optimization 2: Scratchpad CN caching ──
  /** Keys (i*n+j) of CN entries to update on commit */
  private scratchKeys: Int32Array;
  /** Corresponding new CN values */
  private scratchVals: Int32Array;
  /** Number of valid entries in scratchpad */
  private scratchSize: number = 0;

  // ── Optimization 3: Versioned affected tracking ──
  /** Version counter, incremented per proposal */
  private affectedVersion: number = 0;
  /** affected[v] === affectedVersion means v is affected */
  private affectedArr: Uint32Array;

  // ── Staged swap state (all primitives, zero allocation) ──
  private staged: boolean = false;
  private stageRA = 0; private stageRB = 0;
  private stageRC = 0; private stageRD = 0;
  private stageNA = 0; private stageNB = 0;
  private stageNC = 0; private stageND = 0;
  private stageDelta = 0;

  constructor(graph: AdjacencyMatrix, k: number, lambda: number, mu: number) {
    this.graph = graph.clone();
    this.k = k;
    this.lambda = lambda;
    this.mu = mu;
    this.n = graph.n;
    this.lm = lambda - mu;
    this.km = k - mu;

    this.cn = new Int32Array(this.n * this.n);
    this.adjList = new Int32Array(this.n * k);
    this.affectedArr = new Uint32Array(this.n);

    // Max scratchpad: ~4 affected vertices × n pairs × 2 directions ≈ 8n
    const maxScratch = 8 * this.n + 16;
    this.scratchKeys = new Int32Array(maxScratch);
    this.scratchVals = new Int32Array(maxScratch);

    this.buildAdjList();
    this.buildFullCN();
    this.energy = this.computeEnergyFromCN();
  }

  // ──────────────────────────────────────────────
  //  Initialization
  // ──────────────────────────────────────────────

  private buildAdjList(): void {
    const { n, k } = this;
    for (let v = 0; v < n; v++) {
      let idx = 0;
      const base = v * k;
      for (let w = 0; w < n && idx < k; w++) {
        if (this.graph.hasEdge(v, w)) {
          this.adjList[base + idx] = w;
          idx++;
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
    const { n, lm, km, mu } = this;
    let energy = 0;
    for (let i = 0; i < n; i++) {
      // Skip diagonal: for k-regular graphs, M_ii = k - (k-μ) - μ = 0 always
      for (let j = i + 1; j < n; j++) {
        const a2 = this.cn[i * n + j]!;
        const aij = this.graph.hasEdge(i, j) ? 1 : 0;
        const mij = a2 - lm * aij - mu;
        energy += 2 * mij * mij;
      }
    }
    return energy;
  }

  // ──────────────────────────────────────────────
  //  Pair energy helpers
  // ──────────────────────────────────────────────

  /** Frobenius contribution for off-diagonal pair (always ×2). */
  private pairE(cnVal: number, adj: boolean): number {
    const mij = cnVal - this.lm * (adj ? 1 : 0) - this.mu;
    return 2 * mij * mij;
  }

  // ──────────────────────────────────────────────
  //  Zero-allocation hot loop API
  // ──────────────────────────────────────────────

  /**
   * Propose a random degree-preserving edge swap.
   * Returns ΔE, or null if no valid swap found.
   * Does NOT mutate persistent state.
   */
  proposeRandomSwap(): number | null {
    const { n, k } = this;

    for (let attempt = 0; attempt < 20; attempt++) {
      // O(1) edge sampling via adjacency list
      const a = Math.floor(Math.random() * n);
      const aIdx = Math.floor(Math.random() * k);
      const b = this.adjList[a * k + aIdx]!;

      const c = Math.floor(Math.random() * n);
      const cIdx = Math.floor(Math.random() * k);
      const d = this.adjList[c * k + cIdx]!;

      // All four must be distinct
      if (a === c || a === d || b === c || b === d) continue;
      // Must be different edges
      if (a === d && b === c) continue;

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
   * Compute ΔE for a proposed swap.
   * Temporarily applies swap to adjacency for CN computation,
   * then restores. Stores new CN values in scratchpad.
   */
  private computeDelta(
    ra: number, rb: number, rc: number, rd: number,
    na: number, nb: number, nc: number, nd: number,
  ): number {
    const { n, lm, mu } = this;

    // Stage the swap
    this.stageRA = ra; this.stageRB = rb;
    this.stageRC = rc; this.stageRD = rd;
    this.stageNA = na; this.stageNB = nb;
    this.stageNC = nc; this.stageND = nd;

    // Optimization 3: version-based affected marking (no fill)
    this.affectedVersion++;
    const ver = this.affectedVersion;
    this.affectedArr[ra] = ver;
    this.affectedArr[rb] = ver;
    this.affectedArr[rc] = ver;
    this.affectedArr[rd] = ver;

    // Temporarily apply swap to adjacency matrix
    this.graph.removeEdge(ra, rb);
    this.graph.removeEdge(rc, rd);
    this.graph.addEdge(na, nb);
    this.graph.addEdge(nc, nd);

    // Reset scratchpad
    this.scratchSize = 0;

    // Compute delta: only off-diagonal pairs involving affected vertices
    let delta = 0;

    for (let vi = 0; vi < n; vi++) {
      if (this.affectedArr[vi] !== ver) continue;

      for (let w = 0; w < n; w++) {
        if (w === vi) continue;
        // Skip if both affected and w < vi (handled when w is processed)
        if (this.affectedArr[w] === ver && w < vi) continue;

        // Old CN value (from cache, pre-swap)
        const oldCN = this.cn[vi * n + w]!;

        // Compute new CN using current (post-swap) adjacency
        let newCN = 0;
        for (let x = 0; x < n; x++) {
          if (this.graph.hasEdge(vi, x) && this.graph.hasEdge(w, x)) newCN++;
        }

        // Determine old adjacency for this pair
        let wasAdj: boolean;
        if ((vi === ra && w === rb) || (vi === rb && w === ra) ||
            (vi === rc && w === rd) || (vi === rd && w === rc)) {
          wasAdj = true;   // was an edge, now removed
        } else if ((vi === na && w === nb) || (vi === nb && w === na) ||
                   (vi === nc && w === nd) || (vi === nd && w === nc)) {
          wasAdj = false;  // was not an edge, now added
        } else {
          wasAdj = this.graph.hasEdge(vi, w);  // unchanged by swap
        }

        const newAdj = this.graph.hasEdge(vi, w);

        // Energy delta for this pair
        const oldE = this.pairE(oldCN, wasAdj);
        const newE = this.pairE(newCN, newAdj);
        delta += newE - oldE;

        // Optimization 2: store to scratchpad for zero-cost commit
        const s = this.scratchSize;
        this.scratchKeys[s] = vi * n + w;
        this.scratchVals[s] = newCN;
        this.scratchKeys[s + 1] = w * n + vi;
        this.scratchVals[s + 1] = newCN;
        this.scratchSize = s + 2;
      }
    }

    // Restore adjacency matrix (un-apply swap)
    this.graph.removeEdge(na, nb);
    this.graph.removeEdge(nc, nd);
    this.graph.addEdge(ra, rb);
    this.graph.addEdge(rc, rd);

    this.staged = true;
    this.stageDelta = delta;
    return delta;
  }

  /** Commit the staged swap. O(4k + scratchSize) — zero CN recomputation. */
  commitSwap(): void {
    if (!this.staged) return;
    this.staged = false;

    const { k } = this;
    const ra = this.stageRA, rb = this.stageRB;
    const rc = this.stageRC, rd = this.stageRD;
    const na = this.stageNA, nb = this.stageNB;
    const nc = this.stageNC, nd = this.stageND;

    // 1. Apply swap to adjacency matrix
    this.graph.removeEdge(ra, rb);
    this.graph.removeEdge(rc, rd);
    this.graph.addEdge(na, nb);
    this.graph.addEdge(nc, nd);

    // 2. Update energy
    this.energy += this.stageDelta;

    // 3. Optimization 2: replay scratchpad into CN cache (zero math)
    for (let s = 0; s < this.scratchSize; s++) {
      this.cn[this.scratchKeys[s]!] = this.scratchVals[s]!;
    }

    // 4. Also update diagonal CN for affected vertices
    //    (A²)_vv = degree(v) = k for k-regular graphs, always
    const ver = this.affectedVersion;
    for (let v = 0; v < this.n; v++) {
      if (this.affectedArr[v] === ver) {
        this.cn[v * this.n + v] = k;
      }
    }

    // 5. Optimization 1: O(k) adjacency list update per affected vertex
    //    Each affected vertex lost one neighbor and gained one.
    //    Vertex ra: lost rb, gained (whichever new edge endpoint pairs with ra)
    this.updateAdj(ra, rb, this.findGain(ra, na, nb, nc, nd));
    this.updateAdj(rb, ra, this.findGain(rb, na, nb, nc, nd));
    this.updateAdj(rc, rd, this.findGain(rc, na, nb, nc, nd));
    this.updateAdj(rd, rc, this.findGain(rd, na, nb, nc, nd));
  }

  /** Find what vertex v gained from the new edges. */
  private findGain(v: number, na: number, nb: number, nc: number, nd: number): number {
    if (v === na) return nb;
    if (v === nb) return na;
    if (v === nc) return nd;
    if (v === nd) return nc;
    return -1; // should never happen
  }

  /** Replace lostNeighbor with gainedNeighbor in vertex's adjList. O(k). */
  private updateAdj(vertex: number, lost: number, gained: number): void {
    const base = vertex * this.k;
    for (let i = 0; i < this.k; i++) {
      if (this.adjList[base + i] === lost) {
        this.adjList[base + i] = gained;
        return;
      }
    }
  }

  /** Discard the staged swap — no-op. */
  discardSwap(): void {
    this.staged = false;
  }

  // ──────────────────────────────────────────────
  //  Legacy API (for existing tests)
  // ──────────────────────────────────────────────

  trySwap(): SwapResult | null {
    const delta = this.proposeRandomSwap();
    if (delta === null) return null;

    const ra = this.stageRA, rb = this.stageRB;
    const rc = this.stageRC, rd = this.stageRD;
    const na = this.stageNA, nb = this.stageNB;
    const nc = this.stageNC, nd = this.stageND;

    const newGraph = this.graph.clone();
    newGraph.removeEdge(ra, rb);
    newGraph.removeEdge(rc, rd);
    newGraph.addEdge(na, nb);
    newGraph.addEdge(nc, nd);

    this.staged = false;

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

    const n = this.n;
    const affected = new Set(result.vertices);
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
    this.buildAdjList();
  }

  /** Get a clone of the current graph. */
  getGraph(): AdjacencyMatrix {
    return this.graph.clone();
  }
}
