/**
 * sieve_energy.ts — Sieve majorant energy computation for SA search.
 *
 * Computes sieve weights ν(n) and their Fourier transform on minor arcs.
 * Energy = sup_{minor arcs} |ν̂(α)| / (N/logN)
 */

/** Precompute smallest prime factor for Möbius function */
function buildMobius(limit: number): Int8Array {
  const mu = new Int8Array(limit + 1);
  const spf = new Int32Array(limit + 1); // smallest prime factor
  mu[1] = 1;

  for (let i = 2; i <= limit; i++) {
    if (spf[i] === 0) { // i is prime
      spf[i] = i;
      for (let j = i; j <= limit; j += i) {
        if (spf[j] === 0) spf[j] = i;
      }
    }
  }

  for (let n = 2; n <= limit; n++) {
    const p = spf[n];
    const m = n / p;
    if (m % p === 0) {
      mu[n] = 0; // p² divides n
    } else {
      mu[n] = -mu[m]; // one more prime factor
    }
  }

  return mu;
}

/** Sieve prime indicator */
function buildPrimeIndicator(limit: number): Uint8Array {
  const sieve = new Uint8Array(limit + 1);
  sieve[0] = sieve[1] = 0;
  for (let i = 2; i <= limit; i++) sieve[i] = 1;
  for (let i = 2; i * i <= limit; i++) {
    if (sieve[i]) {
      for (let j = i * i; j <= limit; j += i) sieve[j] = 0;
    }
  }
  return sieve;
}

/**
 * Compute sieve weights ν(n) for n = 1..N.
 *
 * ν(n) = (Σ_{d|n, d≤R} λ_d)²
 * where λ_d = μ(d) · P(log(d)/log(R))
 * and P(t) = 1 - Σᵢ coeffs[i] · t^(i+1)
 *
 * The polynomial P satisfies P(0) = 1 (normalization).
 */
export function computeSieveWeights(
  N: number,
  R: number,
  coeffs: number[]
): Float64Array {
  const mu = buildMobius(Math.floor(R) + 1);
  const logR = Math.log(R);
  const weights = new Float64Array(N + 1);

  // Precompute λ_d for d ≤ R
  const maxD = Math.floor(R);
  const lambda = new Float64Array(maxD + 1);
  for (let d = 1; d <= maxD; d++) {
    if (mu[d] === 0) continue;
    const t = Math.log(d) / logR; // t ∈ [0, 1]
    // P(t) = 1 - Σ coeffs[i] * t^(i+1)
    let P = 1.0;
    let tPow = t;
    for (let i = 0; i < coeffs.length; i++) {
      P -= coeffs[i] * tPow;
      tPow *= t;
    }
    lambda[d] = mu[d] * P;
  }

  // For each n, compute Σ_{d|n, d≤R} λ_d, then square
  for (let d = 1; d <= maxD; d++) {
    if (lambda[d] === 0) continue;
    for (let n = d; n <= N; n += d) {
      weights[n] += lambda[d];
    }
  }

  // Square each weight
  for (let n = 1; n <= N; n++) {
    weights[n] = weights[n] * weights[n];
  }

  return weights;
}

/**
 * Check if α is on a major arc: |α - a/q| < Q/(qN) for some a/q, gcd(a,q)=1, q ≤ Q.
 * The width Q/(qN) is the standard Hardy-Littlewood definition.
 */
function isOnMajorArc(alpha: number, Q: number, N: number): boolean {
  for (let q = 1; q <= Q; q++) {
    const threshold = Q / (q * N);
    for (let a = 0; a <= q; a++) {
      // Quick gcd check
      if (a > 0 && a < q) {
        let g = a, h = q;
        while (h) { const t = h; h = g % h; g = t; }
        if (g !== 1) continue;
      }
      const center = a / q;
      let dist = Math.abs(alpha - center);
      if (dist > 0.5) dist = 1.0 - dist;
      if (dist < threshold) return true;
    }
  }
  return false;
}

/**
 * Compute sup |S_ν(α)| on minor arcs via DFT on a grid.
 *
 * S_ν(α) = Σ_{n=1}^{N} ν(n) · e(2πinα)
 *
 * Returns { sup, avgMinor, avgMajor }
 */
export function fourierAnalysis(
  weights: Float64Array,
  N: number,
  Q: number,
  gridSize: number
): { sup: number; avgMinor: number; avgMajor: number; minorFrac: number } {
  let sup = 0;
  let sumMinor = 0, countMinor = 0;
  let sumMajor = 0, countMajor = 0;

  for (let j = 0; j < gridSize; j++) {
    const alpha = (j + 0.5) / gridSize;

    // Compute S_ν(α) = Σ ν(n) · e(2πinα)
    let re = 0, im = 0;
    for (let n = 1; n <= N; n++) {
      if (weights[n] === 0) continue;
      const theta = 2 * Math.PI * n * alpha;
      re += weights[n] * Math.cos(theta);
      im += weights[n] * Math.sin(theta);
    }
    const mag = Math.sqrt(re * re + im * im);

    if (isOnMajorArc(alpha, Q, N)) {
      sumMajor += mag;
      countMajor++;
    } else {
      if (mag > sup) sup = mag;
      sumMinor += mag;
      countMinor++;
    }
  }

  return {
    sup,
    avgMinor: countMinor > 0 ? sumMinor / countMinor : 0,
    avgMajor: countMajor > 0 ? sumMajor / countMajor : 0,
    minorFrac: countMinor / gridSize,
  };
}

/**
 * Compute the prime indicator baseline for comparison.
 */
export function primeBaseline(
  N: number,
  Q: number,
  gridSize: number
): { sup: number; avgMinor: number } {
  const primes = buildPrimeIndicator(N);
  const weights = new Float64Array(N + 1);
  for (let n = 2; n <= N; n++) {
    if (primes[n]) weights[n] = Math.log(n); // von Mangoldt weight for primes
  }
  const result = fourierAnalysis(weights, N, Q, gridSize);
  return { sup: result.sup, avgMinor: result.avgMinor };
}

/**
 * Full energy computation:
 *   E = sup_{minor} |S_ν(α)| / (N / log N)
 */
export function sieveEnergy(
  N: number,
  R: number,
  coeffs: number[],
  Q: number,
  gridSize: number
): number {
  const weights = computeSieveWeights(N, R, coeffs);
  const analysis = fourierAnalysis(weights, N, Q, gridSize);
  const normalizer = N / Math.log(N);
  return analysis.sup / normalizer;
}
