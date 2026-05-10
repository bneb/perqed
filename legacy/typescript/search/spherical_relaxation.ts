/**
 * spherical_relaxation.ts — Riemannian Gradient Descent on S^(K-1)
 *
 * A non-Euclidean continuous relaxation of the Schur partition problem.
 * Each element i ∈ {1..N} is represented as a unit vector v_i ∈ S^(K-1)
 * (the (K-1)-sphere embedded in R^K). The Schur soft energy is a degree-6
 * polynomial in these unit vectors, and we optimize it via Riemannian
 * gradient descent — projecting the Euclidean gradient onto the tangent
 * plane of the sphere at each point before retracting back to the manifold.
 *
 * Geometric advantage over the flat simplex SDP:
 *   - The sphere has constant positive sectional curvature +1, inducing a
 *     Riemannian metric that changes the shape of energy level sets.
 *   - Saddle points on the flat simplex become saddle points with different
 *     escape directions in the Riemannian metric, enabling the optimizer to
 *     escape basins that trap flat-space gradient descent.
 *   - The exponential map keeps iterates exactly on the manifold at zero
 *     computational cost (just normalize).
 *
 * Reference: Bonnabel (2013), "Stochastic Gradient Descent on Riemannian
 * Manifolds", IEEE TAC. Section 3.1 (sphere retraction).
 */

export type SphereVectors = number[][];  // index 0..N; index 0 unused; each sv[i] has length K

// ── Sphere operations ─────────────────────────────────────────────────────────

/**
 * Project a vector onto S^(K-1) by normalizing it.
 * If the vector is near-zero, returns the first standard basis vector.
 */
export function retractToSphere(v: number[]): number[] {
  let norm = 0;
  for (let k = 0; k < v.length; k++) norm += v[k]! * v[k]!;
  norm = Math.sqrt(norm);
  if (norm < 1e-12) {
    const out = new Array<number>(v.length).fill(0);
    out[0] = 1.0;
    return out;
  }
  return v.map(x => x / norm);
}

/**
 * Initialize sphere vectors from a hard partition.
 *
 * @param hard       Int8Array partition, 1-indexed
 * @param N          Domain size
 * @param K          Number of colors
 * @param temperature Controls how "soft" the initialization is.
 *                   0.0 → one-hot (v[color]=1, others=0 → then normalize)
 *                   >0  → add Gaussian noise before normalizing
 */
export function initSphericalFromHard(
  hard: Int8Array,
  N: number,
  K: number,
  temperature: number = 0.3,
): SphereVectors {
  const sv: number[][] = new Array(N + 1);
  for (let i = 1; i <= N; i++) {
    const color = hard[i] ?? 0;
    const v = new Array<number>(K).fill(0);
    v[color] = 1.0;
    if (temperature > 0) {
      // Add Gaussian noise scaled by temperature
      for (let k = 0; k < K; k++) {
        // Box-Muller for Gaussian noise
        const u1 = Math.random() + 1e-12;
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        v[k]! += temperature * z;
      }
    }
    sv[i] = retractToSphere(v);
  }
  return sv;
}

// ── Energy ────────────────────────────────────────────────────────────────────

/**
 * Spherical Schur soft energy.
 *
 * E(v) = Σ_{x+y=z, 1≤x≤y, z≤N} Σ_{k=0}^{K-1} v_x[k]² · v_y[k]² · v_z[k]²
 *
 * When all vectors are one-hot this equals the discrete Schur energy.
 * When vectors are continuous unit vectors this is a smooth surrogate.
 */
export function sphericalEnergy(sv: SphereVectors, N: number, K: number): number {
  let E = 0.0;
  for (let x = 1; x <= N; x++) {
    for (let y = x; y <= N; y++) {
      const z = x + y;
      if (z > N) break;
      const vx = sv[x]!;
      const vy = sv[y]!;
      const vz = sv[z]!;
      for (let k = 0; k < K; k++) {
        E += vx[k]! * vx[k]! * vy[k]! * vy[k]! * vz[k]! * vz[k]!;
      }
    }
  }
  return E;
}

// ── Euclidean gradient ────────────────────────────────────────────────────────

/**
 * Compute the Euclidean gradient of E w.r.t. the sphere vectors.
 *
 * ∂E/∂v_x[k] = 2·v_x[k] · Σ_{y,z: x+y=z, x≤y} v_y[k]² · v_z[k]²
 *             + 2·v_x[k] · Σ_{y,z: y+x=z, y≤x} v_y[k]² · v_z[k]²
 *             + 2·v_x[k] · Σ_{y,z: y+z=x}      v_y[k]² · v_z[k]²
 *
 * We collect all roles of x (as first summand, second summand, or sum).
 */
