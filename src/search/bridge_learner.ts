/**
 * bridge_learner.ts — Self-Improving Bridge Space Learner
 *
 * Discovers and evaluates new continuous bridge spaces (manifolds) for
 * the Schur partition problem autonomously via population-based evolution
 * and a neural reward model.
 *
 * Architecture:
 *   - BridgeStrategy: typed interface for 4 manifold families
 *     (sphere, torus, product, hyperbolic_poincare)
 *   - BridgeStrategyLibrary: scored population with PRM-guided mutation
 *   - BridgeLearner: propose → evaluate → updateRewardModel loop
 *   - TinyMLP: 6→16→8→1 pure-TS reward model trained on (params → E-reduction)
 *
 * NO LLM CALLS anywhere in this file. Pure combinatorial novelty.
 */

import { appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { jaccardNgram } from "../agents/prm_scorer";

// ── Lightweight PRM novelty scorer (no ProgramDatabase dependency) ─────────────

interface BridgePRMCandidate {
  ruleText: string;
  island: ManifoldType;
}

function scoreNoveltyCandidates(
  candidates: BridgePRMCandidate[],
  existingTexts: string[],
  islandCounts: Map<string, number>,
): { candidate: BridgePRMCandidate; score: number }[] {
  const topIslands = new Set(
    [...islandCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([k]) => k)
  );
  return candidates.map(c => {
    const novelty = existingTexts.length === 0 ? 1.0 : 1.0 - Math.max(
      0,
      ...existingTexts.map(t => jaccardNgram(c.ruleText, t, 3))
    );
    const diversityBonus = topIslands.has(c.island) ? 0 : 0.3;
    const driftPenalty = existingTexts.includes(c.ruleText) ? -1 : 0;
    return { candidate: c, score: Math.max(0, novelty + diversityBonus + driftPenalty) };
  }).sort((a, b) => b.score - a.score);
}

// ── Discrete energy helper ────────────────────────────────────────────────────

/** Exact discrete Schur energy of a hard partition. */
export function discreteSchurEnergy(partition: Int8Array, N: number): number {
  let E = 0;
  for (let x = 1; x <= N; x++) {
    for (let y = x; y <= N; y++) {
      const z = x + y;
      if (z > N) break;
      if (partition[x] === partition[y] && partition[y] === partition[z]) E++;
    }
  }
  return E;
}

// ── Shared Schur energy on continuous coordinates ─────────────────────────────

function schurSoftEnergy(enc: number[][], N: number, K: number): number {
  let E = 0;
  for (let x = 1; x <= N; x++) {
    for (let y = x; y <= N; y++) {
      const z = x + y;
      if (z > N) break;
      const vx = enc[x]!, vy = enc[y]!, vz = enc[z]!;
      for (let k = 0; k < K; k++) {
        const a = vx[k]!, b = vy[k]!, c = vz[k]!;
        E += a * a * b * b * c * c;
      }
    }
  }
  return E;
}

function schurEuclideanGradient(enc: number[][], N: number, K: number): number[][] {
  const grad: number[][] = Array.from({ length: N + 1 }, () => new Array<number>(K).fill(0));
  for (let x = 1; x <= N; x++) {
    for (let y = x; y <= N; y++) {
      const z = x + y;
      if (z > N) break;
      const vx = enc[x]!, vy = enc[y]!, vz = enc[z]!;
      const gx = grad[x]!, gy = grad[y]!, gz = grad[z]!;
      for (let k = 0; k < K; k++) {
        const a = vx[k]!, b = vy[k]!, c = vz[k]!;
        gx[k] += 2 * a * b * b * c * c;
        gy[k] += 2 * b * a * a * c * c;
        gz[k] += 2 * c * a * a * b * b;
      }
    }
  }
  return grad;
}

// ── BridgeStrategy interface ──────────────────────────────────────────────────

export type ManifoldType = "sphere" | "torus" | "product" | "hyperbolic_poincare";

export interface BridgeStrategy {
  id: string;
  manifold: ManifoldType;
  params: Record<string, number>;
  /** Initialise coordinates from a hard partition. Returns (N+1)×K matrix (index 0 unused). */
  encode(partition: Int8Array, N: number, K: number): number[][];
  /** Manifold-specific gradient of Schur energy. Same shape as encoded. */
  gradient(encoded: number[][], N: number, K: number): number[][];
  /** Project a single K-dim vector back onto the manifold. */
  retract(v: number[]): number[];
  /** Decode continuous coordinates to a hard partition via argmax. */
  decode(encoded: number[][], N: number): Int8Array;
}

export interface EvalResult {
  discreteEBefore: number;
  discreteEAfter: number;
  wallTimeMs: number;
  strategyId: string;
}

// ── Sphere S^(K-1) × radius ───────────────────────────────────────────────────

export function makeSphereBridge(params: { radius?: number; lr?: number } = {}): BridgeStrategy {
  const radius = params.radius ?? 1.0;
  const lr = params.lr ?? 0.01;
  const id = randomUUID();

  return {
    id,
    manifold: "sphere",
    params: { radius, lr },

    encode(partition, N, K) {
      const enc: number[][] = new Array(N + 1);
      for (let i = 1; i <= N; i++) {
        const color = partition[i] ?? 0;
        // Put large value at assigned color, tiny noise elsewhere, then retract to sphere of radius r
        const v = new Array<number>(K).fill(0);
        v[Math.min(color, K - 1)] = 1.0;
        // Add tiny noise so argmax is well-defined
        for (let k = 0; k < K; k++) v[k] += 0.001 * Math.random();
        enc[i] = this.retract(v).map(x => x); // already at radius r after retract
      }
      return enc;
    },

    gradient(encoded, N, K) {
      // Euclidean grad + Riemannian projection onto tangent plane
      const euclidGrad = schurEuclideanGradient(encoded, N, K);
      const riemannGrad: number[][] = new Array(N + 1);
      for (let i = 1; i <= N; i++) {
        const v = encoded[i]!;
        const g = euclidGrad[i]!;
        // dot product <g, v>
        let dot = 0;
        for (let k = 0; k < K; k++) dot += g[k]! * v[k]!;
        // project: g - (dot/r^2) * v
        const r2 = radius * radius;
        riemannGrad[i] = g.map((gk, k) => gk - (dot / r2) * v[k]!);
      }
      return riemannGrad;
    },

    retract(v) {
      let norm = 0;
      for (const x of v) norm += x * x;
      norm = Math.sqrt(norm);
      if (norm < 1e-12) {
        const out = new Array<number>(v.length).fill(0);
        out[0] = radius;
        return out;
      }
      return v.map(x => (x / norm) * radius);
    },

    decode(encoded, N) {
      const hard = new Int8Array(N + 1);
      for (let i = 1; i <= N; i++) {
        const v = encoded[i]!;
        let best = 0, bestVal = v[0]!;
        for (let k = 1; k < v.length; k++) {
          if (v[k]! > bestVal) { bestVal = v[k]!; best = k; }
        }
        hard[i] = best;
      }
      return hard;
    },
  };
}

// ── Torus T^K via angular coordinates ────────────────────────────────────────

export function makeTorusBridge(params: { freq?: number; lr?: number } = {}): BridgeStrategy {
  const freq = params.freq ?? 1.0;
  const lr = params.lr ?? 0.01;
  const id = randomUUID();

  // On the torus, encode stores angles θ_i ∈ [0,2π)^K.
  // The energy uses v_i[k] = cos(freq * θ_i[k]) as color weights.

  function torusWeights(angles: number[]): number[] {
    return angles.map(θ => Math.cos(freq * θ));
  }

  return {
    id,
    manifold: "torus",
    params: { freq, lr },

    encode(partition, N, K) {
      const enc: number[][] = new Array(N + 1);
      for (let i = 1; i <= N; i++) {
        const color = partition[i] ?? 0;
        // Set θ_color ≈ 0 (max weight), others ≈ π/2 (weight ≈ 0)
        const angles = Array.from({ length: K }, (_, k) =>
          k === color ? 0.05 * Math.random() : Math.PI / 2 + 0.05 * Math.random()
        );
        enc[i] = angles;
      }
      return enc;
    },

    gradient(encoded, N, K) {
      // Compute weights and Euclidean gradient w.r.t. weights
      const weights: number[][] = encoded.map(angles => angles ? torusWeights(angles) : []);
      const euclidGrad = schurEuclideanGradient(weights, N, K);

      // Chain rule: ∂E/∂θ_i[k] = ∂E/∂w_i[k] * (-freq * sin(freq * θ_i[k]))
      const grad: number[][] = new Array(N + 1);
      for (let i = 1; i <= N; i++) {
        const angles = encoded[i]!;
        const gw = euclidGrad[i]!;
        grad[i] = angles.map((θ, k) => gw[k]! * (-freq * Math.sin(freq * θ)));
      }
      return grad;
    },

    retract(v) {
      // Angles are unconstrained — no projection needed
      return v;
    },

    decode(encoded, N) {
      const hard = new Int8Array(N + 1);
      for (let i = 1; i <= N; i++) {
        const angles = encoded[i]!;
        // Assign to color with maximum |cos(freq * θ)|
        let best = 0, bestVal = Math.abs(Math.cos(freq * angles[0]!));
        for (let k = 1; k < angles.length; k++) {
          const w = Math.abs(Math.cos(freq * angles[k]!));
          if (w > bestVal) { bestVal = w; best = k; }
        }
        hard[i] = best;
      }
      return hard;
    },
  };
}

// ── Hyperbolic Poincaré ball B^K ──────────────────────────────────────────────

export function makeHyperbolicBridge(params: { curvature?: number; lr?: number } = {}): BridgeStrategy {
  const curvature = params.curvature ?? 1.0;
  const lr = params.lr ?? 0.005;
  const MAX_NORM = 1.0 - 1e-5;
  const id = randomUUID();

  return {
    id,
    manifold: "hyperbolic_poincare",
    params: { curvature, lr },

    encode(partition, N, K) {
      const enc: number[][] = new Array(N + 1);
      for (let i = 1; i <= N; i++) {
        const color = partition[i] ?? 0;
        // Place near axis of assigned color, well inside unit ball
        const v = Array.from({ length: K }, (_, k) =>
          k === color ? 0.8 + 0.01 * (Math.random() - 0.5) : 0.01 * (Math.random() - 0.5)
        );
        enc[i] = this.retract(v);
      }
      return enc;
    },

    gradient(encoded, N, K) {
      // Euclidean gradient scaled by the Poincaré conformal factor:
      // λ_x = 2*curvature / (1 - ||x||²)
      // Riemannian grad = 1/λ_x² * Euclidean grad = (1-||x||²)² / (4c²) * ∇E
      const euclidGrad = schurEuclideanGradient(encoded, N, K);
      const grad: number[][] = new Array(N + 1);
      for (let i = 1; i <= N; i++) {
        const v = encoded[i]!;
        const g = euclidGrad[i]!;
        let norm2 = 0;
        for (const x of v) norm2 += x * x;
        const scale = Math.pow(1 - norm2, 2) / (4 * curvature * curvature);
        grad[i] = g.map(gk => gk * scale);
      }
      return grad;
    },

    retract(v) {
      let norm = 0;
      for (const x of v) norm += x * x;
      norm = Math.sqrt(norm);
      if (norm < 1e-12) return v.map(() => 0);
      if (norm >= MAX_NORM) {
        return v.map(x => (x / norm) * (MAX_NORM - 1e-6));
      }
      return [...v];
    },

    decode(encoded, N) {
      const hard = new Int8Array(N + 1);
      for (let i = 1; i <= N; i++) {
        const v = encoded[i]!;
        let best = 0, bestVal = v[0]!;
        for (let k = 1; k < v.length; k++) {
          if (v[k]! > bestVal) { bestVal = v[k]!; best = k; }
        }
        hard[i] = best;
      }
      return hard;
    },
  };
}

// ── Product manifold: Sphere^(K/2) × Simplex^(K/2) ────────────────────────────

export function makeProductBridge(params: {
  sphere_weight?: number;
  simplex_weight?: number;
  lr?: number;
} = {}): BridgeStrategy {
  const sphereW = params.sphere_weight ?? 0.5;
  const simplexW = params.simplex_weight ?? 0.5;
  const lr = params.lr ?? 0.01;
  const id = randomUUID();

  // Simplex projection for a subvector
  function projectSimplex(v: number[]): number[] {
    const n = v.length;
    const sorted = [...v].sort((a, b) => b - a);
    let cumSum = 0, rho = 0;
    for (let j = 0; j < n; j++) {
      cumSum += sorted[j]!;
      if (sorted[j]! - (cumSum - 1) / (j + 1) > 0) rho = j;
    }
    const theta = (sorted.slice(0, rho + 1).reduce((a, b) => a + b, 0) - 1) / (rho + 1);
    return v.map(x => Math.max(x - theta, 0));
  }

  function sphereNorm(v: number[]): number[] {
    let norm = 0;
    for (const x of v) norm += x * x;
    norm = Math.sqrt(norm);
    if (norm < 1e-12) { const o = [...v]; o[0] = 1; return o; }
    return v.map(x => x / norm);
  }

  return {
    id,
    manifold: "product",
    params: { sphere_weight: sphereW, simplex_weight: simplexW, lr },

    encode(partition, N, K) {
      const half = Math.floor(K / 2);
      const enc: number[][] = new Array(N + 1);
      for (let i = 1; i <= N; i++) {
        const color = partition[i] ?? 0;
        const v = new Array<number>(K).fill(0.1 / K);
        v[Math.min(color, K - 1)] = 0.8;
        // First half on sphere, second half on simplex
        const spherePart = sphereNorm(v.slice(0, half));
        const simplexPart = projectSimplex(v.slice(half));
        enc[i] = [...spherePart, ...simplexPart];
      }
      return enc;
    },

    gradient(encoded, N, K) {
      const half = Math.floor(K / 2);
      const euclidGrad = schurEuclideanGradient(encoded, N, K);
      const grad: number[][] = new Array(N + 1);
      for (let i = 1; i <= N; i++) {
        const v = encoded[i]!;
        const g = euclidGrad[i]!;
        // Sphere part: Riemannian projection
        const vSphere = v.slice(0, half);
        const gSphere = g.slice(0, half);
        let dot = 0;
        for (let k = 0; k < half; k++) dot += gSphere[k]! * vSphere[k]!;
        const riemannSphere = gSphere.map((gk, k) => (gk - dot * vSphere[k]!) * sphereW);
        // Simplex part: projected gradient (subtract mean)
        const gSimplex = g.slice(half);
        const meanG = gSimplex.reduce((a, b) => a + b, 0) / gSimplex.length;
        const riemannSimplex = gSimplex.map(gk => (gk - meanG) * simplexW);
        grad[i] = [...riemannSphere, ...riemannSimplex];
      }
      return grad;
    },

    retract(v) {
      const K_actual = v.length;
      const half = Math.floor(K_actual / 2);
      const spherePart = sphereNorm(v.slice(0, half));
      const simplexPart = projectSimplex(v.slice(half));
      return [...spherePart, ...simplexPart];
    },

    decode(encoded, N) {
      const hard = new Int8Array(N + 1);
      for (let i = 1; i <= N; i++) {
        const v = encoded[i]!;
        let best = 0, bestVal = Math.abs(v[0]!);
        for (let k = 1; k < v.length; k++) {
          if (Math.abs(v[k]!) > bestVal) { bestVal = Math.abs(v[k]!); best = k; }
        }
        hard[i] = best;
      }
      return hard;
    },
  };
}

// ── TinyMLP reward model (pure TS, no Python) ─────────────────────────────────

const PARAM_DIM = 6; // [radius, lr, curvature, freq, sphere_weight, simplex_weight]

function gelu(x: number): number {
  return x * 0.5 * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)));
}
function geluPrime(x: number): number {
  const t = Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x));
  const sech2 = 1 - t * t;
  return 0.5 * (1 + t) + 0.5 * x * sech2 * Math.sqrt(2 / Math.PI) * (1 + 3 * 0.044715 * x * x);
}

