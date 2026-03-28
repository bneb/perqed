/**
 * sieve_scaling_test.ts — Quick test: does sieve energy decrease with N?
 *
 * This is the GO/NO-GO test for the sieve transference approach.
 * If E(N) → 0: the approach works. If E(N) → const: same wall.
 */
import { sieveEnergy, primeBaseline } from "../math/sieve_energy.ts";

const GRID = 500; // Small grid for speed

console.log("═══════════════════════════════════════");
console.log("  Sieve Energy Scaling Test — GO/NO-GO");
console.log("═══════════════════════════════════════\n");

console.log("  N    | E_sieve  | E_prime  | ratio  | E_sieve trend");
console.log("-------+----------+----------+--------+--------------");

const testNs = [100, 200, 300, 500, 750, 1000];
const energies: number[] = [];

for (const N of testNs) {
  const Q = Math.max(2, Math.floor(0.1 * Math.sqrt(N)));
  const R = Math.sqrt(N) / Math.log(N);
  
  // Selberg default: P(t) = 1 - t
  const eSelberg = sieveEnergy(N, R, [1, 0, 0, 0, 0, 0], Q, GRID);
  const pb = primeBaseline(N, Q, GRID);
  const ePrime = pb.sup / (N / Math.log(N));
  const ratio = eSelberg / ePrime;
  
  energies.push(eSelberg);
  const trend = energies.length >= 2
    ? (eSelberg < energies[energies.length - 2] ? "↓ DECREASING" : "↑ INCREASING")
    : "—";
  
  console.log(`  ${String(N).padStart(4)} | ${eSelberg.toFixed(4).padStart(8)} | ${ePrime.toFixed(4).padStart(8)} | ${ratio.toFixed(3).padStart(6)} | ${trend}`);
}

const first = energies[0]!;
const last = energies[energies.length - 1]!;
const overallTrend = last < first * 0.8 ? "DECREASING ✓" : last > first * 1.2 ? "INCREASING ✗" : "FLAT ≈";

console.log(`\n  Overall: E went from ${first.toFixed(4)} to ${last.toFixed(4)} → ${overallTrend}`);
if (last < first * 0.8) {
  console.log("  ★ GO — Sieve energy decreases with N. Worth pursuing.");
} else {
  console.log("  ✗ NO-GO — Sieve energy does not decrease. Same wall in disguise.");
}
