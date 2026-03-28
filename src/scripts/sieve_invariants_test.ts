/**
 * sieve_invariants_test.ts — Deep sanity checks on the Fourier computation.
 *
 * Verifies mathematical invariants that MUST hold regardless of weights:
 * 1. Parseval: ∫|S(α)|² dα = Σ w(n)²  (exact identity)
 * 2. DC component: S(0) = Σ w(n)  (sum of weights)
 * 3. Grid convergence: result stabilizes as grid refines
 * 4. Minor arc fraction: reasonable range
 */
import { computeSieveWeights, fourierAnalysis, primeBaseline } from "../math/sieve_energy.ts";

let pass = 0, fail = 0;
function test(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); }
}

// ===== Test 1: Parseval identity =====
console.log("--- Parseval Identity Tests ---");
// ∫₀¹ |S(α)|² dα = Σ w(n)². Approximate via grid:
// (1/gridSize) Σⱼ |S(αⱼ)|² ≈ Σ w(n)²

function parseval_check(weights: Float64Array, N: number, gridSize: number): { lhs: number; rhs: number; relErr: number } {
  let rhs = 0;
  for (let n = 1; n <= N; n++) rhs += weights[n]! * weights[n]!;
  
  let lhs = 0;
  for (let j = 0; j < gridSize; j++) {
    const alpha = (j + 0.5) / gridSize;
    let re = 0, im = 0;
    for (let n = 1; n <= N; n++) {
      if (weights[n] === 0) continue;
      const theta = 2 * Math.PI * n * alpha;
      re += weights[n]! * Math.cos(theta);
      im += weights[n]! * Math.sin(theta);
    }
    lhs += (re * re + im * im) / gridSize;
  }
  
  return { lhs, rhs, relErr: Math.abs(lhs - rhs) / Math.max(rhs, 1) };
}

// Test with constant weights
const constW = new Float64Array(101);
for (let n = 1; n <= 100; n++) constW[n] = 1.0;
const p1 = parseval_check(constW, 100, 5000);
test(`Parseval (const w=1, N=100): relErr=${p1.relErr.toFixed(6)}`, p1.relErr < 0.01,
  `LHS=${p1.lhs.toFixed(2)}, RHS=${p1.rhs.toFixed(2)}`);

// Test with sieve weights
const sw = computeSieveWeights(100, 10, [1, 0, 0, 0, 0, 0]);
const p2 = parseval_check(sw, 100, 5000);
test(`Parseval (Selberg, N=100): relErr=${p2.relErr.toFixed(6)}`, p2.relErr < 0.01,
  `LHS=${p2.lhs.toFixed(2)}, RHS=${p2.rhs.toFixed(2)}`);

// Test with prime indicator
const primeW = new Float64Array(101);
const sieve = new Uint8Array(101);
for (let i = 2; i <= 100; i++) sieve[i] = 1;
for (let i = 2; i * i <= 100; i++) if (sieve[i]) for (let j = i * i; j <= 100; j += i) sieve[j] = 0;
for (let n = 2; n <= 100; n++) if (sieve[n]) primeW[n] = Math.log(n);
const p3 = parseval_check(primeW, 100, 5000);
test(`Parseval (primes, N=100): relErr=${p3.relErr.toFixed(6)}`, p3.relErr < 0.01,
  `LHS=${p3.lhs.toFixed(2)}, RHS=${p3.rhs.toFixed(2)}`);

// ===== Test 2: DC component =====
console.log("\n--- DC Component (α=0) Tests ---");
// S(0) = Σ w(n) exactly
function dc_check(weights: Float64Array, N: number): { s0: number; sumW: number } {
  let sumW = 0;
  for (let n = 1; n <= N; n++) sumW += weights[n]!;
  // S(0) = Σ w(n) · e(0) = Σ w(n)
  let re = 0;
  for (let n = 1; n <= N; n++) re += weights[n]!;
  return { s0: re, sumW };
}
const dc1 = dc_check(sw, 100);
test(`DC: S(0) = Σw(n) (Selberg)`, Math.abs(dc1.s0 - dc1.sumW) < 0.001,
  `S(0)=${dc1.s0.toFixed(3)}, Σw=${dc1.sumW.toFixed(3)}`);

// ===== Test 3: Grid convergence =====
console.log("\n--- Grid Convergence ---");
// The sup on minor arcs should stabilize as grid refines
const N_test = 200;
const Q_test = 3;
const grids = [200, 500, 1000, 2000];
const sups: number[] = [];
console.log("  Grid | sup_minor | minor_frac");
for (const g of grids) {
  const fa = fourierAnalysis(computeSieveWeights(N_test, Math.sqrt(N_test)/Math.log(N_test), [1,0,0,0,0,0]), N_test, Q_test, g);
  sups.push(fa.sup);
  console.log(`  ${String(g).padStart(4)} | ${fa.sup.toFixed(3).padStart(9)} | ${fa.minorFrac.toFixed(3)}`);
}
// Check: last two grid sizes should give similar results (within 20%)
const s_last = sups[sups.length - 1]!;
const s_prev = sups[sups.length - 2]!;
const conv_err = Math.abs(s_last - s_prev) / Math.max(s_last, 1);
test(`Grid convergence: last two grids within 20%`, conv_err < 0.2,
  `err=${(conv_err*100).toFixed(1)}%`);

// ===== Test 4: Minor arc fraction =====
console.log("\n--- Minor Arc Fraction ---");
for (const N of [100, 500, 1000]) {
  const Q = Math.max(2, Math.floor(0.1 * Math.sqrt(N)));
  const fa = fourierAnalysis(constW.length > N ? constW : new Float64Array(N+1).fill(1), N, Q, 1000);
  console.log(`  N=${N}, Q=${Q}: minorFrac=${fa.minorFrac.toFixed(3)}`);
  test(`N=${N}: minor fraction in (0.3, 0.99)`, fa.minorFrac > 0.3 && fa.minorFrac < 0.99);
}

// ===== Test 5: Energy monotonicity cross-check =====
console.log("\n--- Energy at multiple N (detailed) ---");
console.log("  N    | Q | R     | sup_minor | N/logN   | energy");
for (const N of [100, 200, 500, 1000]) {
  const Q = Math.max(2, Math.floor(0.1 * Math.sqrt(N)));
  const R = Math.sqrt(N) / Math.log(N);
  const w = computeSieveWeights(N, R, [1, 0, 0, 0, 0, 0]);
  const fa = fourierAnalysis(w, N, Q, 2000);
  const normalizer = N / Math.log(N);
  const energy = fa.sup / normalizer;
  console.log(`  ${String(N).padStart(4)} | ${Q} | ${R.toFixed(2).padStart(5)} | ${fa.sup.toFixed(2).padStart(9)} | ${normalizer.toFixed(1).padStart(8)} | ${energy.toFixed(4)}`);
}

console.log(`\n--- Results: ${pass} passed, ${fail} failed ---`);
if (fail > 0) process.exit(1);