function randNormal(scale: number): number {
  const u = Math.random() + 1e-12;
  const v = Math.random();
  return scale * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function matMul(W: number[][], x: number[]): number[] {
  return W.map(row => row.reduce((sum, w, j) => sum + w * (x[j] ?? 0), 0));
}

export class TinyMLP {
  // 6 → 16 → 8 → 1
  W1: number[][];  b1: number[];
  W2: number[][];  b2: number[];
  W3: number[][];  b3: number[];

  constructor() {
    const init = (rows: number, cols: number) =>
      Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => randNormal(Math.sqrt(2 / cols)))
      );
    this.W1 = init(16, PARAM_DIM);  this.b1 = new Array(16).fill(0);
    this.W2 = init(8, 16);          this.b2 = new Array(8).fill(0);
    this.W3 = init(1, 8);           this.b3 = [0];
  }

  forward(x: number[]): number {
    const a1 = matMul(this.W1, x).map((z, i) => gelu(z + this.b1[i]!));
    const a2 = matMul(this.W2, a1).map((z, i) => gelu(z + this.b2[i]!));
    return matMul(this.W3, a2)[0]! + this.b3[0]!;
  }

  /** SGD step minimising (forward(x) - target)^2 / 2. Returns loss. */
  backward(x: number[], target: number, lr: number = 0.001): number {
    // Forward pass — collect pre-activations
    const z1 = matMul(this.W1, x).map((z, i) => z + this.b1[i]!);
    const a1 = z1.map(z => gelu(z));
    const z2 = matMul(this.W2, a1).map((z, i) => z + this.b2[i]!);
    const a2 = z2.map(z => gelu(z));
    const z3 = matMul(this.W3, a2)[0]! + this.b3[0]!;
    const pred = z3;
    const loss = 0.5 * (pred - target) ** 2;

    // Backward — layer 3
    const dPred = pred - target;
    const dW3 = [a2.map(a => dPred * a)];
    const db3 = [dPred];
    const da2 = this.W3[0]!.map(w => dPred * w);

    // Layer 2
    const dz2 = da2.map((d, i) => d * geluPrime(z2[i]!));
    const dW2 = dz2.map(d => a1.map(a => d * a));
    const db2 = [...dz2];
    const da1 = this.W2[0]!.map((_, j) => dz2.reduce((s, d, i) => s + d * this.W2[i]![j]!, 0));

    // Layer 1
    const dz1 = da1.map((d, i) => d * geluPrime(z1[i]!));
    const dW1 = dz1.map(d => x.map(xi => d * xi));
    const db1 = [...dz1];

    // SGD update
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < PARAM_DIM; j++) this.W1[i]![j]! -= lr * dW1[i]![j]!;
      this.b1[i]! -= lr * db1[i]!;
    }
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 16; j++) this.W2[i]![j]! -= lr * dW2[i]![j]!;
      this.b2[i]! -= lr * db2[i]!;
    }
    for (let j = 0; j < 8; j++) this.W3[0]![j]! -= lr * dW3[0]![j]!;
    this.b3[0]! -= lr * db3[0]!;

    return loss;
  }
}

