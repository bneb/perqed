/**
 * behrend_seed.ts — Algebraic initialization strategies for VdW SA.
 *
 * Four seeding strategies that produce low-energy starting points for
 * the W(r;k) search, replacing weak modular / random initialization.
 *
 *  1. seedBehrend      — digit-square residue (Behrend 1946, digit-based)
 *  2. seedVanDerCorput — base-K digit reversal (quasi-random, low discrepancy)
 *  3. seedSalemSpencer — greedy AP-free color classes (constructive)
 *  4. seedQuadraticResidue — Legendre symbol partitioning over F_p
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
}

function nextPrime(n: number): number {
  let p = n;
  while (!isPrime(p)) p++;
  return p;
}

// ── 1. Behrend digit-square seed ──────────────────────────────────────────────

/**
 * Behrend (1946) construction: represent i in base r, color by
 * (sum of squared digits) mod K.
 *
 * Elements with the same digit-square residue form a structured set
 * with low AP density — significantly better than modular arithmetic.
 *
 * Base: r = ceil(N^{1/K}) so that K digits suffice to represent all N.
 */
export function seedBehrend(N: number, K: number): Int8Array {
  const r = Math.max(2, Math.ceil(Math.pow(N, 1 / K)));
  const p = new Int8Array(N + 1);
  for (let i = 1; i <= N; i++) {
    let sumSq = 0, n = i;
    while (n > 0) {
      const d = n % r;
      sumSq += d * d;
      n = Math.floor(n / r);
    }
    p[i] = sumSq % K;
  }
  return p;
}

// ── 2. Van der Corput base-K digit-reversal seed ──────────────────────────────

/**
 * Reverse the base-K representation of i and reduce mod K.
 * Produces a low-discrepancy sequence with good distribution properties.
 * Deterministically generates diverse colorings for any base K.
 */
export function seedVanDerCorput(N: number, K: number): Int8Array {
  const p = new Int8Array(N + 1);
  for (let i = 1; i <= N; i++) {
    let n = i, reversed = 0, base = 1;
    while (n > 0) {
      const d = n % K;
      reversed = reversed * K + d;
      base *= K;
      n = Math.floor(n / K);
    }
    p[i] = reversed % K;
  }
  return p;
}

// ── 3. Greedy Salem-Spencer (AP-free per color class) ─────────────────────────

/**
 * Build K color classes greedily, each one a Salem-Spencer (AP-free) set.
 * For each i in {1..N}, assign to the first color class c such that
 * adding i to class c does not create a 3-AP within c.
 *
 * If no safe class exists, assign to color with fewest violations.
 */
export function seedSalemSpencer(N: number, K: number): Int8Array {
  const p = new Int8Array(N + 1);
  const classes: number[][] = Array.from({ length: K }, () => []);
  const classSets: Set<number>[] = Array.from({ length: K }, () => new Set());

  for (let i = 1; i <= N; i++) {
    let assigned = false;
    for (let c = 0; c < K; c++) {
      // Can we add i to class c without creating a 3-AP?
      let safe = true;
      const cls = classSets[c]!;
      for (const x of cls) {
        // Check if {x, i, 2i-x} is an AP: need 2i-x in cls and x < i
        if (x < i) {
          const third = 2 * i - x;
          if (cls.has(third)) { safe = false; break; }
        }
        // Check if {x, (x+i)/2, i} is an AP: need (x+i)/2 in cls
        const mid = x + i;
        if (mid % 2 === 0 && cls.has(mid / 2)) { safe = false; break; }
      }
      if (safe) {
        p[i] = c;
        classes[c]!.push(i);
        classSets[c]!.add(i);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      // Fallback: assign to smallest class (fewest elements)
      const smallest = classes.reduce((minC, cls, c) => cls.length < classes[minC]!.length ? c : minC, 0);
      p[i] = smallest;
      classes[smallest]!.push(i);
      classSets[smallest]!.add(i);
    }
  }
  return p;
}

// ── 4. Quadratic Residue seed ─────────────────────────────────────────────────

/**
 * Color using Legendre symbol and residue class structure over F_p.
 *
 * For prime p near N, each i maps to a "residue tier":
 *   tier 0: i ≡ 0 (mod p)
 *   tier 1: i mod p is a QR in the "low half" [1, (p-1)/4]
 *   tier 2: i mod p is a QR in the "high half" [(p+1)/4, (p-1)/2]
 *   tier 3: i mod p is a non-residue in the "low half"
 *   tier 4: i mod p is a non-residue in the "high half"
 *
 * For K ≠ 5, tiers are remapped as needed.
 */
export function seedQuadraticResidue(N: number, K: number, prime?: number): Int8Array {
  const p_val = prime ?? nextPrime(N + 1);
  const qr = new Set<number>();
  for (let x = 1; x < p_val; x++) qr.add((x * x) % p_val);

  const half = Math.floor((p_val - 1) / 4);
  const p = new Int8Array(N + 1);

  for (let i = 1; i <= N; i++) {
    const r = i % p_val;
    let tier: number;
    if (r === 0) {
      tier = 0;
    } else if (qr.has(r)) {
      tier = r <= half ? 1 : 2;
    } else {
      tier = r <= half ? 3 : 4;
    }
    p[i] = tier % K;
  }
  return p;
}

// ── allSeeds — returns all 4 strategies as an array ─────────────────────────

/**
 * Returns 4 diverse algebraic seeds in strategy order:
 * [Behrend, VanDerCorput, SalemSpencer, QuadraticResidue]
 */
export function allSeeds(N: number, K: number): Int8Array[] {
  return [
    seedBehrend(N, K),
    seedVanDerCorput(N, K),
    seedSalemSpencer(N, K),
    seedQuadraticResidue(N, K),
  ];
}
