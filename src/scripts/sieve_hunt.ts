/**
 * sieve_hunt.ts — SA search for optimal sieve majorant.
 *
 * Two-phase search:
 *   Phase 1: Quick filter at small N (N=500), many restarts → bank top candidates
 *   Phase 2: Deep dive on top candidates at larger N (N=2000) → verify scaling
 *
 * Usage: bun run src/scripts/sieve_hunt.ts [N] [restarts] [iters]
 */
import { SieveState, type SieveParams } from "../math/sieve_state.ts";
import { primeBaseline } from "../math/sieve_energy.ts";

// Simple SA engine (inline for this specific continuous optimization)
function runSA(
  initial: SieveState,
  maxIters: number,
  initialTemp: number,
  coolingRate: number
): { best: SieveState; bestEnergy: number; history: number[] } {
  let current = initial;
  let currentEnergy = current.getEnergy();
  let best = current;
  let bestEnergy = currentEnergy;
  let temp = initialTemp;
  const history: number[] = [];

  for (let i = 0; i < maxIters; i++) {
    const candidate = current.mutate();
    if (!candidate) continue;

    const candidateEnergy = candidate.getEnergy();
    const delta = candidateEnergy - currentEnergy;

    if (delta < 0 || Math.random() < Math.exp(-delta / temp)) {
      current = candidate;
      currentEnergy = candidateEnergy;
    }

    if (currentEnergy < bestEnergy) {
      best = current;
      bestEnergy = currentEnergy;
    }

    temp *= coolingRate;

    if (i % 10000 === 0) {
      history.push(bestEnergy);
    }
  }

  return { best, bestEnergy, history };
}

async function main() {
  const args = process.argv.slice(2);
  const baseN = parseInt(args[0] || "500");
  const restarts = parseInt(args[1] || "20");
  const itersPerRestart = parseInt(args[2] || "50000");

  const Q_FACTOR = 0.1; // Q = Q_FACTOR * sqrt(N)
  const GRID = 2000;

  console.log("═══════════════════════════════════════════════════");
  console.log("  Sieve Majorant SA Search — Minor Arc Optimizer");
  console.log("═══════════════════════════════════════════════════");

  // Phase 0: Compute baselines
  console.log(`\n[Phase 0] Computing baselines at N=${baseN}...`);
  const Q = Math.max(2, Math.floor(Q_FACTOR * Math.sqrt(baseN)));
  const baseline = primeBaseline(baseN, Q, GRID);
  const baselineEnergy = baseline.sup / (baseN / Math.log(baseN));
  console.log(`  Prime indicator sup (minor arcs): ${baseline.sup.toFixed(2)}`);
  console.log(`  Baseline energy: ${baselineEnergy.toFixed(5)}`);

  // Also compute Selberg default
  const selberg = SieveState.selbergDefault(baseN, Q, GRID);
  const selbergEnergy = selberg.getEnergy();
  console.log(`  Selberg default energy: ${selbergEnergy.toFixed(5)}`);

  // Phase 1: Quick filter — many restarts
  console.log(`\n[Phase 1] Quick filter: N=${baseN}, ${restarts} restarts × ${itersPerRestart} iters`);

  interface Candidate {
    params: SieveParams;
    energy: number;
  }

  const candidates: Candidate[] = [];

  for (let r = 0; r < restarts; r++) {
    // Alternate between Selberg default and random starts
    const initial = r % 3 === 0
      ? SieveState.selbergDefault(baseN, Q, GRID)
      : SieveState.random(baseN, Q, GRID);

    const result = runSA(initial, itersPerRestart, 2.0, 0.99995);

    candidates.push({
      params: result.best.getPayload(),
      energy: result.bestEnergy,
    });

    const marker = result.bestEnergy < baselineEnergy ? " ★ BEATS BASELINE" : "";
    console.log(`  Restart ${r + 1}/${restarts}: E=${result.bestEnergy.toFixed(5)}${marker}`);
  }

  // Sort and keep top 10
  candidates.sort((a, b) => a.energy - b.energy);
  const top = candidates.slice(0, 10);

  console.log(`\n[Phase 1 Results] Top 10 candidates:`);
  console.log(`  Baseline energy: ${baselineEnergy.toFixed(5)}`);
  for (let i = 0; i < top.length; i++) {
    const c = top[i];
    const ratio = c.energy / baselineEnergy;
    const marker = ratio < 1.0 ? " ★" : "";
    console.log(`  #${i + 1}: E=${c.energy.toFixed(5)} (${(ratio * 100).toFixed(1)}% of baseline)${marker}`);
  }

  // Phase 2: Deep dive on top candidates at larger N
  const deepN = baseN * 4;
  const deepQ = Math.max(2, Math.floor(Q_FACTOR * Math.sqrt(deepN)));
  console.log(`\n[Phase 2] Deep dive: re-evaluate top 5 at N=${deepN}`);

  const deepBaseline = primeBaseline(deepN, deepQ, GRID);
  const deepBaseEnergy = deepBaseline.sup / (deepN / Math.log(deepN));
  console.log(`  Baseline at N=${deepN}: ${deepBaseEnergy.toFixed(5)}`);

  for (let i = 0; i < Math.min(5, top.length); i++) {
    const c = top[i];
    const deepState = new SieveState(c.params, deepN, deepQ, GRID);

    // Also run more SA from this point
    const refined = runSA(deepState, itersPerRestart * 2, 1.0, 0.99998);
    const ratio = refined.bestEnergy / deepBaseEnergy;
    const marker = ratio < 1.0 ? " ★ BEATS DEEP BASELINE" : "";
    console.log(`  Candidate #${i + 1}: E=${refined.bestEnergy.toFixed(5)} (${(ratio * 100).toFixed(1)}% of baseline)${marker}`);
    console.log(`    rFrac=${refined.best.getPayload().rFrac.toFixed(4)}, coeffs=[${refined.best.getPayload().coeffs.map(c => c.toFixed(3)).join(", ")}]`);
  }

  // Phase 3: Scaling check
  console.log(`\n[Phase 3] Scaling check — does the best candidate scale?`);
  const best = top[0];
  const testNs = [250, 500, 1000, 2000];
  console.log(`  Best candidate: rFrac=${best.params.rFrac.toFixed(4)}`);
  console.log(`  ${"N".padStart(6)} | ${"E_sieve".padStart(10)} | ${"E_prime".padStart(10)} | ${"ratio".padStart(8)}`);

  for (const testN of testNs) {
    const testQ = Math.max(2, Math.floor(Q_FACTOR * Math.sqrt(testN)));
    const sieveState = new SieveState(best.params, testN, testQ, GRID);
    const sieveE = sieveState.getEnergy();
    const primeB = primeBaseline(testN, testQ, GRID);
    const primeE = primeB.sup / (testN / Math.log(testN));
    const ratio = sieveE / primeE;
    const marker = ratio < 1.0 ? " ★" : "";
    console.log(`  ${String(testN).padStart(6)} | ${sieveE.toFixed(5).padStart(10)} | ${primeE.toFixed(5).padStart(10)} | ${ratio.toFixed(4).padStart(8)}${marker}`);
  }

  // Save best
  const output = {
    bestParams: best.params,
    bestEnergy: best.energy,
    baselineEnergy,
    searchConfig: { baseN, restarts, itersPerRestart },
  };
  const outPath = `data/sieve_majorant_best.json`;
  await Bun.write(outPath, JSON.stringify(output, null, 2));
  console.log(`\nBest candidate saved to ${outPath}`);
}

main().catch(console.error);