// ── BridgeStrategyLibrary ─────────────────────────────────────────────────────

const WINDOW = 100; // rolling window size

export class BridgeStrategyLibrary {
  private strategyMap = new Map<string, BridgeStrategy>();
  private resultsMap = new Map<string, number[]>(); // E-reduction history

  constructor() {
    // Seed population: one per manifold type with diverse params
    for (const s of [
      makeSphereBridge({ radius: 1.0, lr: 0.010 }),
      makeSphereBridge({ radius: 0.7, lr: 0.005 }),
      makeTorusBridge({ freq: 1.0, lr: 0.010 }),
      makeTorusBridge({ freq: 2.0, lr: 0.007 }),
      makeHyperbolicBridge({ curvature: 1.0, lr: 0.005 }),
      makeHyperbolicBridge({ curvature: 0.5, lr: 0.008 }),
      makeProductBridge({ sphere_weight: 0.7, simplex_weight: 0.3, lr: 0.010 }),
      makeProductBridge({ sphere_weight: 0.3, simplex_weight: 0.7, lr: 0.008 }),
    ]) {
      this.add(s);
    }
  }

  add(strategy: BridgeStrategy): void {
    this.strategyMap.set(strategy.id, strategy);
    if (!this.resultsMap.has(strategy.id)) {
      this.resultsMap.set(strategy.id, [0]); // neutral prior
    }
  }

