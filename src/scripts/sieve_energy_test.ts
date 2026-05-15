/**
 * sieve_energy_test.ts — Unit tests for sieve energy computation.
 *
 * Run: bun run src/scripts/sieve_energy_test.ts
 */
import {
  computeSieveWeights,
  fourierAnalysis,
  primeBaseline,
  sieveEnergy,
} from "../math/sieve_energy.ts";

let pass = 0, fail = 0;
function test(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
}
function approx(a: number, b: number, tol: number = 0.01): boolean {
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
}

// ===== Test 1: Sieve weights basic properties =====
console.log("--- Sieve weight tests ---");

// With P(t) = 1 - t (linear Selberg), R = 10, N = 100
const w1 = computeSieveWeights(100, 10, [1, 0, 0, 0, 0, 0]);
test("ν(1) > 0 (1 always has the trivial divisor)", w1[1]! > 0);
test("ν(n) ≥ 0 for all n (squared weights)", w1.every(v => v >= 0));

// ν(1) should be P(0)² = 1² = 1 (only d=1 divides 1, λ_1 = μ(1)·P(0) = 1·1 = 1)
test("ν(1) = 1 (λ_1 = μ(1)·P(0) = 1)", approx(w1[1]!, 1.0, 0.001));

// For a prime p < R, λ_p = μ(p)·P(log(p)/log(R)) = -P(log(p)/log(R))
// ν(p) = (λ_1 + λ_p)² = (1 - P(log(p)/log(R)))²
// With P(t) = 1-t: P(log(p)/log(R)) = 1 - log(p)/log(R)
// So ν(p) = (1 - (1 - log(p)/log(R)))² = (log(p)/log(R))²
const p = 7; // prime < R=10
const expected_nu_7 = Math.pow(Math.log(7) / Math.log(10), 2);
test(`ν(7) ≈ (log7/log10)² = ${expected_nu_7.toFixed(4)}`, approx(w1[7]!, expected_nu_7, 0.01));

// For n with a squared prime factor p² | n where p < R, μ(p²)=0, so λ_{p²}=0
// But d=1 and d=p still contribute
// ν(4) = (λ_1 + λ_2)² since 4's divisors ≤ 10 with μ≠0 are 1, 2
const expected_nu_4 = Math.pow(Math.log(2) / Math.log(10), 2);
test(`ν(4) = (log2/log10)² (only d=1,2 contribute)`, approx(w1[4]!, expected_nu_4, 0.01));

// ν(n) = 0 for n that has no divisors ≤ R with μ ≠ 0... actually all n ≥ 1 have d=1
// So ν(n) ≥ λ_1² = 1 for all n... wait, that can't be right for the sieve
// Actually λ_1 = μ(1) · P(log(1)/log(R)) = 1 · P(0) = 1
// And other λ_d contribute too, potentially making the sum smaller
// For a prime p > R: only d=1 divides it with d ≤ R, so ν(p) = λ_1² = 1
const bigPrime = 97; // > R=10
test(`ν(97) = 1 (prime > R, only d=1)`, approx(w1[bigPrime]!, 1.0, 0.001));

// Actually this shows ν majorizes a constant — it should majorize the prime indicator!
// ν(2) should be (λ_1 + λ_2)² where λ_2 = μ(2)·P(log2/log10) = -(1-log2/log10)
const lambda_1 = 1.0;
const lambda_2_val = -(1 - Math.log(2) / Math.log(10));
const expected_nu_2 = Math.pow(lambda_1 + lambda_2_val, 2);
test(`ν(2) = (1 + λ_2)² = ${expected_nu_2.toFixed(4)}`, approx(w1[2]!, expected_nu_2, 0.01));

// ===== Test 2: Fourier transform properties =====
console.log("\n--- Fourier transform tests ---");

// Test with a simple weight: ν(n) = 1 for all n
// S_ν(α) = Σ e(nα) = geometric sum → |S_ν(0)| = N, |S_ν(1/2)| ≈ 0 (oscillates)
const ones = new Float64Array(101);
for (let n = 1; n <= 100; n++) ones[n] = 1.0;
const f1 = fourierAnalysis(ones, 100, 5, 1000);
test("Flat weights: minor fraction < 1 (some arcs are major)", f1.minorFrac < 1.0);
test("Flat weights: minor fraction > 0 (some arcs are minor)", f1.minorFrac > 0.0);
test("Flat weights: sup > 0 (non-zero Fourier transform)", f1.sup > 0);
console.log(`  minorFrac = ${f1.minorFrac.toFixed(3)}, sup = ${f1.sup.toFixed(2)}, avgMajor = ${f1.avgMajor.toFixed(2)}`);

// Test: Dirac at n=1 → S(α) = e(α) → |S| = 1 everywhere
const dirac = new Float64Array(101);
dirac[1] = 1.0;
const f2 = fourierAnalysis(dirac, 100, 5, 1000);
test("Dirac: sup ≈ 1 (|e(α)| = 1)", approx(f2.sup, 1.0, 0.05));

// ===== Test 3: Prime baseline =====
console.log("\n--- Prime baseline tests ---");
const pb = primeBaseline(100, 5, 1000);
test("Prime baseline sup > 0 at N=100", pb.sup > 0);
test("Prime baseline avgMinor > 0", pb.avgMinor > 0);
console.log(`  Prime sup (minor arcs) = ${pb.sup.toFixed(2)}, avgMinor = ${pb.avgMinor.toFixed(2)}`);

// Larger N should have larger sup
const pb2 = primeBaseline(500, 5, 1000);
test("Larger N has larger prime sup", pb2.sup > pb.sup);
console.log(`  Prime sup at N=500: ${pb2.sup.toFixed(2)} (vs ${pb.sup.toFixed(2)} at N=100)`);

// ===== Test 4: Energy function =====
console.log("\n--- Energy function tests ---");
const e1 = sieveEnergy(100, 10, [1, 0, 0, 0, 0, 0], 5, 1000);
test("Energy is non-negative", e1 >= 0);
test("Energy is finite", isFinite(e1));
console.log(`  Selberg energy at N=100: ${e1.toFixed(5)}`);

const e2 = sieveEnergy(500, 20, [1, 0, 0, 0, 0, 0], 5, 1000);
test("Energy at N=500 is finite", isFinite(e2));
console.log(`  Selberg energy at N=500: ${e2.toFixed(5)}`);

// ===== Test 5: Majorization check =====
console.log("\n--- Majorization tests ---");
// ν(n) should majorize something related to the prime indicator
// For Selberg sieve: ν(p) ≥ 0 for primes, and ν(n) ≥ 0 for all n
// The key property: Σ_{n≤N} ν(n) should be roughly N (the sieve has expected value ~1)
let sumWeights = 0;
for (let n = 1; n <= 100; n++) sumWeights += w1[n]!;
console.log(`  Σν(n) for n≤100 = ${sumWeights.toFixed(2)} (should be O(N) = ~100)`);
test("Sum of weights is O(N)", sumWeights > 10 && sumWeights < 1000);

// ===== Summary =====
console.log(`\n--- Results: ${pass} passed, ${fail} failed ---`);
if (fail > 0) process.exit(1);