export function sphericalEnergyGradient(sv: SphereVectors, N: number, K: number): SphereVectors {
  const grad: number[][] = new Array(N + 1);
  for (let i = 1; i <= N; i++) grad[i] = new Array<number>(K).fill(0);

  for (let x = 1; x <= N; x++) {
    for (let y = x; y <= N; y++) {
      const z = x + y;
      if (z > N) break;
      const vx = sv[x]!;
      const vy = sv[y]!;
      const vz = sv[z]!;
      const gx = grad[x]!;
      const gy = grad[y]!;
      const gz = grad[z]!;
      for (let k = 0; k < K; k++) {
        const vxk = vx[k]!, vyk = vy[k]!, vzk = vz[k]!;
        const vyk2 = vyk * vyk, vzk2 = vzk * vzk;
        const vxk2 = vxk * vxk;
        // ∂E/∂vx[k] — x as addend 1
        gx[k]! += 2 * vxk * vyk2 * vzk2;
        // ∂E/∂vy[k] — y as addend 2
        gy[k]! += 2 * vyk * vxk2 * vzk2;
        // ∂E/∂vz[k] — z as the sum
        gz[k]! += 2 * vzk * vxk2 * vyk2;
      }
    }
  }
  return grad;
}

// ── Riemannian gradient (tangent plane projection) ────────────────────────────

/**
 * Project the Euclidean gradient onto the tangent plane of S^(K-1) at v:
 *   ∇_Riem = ∇_E - ⟨∇_E, v⟩ · v
 * This is the standard Riemannian gradient for the sphere.
 */
function projectToTangent(euclidGrad: number[], v: number[]): number[] {
  let dot = 0;
  for (let k = 0; k < v.length; k++) dot += euclidGrad[k]! * v[k]!;
  return euclidGrad.map((g, k) => g - dot * v[k]!);
}

// ── Hard decoding ─────────────────────────────────────────────────────────────

/**
 * Decode sphere vectors to a hard partition via argmax.
 * Returns an Int8Array of length N+1 (index 0 unused).
 */
export function decodeHard(sv: SphereVectors, N: number): Int8Array {
  const hard = new Int8Array(N + 1);
  for (let i = 1; i <= N; i++) {
    const v = sv[i]!;
    let best = 0, bestVal = v[0]!;
    for (let k = 1; k < v.length; k++) {
      if (v[k]! > bestVal) { bestVal = v[k]!; best = k; }
    }
    hard[i] = best;
  }
  return hard;
}

// ── Full Riemannian gradient descent ─────────────────────────────────────────

export interface SphericalDescentResult {
  hardPartition: Int8Array;
  finalSphereEnergy: number;
  finalSphereVectors: SphereVectors;
  iterations: number;
}

/**
 * Run Riemannian gradient descent on S^(K-1) starting from a hard partition.
 *
 * At each step:
 *   1. Compute Euclidean gradient ∇_E
 *   2. Project to tangent plane at each v_i: ∇_Riem_i = ∇_E_i - ⟨∇_E_i, v_i⟩·v_i
 *   3. Retract: v_i ← normalize(v_i - lr · ∇_Riem_i)
 *
 * Returns the projected hard partition (argmax decode) and the final sphere
 * energy at convergence.
 *
 * @param warmStart      Hard partition to initialize from
 * @param N              Domain size
 * @param K              Number of colors
 * @param maxIter        Maximum gradient steps (default 5000)
 * @param lr             Learning rate (default 0.01)
 * @param temperature    Initialization temperature for randomization (default 0.3)
 */
export async function runSphericalGradientDescent(
  warmStart: Int8Array,
  N: number,
  K: number,
  maxIter: number = 5000,
  lr: number = 0.01,
  temperature: number = 0.3,
): Promise<SphericalDescentResult> {
  let sv = initSphericalFromHard(warmStart, N, K, temperature);
  let E = sphericalEnergy(sv, N, K);

  for (let iter = 0; iter < maxIter; iter++) {
    const euclidGrad = sphericalEnergyGradient(sv, N, K);

    // Riemannian gradient step + retraction
    let moved = false;
    for (let i = 1; i <= N; i++) {
      const riemannGrad = projectToTangent(euclidGrad[i]!, sv[i]!);
      const newV = sv[i]!.map((x, k) => x - lr * riemannGrad[k]!);
      sv[i] = retractToSphere(newV);
      moved = true;
    }

    // Adaptive LR: decay slightly each step
    lr *= 0.9999;

    // Early stopping: recompute energy every 100 steps
    if (iter % 100 === 99) {
      const newE = sphericalEnergy(sv, N, K);
      if (Math.abs(newE - E) < 1e-10) break;
      E = newE;
    }

    if (!moved) break;
  }

  E = sphericalEnergy(sv, N, K);
  const hardPartition = decodeHard(sv, N);

  return {
    hardPartition,
    finalSphereEnergy: E,
    finalSphereVectors: sv,
    iterations: maxIter,
  };
}