  recordResult(strategyId: string, eReduction: number): void {
    if (!this.resultsMap.has(strategyId)) this.resultsMap.set(strategyId, []);
    const history = this.resultsMap.get(strategyId)!;
    history.push(eReduction);
    if (history.length > WINDOW) history.shift();
  }

  getMeanReduction(strategyId: string): number {
    const h = this.resultsMap.get(strategyId) ?? [0];
    return h.reduce((a, b) => a + b, 0) / h.length;
  }

  rank(): BridgeStrategy[] {
    return [...this.strategyMap.values()].sort(
      (a, b) => this.getMeanReduction(b.id) - this.getMeanReduction(a.id)
    );
  }

  count(): number {
    return this.strategyMap.size;
  }

  all(): BridgeStrategy[] {
    return [...this.strategyMap.values()];
  }
}

// ── Param encoding for TinyMLP ────────────────────────────────────────────────

function encodeStrategyParams(params: Record<string, number>): number[] {
  return [
    params.radius          ?? 1.0,
    (params.lr             ?? 0.01) * 100, // scale to ~1
    params.curvature       ?? 1.0,
    params.freq            ?? 1.0,
    params.sphere_weight   ?? 0.5,
    params.simplex_weight  ?? 0.5,
  ];
}

function strategyToText(s: BridgeStrategy): string {
  const paramStr = Object.entries(s.params)
    .map(([k, v]) => `${k}=${v.toFixed(4)}`)
    .join(":");
  return `${s.manifold}:${paramStr}`;
}

