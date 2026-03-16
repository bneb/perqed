/**
 * IncrementalSRGEngine — O(1)-per-pair CN Delta Energy Evaluator
 *
 * Zero-allocation Metropolis-Hastings hot loop API for SRG search.
 *
 * Four critical optimizations:
 *   1. O(1) edge sampling via fixed adjacency list (Int32Array, n×k)
 *   2. O(1) CN delta per pair: instead of scanning all n vertices to
 *      recompute CN(u,w), compute ΔCN from the 4 adjacency changes.
 *      Each affected vertex lost 1 and gained 1 neighbor, so
 *      ΔCN(u,w) = (gained contributes to shared?) - (lost contributed?)
 *   3. Scratchpad CN caching: compute delta once, replay on commit
 *   4. Versioned affected tracker: no array fill(0) per proposal
 *
 * Per-proposal cost breakdown (n=99, k=14):
 *   Edge sampling:          O(1)
 *   CN delta computation:   ~390 pairs × O(1) = ~800 ops (was ~39,000)
 *   Energy delta:           ~390 pairs × O(1) = ~390 ops
 *   commitSwap:             scratchSize + 4k = ~850 ops
 *   Total per iteration:    ~2,000 ops (was ~40,000)
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
  private readonly lm: number;
  private readonly km: number;

  /** Common-neighbor cache: cn[i*n + j] = |N(i) ∩ N(j)| */
  private cn: Int32Array;

  /** Current energy */
  energy: number;

  // ── Optimization 1: Fixed adjacency list ──
  private adjList: Int32Array;

  // ── Optimization 3: Scratchpad CN caching ──
  private scratchKeys: Int32Array;
  private scratchVals: Int32Array;
  private scratchSize: number = 0;

  // ── Optimization 4: Versioned affected tracking ──
  private affectedVersion: number = 0;
  private affectedArr: Uint32Array;

  // ── Staged swap state ──
  private staged: boolean = false;
  private stageRA = 0; private stageRB = 0;
  private stageRC = 0; private stageRD = 0;
  private stageNA = 0; private stageNB = 0;
  private stageNC = 0; private stageND = 0;
  private stageDelta = 0;

  // ── Per-vertex swap deltas (what each affected vertex lost/gained) ──
  // lost[i] and gained[i] for affected vertices [ra, rb, rc, rd]
  private swapLost  = [0, 0, 0, 0];
  private swapGained = [0, 0, 0, 0];
  private swapVerts  = [0, 0, 0, 0];

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
    const { n, lm, mu } = this;
    let energy = 0;
    for (let i = 0; i < n; i++) {
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
  //  Energy helpers
  // ──────────────────────────────────────────────

  private pairE(cnVal: number, adj: boolean): number {
    const mij = cnVal - this.lm * (adj ? 1 : 0) - this.mu;
    return 2 * mij * mij;
  }

  // ──────────────────────────────────────────────
  //  O(1) CN Delta — The Core Algorithm
  // ──────────────────────────────────────────────
  //
  // When we swap edges, each of the 4 affected vertices loses exactly
  // 1 neighbor and gains exactly 1 neighbor.
  //
  // For CN(u, w) where u is affected (lost neighbor L, gained neighbor G):
  //   ΔCN(u, w) = A[w][G] - A[w][L]
  //   (gained G contributes to shared neighbors iff w is adjacent to G;
  //    lost L no longer contributes iff w was adjacent to L)
  //
  // If BOTH u and w are affected, the delta has contributions from
  // both vertices' lost/gained neighbors:
  //   ΔCN(u, w) = Σ over x ∈ {L_u, G_u, L_w, G_w}:
  //                 A_new[u][x]·A_new[w][x] - A_old[u][x]·A_old[w][x]
  //
  // This is at most 4 terms, each an O(1) lookup.

  /**
   * Compute ΔCN(u, w) from the 4 adjacency changes.
   *
   * Must be called AFTER the swap is temporarily applied to adjacency,
   * with swapLost/swapGained already set.
   *
   * @param u - First vertex of the pair
   * @param w - Second vertex of the pair
   * @param uAffIdx - Index of u in swapVerts (-1 if not affected)
   * @param wAffIdx - Index of w in swapVerts (-1 if not affected)
   * @returns The change in common neighbors: CN_new(u,w) - CN_old(u,w)
   */
  private cnDelta(u: number, w: number, uAffIdx: number, wAffIdx: number): number {
    let delta = 0;

    // Contribution from u's adjacency change (u lost L_u, gained G_u)
    if (uAffIdx >= 0) {
      const lost = this.swapLost[uAffIdx]!;
      const gained = this.swapGained[uAffIdx]!;

      // x = lost: A_old[u][lost]=1, A_new[u][lost]=0
      //   contribution = A_new[u][lost]·A_new[w][lost] - A_old[u][lost]·A_old[w][lost]
      //                = 0 - 1·A_old[w][lost]
      // But A[w][lost] may also have changed if w is affected...
      // We need A_old[w][lost]. Since we've applied the swap, current A[w][lost]
      // is A_new[w][lost]. A_old = A_new unless (w, lost) is a swapped edge.

      // x = gained: A_old[u][gained]=0, A_new[u][gained]=1
      //   contribution = 1·A_new[w][gained] - 0
      //                = A_new[w][gained]
      // But again, A_new[w][gained] is the current value.

      // For x = lost: need A_old[w][lost]
      if (w !== lost) {
        const wLostNew = this.graph.hasEdge(w, lost) ? 1 : 0;
        // Was (w, lost) a swapped edge? If so, A_old ≠ A_new
        const wLostOld = this.wasEdge(w, lost) ? 1 : 0;
        delta += 0 * wLostNew - 1 * wLostOld; // = -wLostOld
      }

      // For x = gained: need A_new[w][gained]
      if (w !== gained) {
        const wGainNew = this.graph.hasEdge(w, gained) ? 1 : 0;
        delta += 1 * wGainNew - 0; // = wGainNew
      }
    }

    // Contribution from w's adjacency change (w lost L_w, gained G_w)
    if (wAffIdx >= 0) {
      const lost = this.swapLost[wAffIdx]!;
      const gained = this.swapGained[wAffIdx]!;

      // x = lost: A_old[w][lost]=1, A_new[w][lost]=0
      //   need A_old[u][lost] and A_new[u][lost]
      if (u !== lost) {
        // Skip if u already handled this x value via its own lost/gained
        if (uAffIdx < 0 || (lost !== this.swapLost[uAffIdx] && lost !== this.swapGained[uAffIdx])) {
          const uLostOld = this.wasEdge(u, lost) ? 1 : 0;
          const uLostNew = this.graph.hasEdge(u, lost) ? 1 : 0;
          delta += uLostNew * 0 - uLostOld * 1; // = -uLostOld
        }
      }

      // x = gained: A_old[w][gained]=0, A_new[w][gained]=1
      if (u !== gained) {
        if (uAffIdx < 0 || (gained !== this.swapLost[uAffIdx] && gained !== this.swapGained[uAffIdx])) {
          const uGainOld = this.wasEdge(u, gained) ? 1 : 0;
          const uGainNew = this.graph.hasEdge(u, gained) ? 1 : 0;
          delta += uGainNew * 1 - uGainOld * 0; // = uGainNew
        }
      }
    }

    return delta;
  }

  /**
   * Check if (u, v) was an edge BEFORE the current temporary swap.
   * Called while swap is temporarily applied to the graph.
   */
  private wasEdge(u: number, v: number): boolean {
    const ra = this.stageRA, rb = this.stageRB;
    const rc = this.stageRC, rd = this.stageRD;
    const na = this.stageNA, nb = this.stageNB;
    const nc = this.stageNC, nd = this.stageND;

    // Removed edges: were present before, absent now
    if ((u === ra && v === rb) || (u === rb && v === ra) ||
        (u === rc && v === rd) || (u === rd && v === rc)) {
      return true;
    }
    // Added edges: were absent before, present now
    if ((u === na && v === nb) || (u === nb && v === na) ||
        (u === nc && v === nd) || (u === nd && v === nc)) {
      return false;
    }
    // Unaffected: current state = old state
    return this.graph.hasEdge(u, v);
  }

  // ──────────────────────────────────────────────
  //  Hot loop API
  // ──────────────────────────────────────────────

  proposeRandomSwap(): number | null {
    const { n, k } = this;

    for (let attempt = 0; attempt < 20; attempt++) {
      const a = Math.floor(Math.random() * n);
      const aIdx = Math.floor(Math.random() * k);
      const b = this.adjList[a * k + aIdx]!;

      const c = Math.floor(Math.random() * n);
      const cIdx = Math.floor(Math.random() * k);
      const d = this.adjList[c * k + cIdx]!;

      if (a === c || a === d || b === c || b === d) continue;
      if (a === d && b === c) continue;

      if (!this.graph.hasEdge(a, c) && !this.graph.hasEdge(b, d)) {
        return this.computeDelta(a, b, c, d, a, c, b, d);
      }

      if (!this.graph.hasEdge(a, d) && !this.graph.hasEdge(b, c)) {
        return this.computeDelta(a, b, c, d, a, d, b, c);
      }
    }

    return null;
  }

  private computeDelta(
    ra: number, rb: number, rc: number, rd: number,
    na: number, nb: number, nc: number, nd: number,
  ): number {
    const n = this.n;

    // Stage
    this.stageRA = ra; this.stageRB = rb;
    this.stageRC = rc; this.stageRD = rd;
    this.stageNA = na; this.stageNB = nb;
    this.stageNC = nc; this.stageND = nd;

    // Compute per-vertex lost/gained
    // Removed edges: (ra,rb) and (rc,rd)
    // Added edges: (na,nb) and (nc,nd)
    this.swapVerts[0] = ra; this.swapVerts[1] = rb;
    this.swapVerts[2] = rc; this.swapVerts[3] = rd;
    // Each vertex: lost = other endpoint of its removed edge
    this.swapLost[0] = rb; this.swapLost[1] = ra;
    this.swapLost[2] = rd; this.swapLost[3] = rc;
    // Gained: find which new edge endpoint pairs with this vertex
    this.swapGained[0] = this.findGain(ra, na, nb, nc, nd);
    this.swapGained[1] = this.findGain(rb, na, nb, nc, nd);
    this.swapGained[2] = this.findGain(rc, na, nb, nc, nd);
    this.swapGained[3] = this.findGain(rd, na, nb, nc, nd);

    // Version-based affected marking
    this.affectedVersion++;
    const ver = this.affectedVersion;
    this.affectedArr[ra] = ver;
    this.affectedArr[rb] = ver;
    this.affectedArr[rc] = ver;
    this.affectedArr[rd] = ver;

    // Temporarily apply swap to adjacency
    this.graph.removeEdge(ra, rb);
    this.graph.removeEdge(rc, rd);
    this.graph.addEdge(na, nb);
    this.graph.addEdge(nc, nd);

    // Reset scratchpad
    this.scratchSize = 0;

    // Compute energy delta using O(1) CN deltas
    let delta = 0;

    for (let ai = 0; ai < 4; ai++) {
      const vi = this.swapVerts[ai]!;

      for (let w = 0; w < n; w++) {
        if (w === vi) continue;
        if (this.affectedArr[w] === ver && w < vi) continue;

        // O(1) CN delta instead of O(n) scan
        const oldCN = this.cn[vi * n + w]!;
        const wAffIdx = this.affectedArr[w] === ver
          ? this.swapVerts.indexOf(w)
          : -1;
        const cnDelt = this.cnDelta(vi, w, ai, wAffIdx);
        const newCN = oldCN + cnDelt;

        // Old and new adjacency
        const wasAdj = this.wasEdge(vi, w);
        const newAdj = this.graph.hasEdge(vi, w);

        // Energy delta
        const oldE = this.pairE(oldCN, wasAdj);
        const newE = this.pairE(newCN, newAdj);
        delta += newE - oldE;

        // Scratchpad
        const s = this.scratchSize;
        this.scratchKeys[s] = vi * n + w;
        this.scratchVals[s] = newCN;
        this.scratchKeys[s + 1] = w * n + vi;
        this.scratchVals[s + 1] = newCN;
        this.scratchSize = s + 2;
      }
    }

    // Restore adjacency
    this.graph.removeEdge(na, nb);
    this.graph.removeEdge(nc, nd);
    this.graph.addEdge(ra, rb);
    this.graph.addEdge(rc, rd);

    this.staged = true;
    this.stageDelta = delta;
    return delta;
  }

  /** Commit the staged swap. */
  commitSwap(): void {
    if (!this.staged) return;
    this.staged = false;

    const ra = this.stageRA, rb = this.stageRB;
    const rc = this.stageRC, rd = this.stageRD;
    const na = this.stageNA, nb = this.stageNB;
    const nc = this.stageNC, nd = this.stageND;

    // Apply swap to adjacency
    this.graph.removeEdge(ra, rb);
    this.graph.removeEdge(rc, rd);
    this.graph.addEdge(na, nb);
    this.graph.addEdge(nc, nd);

    // Update energy
    this.energy += this.stageDelta;

    // Replay scratchpad into CN cache
    for (let s = 0; s < this.scratchSize; s++) {
      this.cn[this.scratchKeys[s]!] = this.scratchVals[s]!;
    }

    // Update diagonal CN (always k for k-regular)
    const ver = this.affectedVersion;
    for (let v = 0; v < this.n; v++) {
      if (this.affectedArr[v] === ver) {
        this.cn[v * this.n + v] = this.k;
      }
    }

    // O(k) adjacency list updates
    this.updateAdj(ra, rb, this.findGain(ra, na, nb, nc, nd));
    this.updateAdj(rb, ra, this.findGain(rb, na, nb, nc, nd));
    this.updateAdj(rc, rd, this.findGain(rc, na, nb, nc, nd));
    this.updateAdj(rd, rc, this.findGain(rd, na, nb, nc, nd));
  }

  private findGain(v: number, na: number, nb: number, nc: number, nd: number): number {
    if (v === na) return nb;
    if (v === nb) return na;
    if (v === nc) return nd;
    if (v === nd) return nc;
    return -1;
  }

  private updateAdj(vertex: number, lost: number, gained: number): void {
    const base = vertex * this.k;
    for (let i = 0; i < this.k; i++) {
      if (this.adjList[base + i] === lost) {
        this.adjList[base + i] = gained;
        return;
      }
    }
  }

  discardSwap(): void {
    this.staged = false;
  }

  // ──────────────────────────────────────────────
  //  Accessors
  // ──────────────────────────────────────────────

  getGraph(): AdjacencyMatrix {
    return this.graph.clone();
  }

  /** Expose CN cache for testing/verification. Returns a copy. */
  getCNCache(): Int32Array {
    return new Int32Array(this.cn);
  }

  // ──────────────────────────────────────────────
  //  Legacy API
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
}
