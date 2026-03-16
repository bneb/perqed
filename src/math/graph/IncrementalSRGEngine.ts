/**
 * IncrementalSRGEngine — Path-Based O(k) CN Delta with Flat Transaction Log
 *
 * Uses path-breaking/path-making to compute CN deltas:
 *   Breaking edge (p,q): for each w ∈ N(q)\{p}, CN(p,w) -= 1
 *   Making edge (p,q):   for each w ∈ N(q)\{p}, CN(p,w) += 1
 *
 * Per-proposal cost: 8(k-1) + corrections ≈ 108 ops for k=14
 * (vs ~39,000 for O(n) scan, vs ~800 for previous O(1) per-pair)
 *
 * Transaction log: flat Int32Array storing (row, col, ±1) triples.
 * On commit, replay deltas into CN cache. On discard, no-op.
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

  /** Current triangle count (3-cycles) */
  private triangles: number = 0;

  /** Staged triangle delta */
  private stageTriangleDelta: number = 0;

  /** Fixed adjacency list: adjList[v*k + i] = ith neighbor of v */
  private adjList: Int32Array;

  // ── Flat transaction log for CN deltas ──
  // Each entry is 3 ints: [row, col, delta(±1)]
  // Max entries: 8*(k-1)*2 + 8 corrections ≈ 220 for k=14
  private cnLog: Int32Array;
  private cnLogSize: number = 0;

  // ── Net CN delta accumulator (indexed by pair key) ──
  // Used to aggregate multiple ±1 entries for same pair
  private netDelta: Int32Array;           // n*n, stores net ΔCN per pair
  private netDeltaVersion: number = 0;
  private netDeltaTracker: Uint32Array;   // tracks which entries are dirty
  private dirtyPairs: Int32Array;         // list of dirty pair keys
  private dirtyCount: number = 0;

  // ── Versioned affected tracking ──
  private affectedVersion: number = 0;
  private affectedArr: Uint32Array;

  // ── Staged swap state ──
  private staged: boolean = false;
  private stageRA = 0; private stageRB = 0;
  private stageRC = 0; private stageRD = 0;
  private stageNA = 0; private stageNB = 0;
  private stageNC = 0; private stageND = 0;
  private stageDelta = 0;

  /** Frozen edge mask: frozen[i*n+j] = 1 means edge (i,j) cannot be removed */
  private frozen: Uint8Array;

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

    // Transaction log: generous sizing
    this.cnLog = new Int32Array(1024 * 3);

    // Net delta accumulator
    this.netDelta = new Int32Array(this.n * this.n);
    this.netDeltaTracker = new Uint32Array(this.n * this.n);
    this.dirtyPairs = new Int32Array(1024);

    this.frozen = new Uint8Array(this.n * this.n);

    this.buildAdjList();
    this.buildFullCN();
    this.energy = this.computeEnergyFromCN();
    this.triangles = this.countTrianglesFromCN();
  }

  /** Mark edge (u,v) as frozen — it cannot be removed by swaps. */
  freezeEdge(u: number, v: number): void {
    this.frozen[u * this.n + v] = 1;
    this.frozen[v * this.n + u] = 1;
  }

  /** Check if an edge is frozen. */
  isFrozen(u: number, v: number): boolean {
    return this.frozen[u * this.n + v] === 1;
  }

  /** Compute triangle count from CN cache: T = Σ_{(i,j)∈E} CN(i,j) / 3 */
  private countTrianglesFromCN(): number {
    const { n, k } = this;
    let sum = 0;
    for (let v = 0; v < n; v++) {
      const base = v * k;
      for (let i = 0; i < k; i++) {
        const w = this.adjList[base + i]!;
        if (w > v) { // each edge once
          sum += this.cn[v * n + w]!;
        }
      }
    }
    // Each triangle {u,v,w} is counted 3 times: once for each edge
    return sum / 3;
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

  private pairE(cnVal: number, adj: boolean): number {
    const mij = cnVal - this.lm * (adj ? 1 : 0) - this.mu;
    return 2 * mij * mij;
  }

  // ──────────────────────────────────────────────
  //  Transaction log helpers
  // ──────────────────────────────────────────────

  /** Push a CN delta entry into the transaction log. */
  private logCNDelta(row: number, col: number, delta: number): void {
    const i = this.cnLogSize * 3;
    this.cnLog[i] = row;
    this.cnLog[i + 1] = col;
    this.cnLog[i + 2] = delta;
    this.cnLogSize++;
  }

  /** Mark a pair as dirty in the net delta accumulator. */
  private markDirty(key: number): void {
    if (this.netDeltaTracker[key] !== this.netDeltaVersion) {
      this.netDeltaTracker[key] = this.netDeltaVersion;
      this.netDelta[key] = 0;
      this.dirtyPairs[this.dirtyCount++] = key;
    }
  }

  // ──────────────────────────────────────────────
  //  Path-breaking/making CN delta
  // ──────────────────────────────────────────────

  /**
   * Log CN changes from BREAKING edge (p,q).
   * For each w ∈ N_old(q) \ {p}: CN(p,w) -= 1 (path p-q-w broken)
   * For each w ∈ N_old(p) \ {q}: CN(q,w) -= 1 (path q-p-w broken)
   */
  private logBreakEdge(p: number, q: number): void {
    const k = this.k;
    // Iterate old neighbors of q
    const baseQ = q * k;
    for (let i = 0; i < k; i++) {
      const w = this.adjList[baseQ + i]!;
      if (w === p) continue;
      this.logCNDelta(p, w, -1);
      this.logCNDelta(w, p, -1);
    }
    // Iterate old neighbors of p
    const baseP = p * k;
    for (let i = 0; i < k; i++) {
      const w = this.adjList[baseP + i]!;
      if (w === q) continue;
      this.logCNDelta(q, w, -1);
      this.logCNDelta(w, q, -1);
    }
  }

  /**
   * Log CN changes from MAKING edge (p,q).
   * Uses OLD adj list, then applies cross-term corrections.
   * For each w ∈ N_old(q) \ {p}: CN(p,w) += 1 (path p-q-w created)
   * For each w ∈ N_old(p) \ {q}: CN(q,w) += 1 (path q-p-w created)
   */
  private logMakeEdge(p: number, q: number): void {
    const k = this.k;
    const baseQ = q * k;
    for (let i = 0; i < k; i++) {
      const w = this.adjList[baseQ + i]!;
      if (w === p) continue;
      this.logCNDelta(p, w, +1);
      this.logCNDelta(w, p, +1);
    }
    const baseP = p * k;
    for (let i = 0; i < k; i++) {
      const w = this.adjList[baseP + i]!;
      if (w === q) continue;
      this.logCNDelta(q, w, +1);
      this.logCNDelta(w, q, +1);
    }
  }

  // ──────────────────────────────────────────────
  //  Hot loop API
  // ──────────────────────────────────────────────

  proposeRandomSwap(): number | null {
    const { n, k } = this;

    for (let attempt = 0; attempt < 20; attempt++) {
      const a = Math.floor(Math.random() * n);
      const b = this.adjList[a * k + Math.floor(Math.random() * k)]!;
      const c = Math.floor(Math.random() * n);
      const d = this.adjList[c * k + Math.floor(Math.random() * k)]!;

      if (a === c || a === d || b === c || b === d) continue;
      if (a === d && b === c) continue;

      // Reject if removing a frozen edge
      if (this.frozen[a * n + b] || this.frozen[c * n + d]) continue;

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

    this.stageRA = ra; this.stageRB = rb;
    this.stageRC = rc; this.stageRD = rd;
    this.stageNA = na; this.stageNB = nb;
    this.stageNC = nc; this.stageND = nd;

    // Reset transaction log
    this.cnLogSize = 0;

    // Step 1: Log path-breaking for removed edges (using OLD adj list)
    this.logBreakEdge(ra, rb);
    this.logBreakEdge(rc, rd);

    // Step 2: Log path-making for added edges (using OLD adj list)
    this.logMakeEdge(na, nb);
    this.logMakeEdge(nc, nd);

    // Step 3: Cross-term corrections
    // Each (removal, addition) pair sharing a vertex produces one erroneous +1.
    // Remove(ra,rb) shares ra with Add(na,nb) if ra∈{na,nb}, shares rb with Add(nc,nd) if rb∈{nc,nd}, etc.
    // For swap remove(ra,rb)+(rc,rd), add(na,nb)+(nc,nd):
    //   Vertex ra: lost rb (removal), gained via na/nb. If ra=na, gained nb. If ra=nb, gained na.
    //   The erroneous path is: (gained_ra) — ra — rb, logged as +1 during makeEdge.
    //   But ra-rb is removed, so this path doesn't exist. Correct: CN(gained_ra, rb) -= 1.
    // Similarly for all 4 affected vertices.
    this.applyCrossCorrections(ra, rb, na, nb, nc, nd);
    this.applyCrossCorrections(rb, ra, na, nb, nc, nd);
    this.applyCrossCorrections(rc, rd, na, nb, nc, nd);
    this.applyCrossCorrections(rd, rc, na, nb, nc, nd);

    // Step 4: Aggregate log into net deltas per pair and compute ΔE
    this.netDeltaVersion++;
    this.dirtyCount = 0;
    const ver = this.netDeltaVersion;

    for (let i = 0; i < this.cnLogSize; i++) {
      const row = this.cnLog[i * 3]!;
      const col = this.cnLog[i * 3 + 1]!;
      const delta = this.cnLog[i * 3 + 2]!;
      const key = row * n + col;
      this.markDirty(key);
      this.netDelta[key] += delta;
    }

    // Step 5: Compute triangle delta
    // Triangles through edge (p,q) = CN(p,q).
    // Removed edges: lose CN_old triangles each.
    // Added edges: gain CN_new = CN_old + netDelta triangles each.
    {
      const cnRA_RB = this.cn[ra * n + rb]!;
      const cnRC_RD = this.cn[rc * n + rd]!;

      // Net CN delta for added edge endpoints (may have changed due to swap)
      const dNA_NB = (this.netDeltaTracker[na * n + nb] === ver) ? this.netDelta[na * n + nb]! : 0;
      const dNC_ND = (this.netDeltaTracker[nc * n + nd] === ver) ? this.netDelta[nc * n + nd]! : 0;
      const cnNA_NB_new = this.cn[na * n + nb]! + dNA_NB;
      const cnNC_ND_new = this.cn[nc * n + nd]! + dNC_ND;

      this.stageTriangleDelta = (cnNA_NB_new + cnNC_ND_new) - (cnRA_RB + cnRC_RD);
    }

    // Step 6: Compute energy delta from net CN changes
    let energyDelta = 0;

    // Also need to account for adjacency changes in energy:
    // The 4 edge flips change A_ij for the removed/added pairs.
    // First, handle energy change from adjacency flips (for the 4 edge pairs)
    // Remove (ra,rb): A goes 1→0
    // Remove (rc,rd): A goes 1→0
    // Add (na,nb): A goes 0→1
    // Add (nc,nd): A goes 0→1

    // Process all dirty pairs
    for (let di = 0; di < this.dirtyCount; di++) {
      const key = this.dirtyPairs[di]!;
      const row = Math.floor(key / n);
      const col = key % n;
      if (row >= col) continue; // only process upper triangle (i < j)

      const cnDelt = this.netDelta[key]!;
      // Also check symmetric entry
      const symKey = col * n + row;
      // netDelta[key] and netDelta[symKey] should be the same
      // but we only use one.

      const oldCN = this.cn[key]!;
      const newCN = oldCN + cnDelt;

      // Determine old and new adjacency for this pair
      const oldAdj = this.graph.hasEdge(row, col);
      let newAdj = oldAdj;
      if ((row === ra && col === rb) || (row === rb && col === ra) ||
          (row === rc && col === rd) || (row === rd && col === rc)) {
        newAdj = false; // removed
      } else if ((row === na && col === nb) || (row === nb && col === na) ||
                 (row === nc && col === nd) || (row === nd && col === nc)) {
        newAdj = true; // added
      }

      const oldE = this.pairE(oldCN, oldAdj);
      const newE = this.pairE(newCN, newAdj);
      energyDelta += newE - oldE;
    }

    // Also add energy changes for edge pairs that have CN=0 delta but adj changed
    // (the 4 edge pair endpoints might not have CN changes but adj did change)
    const edgePairs: [number, number, boolean, boolean][] = [
      [Math.min(ra, rb), Math.max(ra, rb), true, false],   // was edge, now not
      [Math.min(rc, rd), Math.max(rc, rd), true, false],
      [Math.min(na, nb), Math.max(na, nb), false, true],   // was not edge, now is
      [Math.min(nc, nd), Math.max(nc, nd), false, true],
    ];

    for (const [r, c, oldA, newA] of edgePairs) {
      const key = r * n + c;
      if (this.netDeltaTracker[key] !== ver) {
        // This pair wasn't in the dirty set — CN didn't change but adj did
        const cn = this.cn[key]!;
        const oldE = this.pairE(cn, oldA);
        const newE = this.pairE(cn, newA);
        energyDelta += newE - oldE;
      }
    }

    this.staged = true;
    this.stageDelta = energyDelta;
    return energyDelta;
  }

  /**
   * Cross-term correction: when vertex v lost neighbor `lost` (via removal)
   * and gained neighbor `gained` (via addition), the makeEdge step
   * erroneously logged CN(gained, lost) += 1 for the path gained-v-lost.
   * But v-lost was removed, so this path doesn't exist.
   */
  private applyCrossCorrections(
    v: number, lost: number,
    na: number, nb: number, nc: number, nd: number,
  ): void {
    let gained: number;
    if (v === na) gained = nb;
    else if (v === nb) gained = na;
    else if (v === nc) gained = nd;
    else if (v === nd) gained = nc;
    else return;

    // The erroneous entry was CN(gained, lost) += 1 from path gained-v-lost
    // Correct it: CN(gained, lost) -= 1
    if (gained !== lost) {
      this.logCNDelta(gained, lost, -1);
      this.logCNDelta(lost, gained, -1);
    }
  }

  commitSwap(): void {
    if (!this.staged) return;
    this.staged = false;

    const n = this.n;
    const ra = this.stageRA, rb = this.stageRB;
    const rc = this.stageRC, rd = this.stageRD;
    const na = this.stageNA, nb = this.stageNB;
    const nc = this.stageNC, nd = this.stageND;

    // Apply swap to adjacency
    this.graph.removeEdge(ra, rb);
    this.graph.removeEdge(rc, rd);
    this.graph.addEdge(na, nb);
    this.graph.addEdge(nc, nd);

    // Update energy and triangle count
    this.energy += this.stageDelta;
    this.triangles += this.stageTriangleDelta;

    // Replay net deltas into CN cache
    const ver = this.netDeltaVersion;
    for (let di = 0; di < this.dirtyCount; di++) {
      const key = this.dirtyPairs[di]!;
      if (this.netDeltaTracker[key] === ver) {
        this.cn[key] += this.netDelta[key]!;
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

  getGraph(): AdjacencyMatrix { return this.graph.clone(); }
  getCNCache(): Int32Array { return new Int32Array(this.cn); }
  getTriangleCount(): number { return this.triangles; }
  getProposedTriangleDelta(): number { return this.stageTriangleDelta; }

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
    newGraph.removeEdge(ra, rb); newGraph.removeEdge(rc, rd);
    newGraph.addEdge(na, nb); newGraph.addEdge(nc, nd);
    this.staged = false;
    return {
      graph: newGraph, newEnergy: this.energy + delta,
      vertices: [ra, rb, rc, rd], removed: [ra, rb, rc, rd], added: [na, nb, nc, nd],
    };
  }

  acceptSwap(result: SwapResult): void {
    this.graph = result.graph;
    this.energy = result.newEnergy;
    const n = this.n;
    for (const v of new Set(result.vertices)) {
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
