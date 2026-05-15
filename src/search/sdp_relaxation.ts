/**
 * sdp_relaxation.ts — Continuous relaxation of the Schur sum-free partition problem.
 *
 * Key insight: instead of discrete coloring c: {1..N} → {0..K-1},
 * work with a probability vector p_i ∈ Δ^K (K-simplex) for each i.
 *
 * The "soft" Schur energy becomes:
 *   E_soft(P) = Σ_{x+y=z, x≤y} Σ_k p_x[k] * p_y[k] * p_z[k]
 *
 * This is a degree-3 polynomial in P — smooth everywhere, with well-defined
 * gradients that can escape flat discrete basins where SA gets stuck.
 *
 * After gradient descent converges, PROJECT back to discrete via argmax.
 * The projected partition typically has much lower energy than a random restart.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Soft partition: probs[i] is a K-vector on the simplex for element i (1-indexed). */
export interface SoftPartition {
  /** Length N+1 (index 0 unused), each element is a Float64Array of length K. */
  probs: Float64Array[];
  N: number;
  K: number;
}

// ── Construction ──────────────────────────────────────────────────────────────

/**
 * Create a soft partition from a hard partition, with a small amount of
 * smoothing (temperature `temp`) to allow gradient flow.
 *
 * @param temp  0 = one-hot (no smoothing), 0.1 = 10% smoothing across all colors
 */
export function initSoftPartitionFromHard(
  hard: Int8Array,
  N: number,
  K: number,
  temp = 0.1,
): SoftPartition {
  const smoothing = temp / K;
  const probs: Float64Array[] = Array.from({ length: N + 1 }, (_, i) => {
    const p = new Float64Array(K).fill(smoothing);
    if (i >= 1 && i <= N) {
      const color = hard[i];
      if (color !== undefined && color >= 0 && color < K) {
        p[color]! += 1 - temp;
      }
    }
    return p;
  });
  return { probs, N, K };
}

/** Create a uniform soft partition (maximum entropy — pure gradient start). */
export function initUniformSoftPartition(N: number, K: number): SoftPartition {
  const probs: Float64Array[] = Array.from({ length: N + 1 }, () =>
    new Float64Array(K).fill(1 / K)
  );
  return { probs, N, K };
}

// ── Energy and gradient ───────────────────────────────────────────────────────

/**
 * Compute soft Schur energy: expected number of monochromatic x+y=z triples.
 *   E_soft = Σ_{x≤y, x+y=z≤N} Σ_k p_x[k] * p_y[k] * p_z[k]
 */
export function softEnergy(sp: SoftPartition): number {
  const { probs, N, K } = sp;
  let E = 0;
  for (let x = 1; x <= N; x++) {
    for (let y = x; y <= N; y++) {
      const z = x + y;
      if (z > N) break;
      const px = probs[x]!;
      const py = probs[y]!;
      const pz = probs[z]!;
      for (let k = 0; k < K; k++) {
        E += px[k]! * py[k]! * pz[k]!;
      }
    }
  }
  return E;
}

/**
 * Compute the gradient of E_soft w.r.t. p_i[k] for all (i, k).
 *
 *   ∂E/∂p_x[k] = Σ_{y: x+y≤N} p_y[k]*p_{x+y}[k]  +  Σ_{y: y>x, y-x≥1} p_y[k]*p_{y-x}[k]
 *
 * Returns an array of Float64Arrays (same shape as sp.probs).
 */
export function softEnergyGradient(sp: SoftPartition): Float64Array[] {
  const { probs, N, K } = sp;
  const grad: Float64Array[] = Array.from({ length: N + 1 }, () => new Float64Array(K));

  for (let x = 1; x <= N; x++) {
    for (let y = x; y <= N; y++) {
      const z = x + y;
      if (z > N) break;
      const px = probs[x]!;
      const py = probs[y]!;
      const pz = probs[z]!;
      const gx = grad[x]!;
      const gy = grad[y]!;
      const gz = grad[z]!;
      for (let k = 0; k < K; k++) {
        gx[k]! += py[k]! * pz[k]!;
        gy[k]! += px[k]! * pz[k]!;
        gz[k]! += px[k]! * py[k]!;
      }
    }
  }
  return grad;
}

// ── Simplex projection ────────────────────────────────────────────────────────

/**
 * Project a K-vector onto the probability simplex (sum to 1, all ≥ 0).
 * Uses the O(K log K) isotonic regression algorithm.
 */
export function projectOntoSimplex(v: Float64Array): Float64Array {
  const K = v.length;
  const sorted = Array.from(v).sort((a, b) => b - a);
  let cssv = 0;
  let rho = 0;
  for (let j = 0; j < K; j++) {
    cssv += sorted[j]!;
    if (sorted[j]! - (cssv - 1) / (j + 1) > 0) rho = j;
  }
  const cssv2 = sorted.slice(0, rho + 1).reduce((a, b) => a + b, 0);
  const theta = (cssv2 - 1) / (rho + 1);
  const result = new Float64Array(K);
  for (let k = 0; k < K; k++) result[k] = Math.max(0, v[k]! - theta);
  return result;
}

// ── Gradient descent ──────────────────────────────────────────────────────────

/**
 * Run projected gradient descent on E_soft.
 * Returns a hard partition (argmax of final soft assignment).
 *
 * @param lr         Learning rate (step size). Default 0.01.
 * @param iterations Number of gradient steps. Default 10_000.
 */
export async function runSoftGradientDescent(
  initial: Int8Array,
  N: number,
  K: number,
  iterations = 10_000,
  lr = 0.01,
): Promise<{ hardPartition: Int8Array; finalSoftEnergy: number }> {
  let sp = initSoftPartitionFromHard(initial, N, K, 0.05);

  for (let iter = 0; iter < iterations; iter++) {
    const grad = softEnergyGradient(sp);

    // Gradient step + simplex projection per element
    for (let i = 1; i <= N; i++) {
      const pi = sp.probs[i]!;
      const gi = grad[i]!;
      const stepped = new Float64Array(K);
      for (let k = 0; k < K; k++) stepped[k] = pi[k]! - lr * gi[k]!;
      sp.probs[i] = projectOntoSimplex(stepped);
    }
  }

  return {
    hardPartition: projectToHard(sp),
    finalSoftEnergy: softEnergy(sp),
  };
}

/**
 * Project soft partition to hard partition via argmax.
 */
export function projectToHard(sp: SoftPartition): Int8Array {
  const { probs, N, K } = sp;
  const hard = new Int8Array(N + 1);
  for (let i = 1; i <= N; i++) {
    const pi = probs[i]!;
    let best = 0;
    let bestVal = pi[0]!;
    for (let k = 1; k < K; k++) {
      if (pi[k]! > bestVal) { bestVal = pi[k]!; best = k; }
    }
    hard[i] = best;
  }
  return hard;
}