// ── Mutation helpers: combinatorial novelty, NO LLM ──────────────────────────

function perturb(val: number, scale: number, min = 0): number {
  return Math.max(min, val + (Math.random() - 0.5) * 2 * scale);
}

function mutateStrategy(parent: BridgeStrategy): BridgeStrategy {
  const p = { ...parent.params };
  switch (parent.manifold) {
    case "sphere":
      return makeSphereBridge({ radius: perturb(p.radius ?? 1, 0.3, 0.1), lr: perturb(p.lr ?? 0.01, 0.005, 0.0001) });
    case "torus":
      return makeTorusBridge({ freq: perturb(p.freq ?? 1, 0.5, 0.1), lr: perturb(p.lr ?? 0.01, 0.005, 0.0001) });
    case "hyperbolic_poincare":
      return makeHyperbolicBridge({ curvature: perturb(p.curvature ?? 1, 0.3, 0.1), lr: perturb(p.lr ?? 0.005, 0.003, 0.00001) });
    case "product":
      return makeProductBridge({ sphere_weight: perturb(p.sphere_weight ?? 0.5, 0.2, 0.05), simplex_weight: perturb(p.simplex_weight ?? 0.5, 0.2, 0.05), lr: perturb(p.lr ?? 0.01, 0.005, 0.0001) });
  }
}

function crossoverStrategy(a: BridgeStrategy, b: BridgeStrategy): BridgeStrategy {
  // Pick manifold from parent with higher score (pass by crossover of same manifold)
  const manifold = a.manifold;
  const pa = a.params, pb = b.manifold === manifold ? b.params : pa;
  const mixed: Record<string, number> = {};
  for (const key of Object.keys(pa)) {
    mixed[key] = Math.random() < 0.5 ? pa[key]! : (pb[key] ?? pa[key]!);
  }
  switch (manifold) {
    case "sphere": return makeSphereBridge(mixed);
    case "torus": return makeTorusBridge(mixed);
    case "hyperbolic_poincare": return makeHyperbolicBridge(mixed);
    case "product": return makeProductBridge(mixed);
  }
}

// ── BridgeLearner ─────────────────────────────────────────────────────────────

export class BridgeLearner {
  readonly library: BridgeStrategyLibrary;
  readonly rewardModel: TinyMLP;
  private experiencePath: string;

  constructor(experiencePath: string = "/tmp/bridge_experiences.jsonl") {
    this.library = new BridgeStrategyLibrary();
    this.rewardModel = new TinyMLP();
    this.experiencePath = experiencePath;
  }

  /**
   * Propose up to 5 candidate strategies using PRM-guided combinatorial mutation.
   * Pure combinatorial novelty — no LLM calls.
   */
  propose(): BridgeStrategy[] {
    const topK = this.library.rank().slice(0, 4);
    const existingTexts = this.library.all().map(strategyToText);

    // Generate candidate pool: mutations + crossovers
    const pool: BridgeStrategy[] = [];
    for (const parent of topK) {
      pool.push(mutateStrategy(parent));
      pool.push(mutateStrategy(parent)); // two mutations per parent
    }
    // Crossover top pairs
    if (topK.length >= 2) {
      pool.push(crossoverStrategy(topK[0]!, topK[1]!));
      pool.push(crossoverStrategy(topK[1]!, topK[0]!));
    }
    // Novel manifold: pick least-represented manifold
    const manifestCounts = new Map<ManifoldType, number>();
    for (const s of this.library.all()) {
      manifestCounts.set(s.manifold, (manifestCounts.get(s.manifold) ?? 0) + 1);
    }
    const leastUsed = (["sphere", "torus", "product", "hyperbolic_poincare"] as ManifoldType[])
      .sort((a, b) => (manifestCounts.get(a) ?? 0) - (manifestCounts.get(b) ?? 0))[0]!;
    switch (leastUsed) {
      case "sphere": pool.push(makeSphereBridge({ radius: Math.random() * 1.5 + 0.5, lr: 0.005 + Math.random() * 0.02 })); break;
      case "torus": pool.push(makeTorusBridge({ freq: Math.random() * 3 + 0.5, lr: 0.005 + Math.random() * 0.02 })); break;
      case "hyperbolic_poincare": pool.push(makeHyperbolicBridge({ curvature: Math.random() * 2 + 0.1, lr: 0.001 + Math.random() * 0.01 })); break;
      case "product": pool.push(makeProductBridge({ sphere_weight: Math.random(), simplex_weight: Math.random(), lr: 0.005 + Math.random() * 0.02 })); break;
    }

    // PRM-style novelty scoring (self-contained, no LLM, no ProgramDatabase)
    const prmCandidates: BridgePRMCandidate[] = pool.map(s => ({
      ruleText: strategyToText(s),
      island: s.manifold,
    }));
    const islandCounts = new Map<string, number>();
    for (const s of this.library.all()) {
      islandCounts.set(s.manifold, (islandCounts.get(s.manifold) ?? 0) + 1);
    }
    const scored = scoreNoveltyCandidates(prmCandidates, existingTexts, islandCounts);

    // Also score by reward model prediction
    const withReward = scored.map((sc, idx) => {
      const s = pool[idx]!;
      const paramVec = encodeStrategyParams(s.params);
      const predicted = this.rewardModel.forward(paramVec);
      return { strategy: s, totalScore: sc.score + predicted * 0.01 };
    });

    return withReward
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 5)
      .map(x => x.strategy);
  }

  /**
   * Evaluate a bridge strategy by running manifold gradient descent
   * and returning the discrete E-reduction.
   */
  async evaluate(
    strategy: BridgeStrategy,
    partition: Int8Array,
    N: number,
    K: number,
    maxIter: number = 1000,
  ): Promise<EvalResult> {
    const t0 = Date.now();
    const discreteEBefore = discreteSchurEnergy(partition, N);
    const lr = strategy.params.lr ?? 0.01;

    let enc = strategy.encode(partition, N, K);

    for (let iter = 0; iter < maxIter; iter++) {
      const grad = strategy.gradient(enc, N, K);
      // Apply gradient step + retract for each element
      for (let i = 1; i <= N; i++) {
        const newV = enc[i]!.map((x, k) => x - lr * (grad[i]?.[k] ?? 0));
        enc[i] = strategy.retract(newV);
      }
    }

    const hardPartition = strategy.decode(enc, N);
    const discreteEAfter = discreteSchurEnergy(hardPartition, N);
    const wallTimeMs = Date.now() - t0;

    return { discreteEBefore, discreteEAfter, wallTimeMs, strategyId: strategy.id };
  }

  /**
   * Record the evaluation result, update the library, train reward model,
   * and persist to JSONL.
   */
  updateRewardModel(strategy: BridgeStrategy, result: EvalResult): void {
    const eReduction = result.discreteEBefore - result.discreteEAfter;

    // Update library scores
    this.library.recordResult(strategy.id, eReduction);

    // Add strategy to library if it's not there yet
    this.library.add(strategy);

    // Train reward model: (params → E-reduction)
    const x = encodeStrategyParams(strategy.params);
    this.rewardModel.backward(x, eReduction, 0.001);

    // Persist experience
    const record = {
      manifold: strategy.manifold,
      params: strategy.params,
      e_before: result.discreteEBefore,
      e_after: result.discreteEAfter,
      e_reduction: eReduction,
      wall_ms: result.wallTimeMs,
      timestamp: new Date().toISOString(),
    };
    try {
      appendFileSync(this.experiencePath, JSON.stringify(record) + "\n");
    } catch { /* non-fatal */ }
  }
}
