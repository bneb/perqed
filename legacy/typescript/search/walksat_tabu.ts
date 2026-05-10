/**
 * walksat_tabu.ts — WalkSAT + Tabu hybrid SA for VdW search.
 *
 * Standard Metropolis SA is inefficient at low energy (E < threshold):
 * 99.9% of random flips touch elements not in any violated AP.
 *
 * This module implements a hybrid:
 *   Phase 1 (E > walksatThreshold): pure Metropolis (fast energy descent)
 *   Phase 2 (E ≤ walksatThreshold): WalkSAT mode — directly targets violated APs
 *
 * WalkSAT step:
 *   1. Pick a random violated AP
 *   2. For each element in that AP, evaluate all K-1 color changes
 *   3. Apply best non-tabu flip (or best tabu if aspiration criterion met)
 *   4. Add flipped (pos, old_color) to tabu list for TABU_TENURE steps
 *
 * Every METRO_PROB fraction of steps uses pure Metropolis even in WalkSAT phase,
 * to prevent cycling and allow uphill exploration.
 */

import { computeAPEnergy, computeAPDelta, findViolatingAPs } from "./ap_energy";

export interface WalkSATOpts {
  T0?: number;                   // initial temperature (default 8.0)
  alpha?: number;                // cooling rate (default 0.9999994)
  walksatThreshold?: number;     // switch to WalkSAT when E ≤ this (default 60)
  pMetropolis?: number;          // fraction of WalkSAT-phase steps that use Metropolis (default 0.3)
  tabuTenure?: number;           // steps a (pos, color) pair stays tabu (default 15)
  aspirationDelta?: number;      // override tabu if delta ≤ this (default -3)
  rebuildInterval?: number;      // rebuild violated AP list every N steps (default 500)
}

/**
 * Run WalkSAT + Tabu hybrid SA.
 * Returns the best partition found and its energy.
 */
export function runWalkSATTabu(
  initial: Int8Array,
  N: number,
  K: number,
  AP_K: number,
  iters: number,
  opts: WalkSATOpts = {},
): { partition: Int8Array; energy: number } {
  const {
    T0 = 8.0,
    alpha = 0.9999994,
    walksatThreshold = 60,
    pMetropolis = 0.3,
    tabuTenure = 15,
    aspirationDelta = -3,
    rebuildInterval = 500,
  } = opts;

  const p = new Int8Array(initial);
  let E = computeAPEnergy(p, N, AP_K);
  let T = T0;

  // Best seen
  let bestP = new Int8Array(p);
  let bestE = E;

  // Tabu list: tabu[pos] = { color: forbidden_color, expires: step_number }
  const tabuExpiry = new Int32Array(N + 1).fill(-1);   // step when tabu expires
  const tabuColor  = new Int8Array(N + 1).fill(-1);    // which color is tabu

  // Violated AP cache (rebuilt every rebuildInterval WalkSAT steps)
  let violatedAPs: number[][] = [];
  let walksatStepsSinceRebuild = 0;

  for (let iter = 0; iter < iters && E > 0; iter++) {
    if (E > walksatThreshold || Math.random() < pMetropolis) {
      // ── Pure Metropolis step ────────────────────────────────────────────────
      const pos = 1 + ((Math.random() * N) | 0);
      const old_c = p[pos]!;
      const new_c = (Math.random() * K) | 0;
      if (old_c !== new_c) {
        const dE = computeAPDelta(p, N, AP_K, pos, old_c, new_c);
        if (dE <= 0 || Math.random() < Math.exp(-dE / T)) {
          p[pos] = new_c;
          E += dE;
          if (E < bestE) { bestE = E; bestP = new Int8Array(p); }
        }
      }
    } else {
      // ── WalkSAT step ────────────────────────────────────────────────────────
      // Rebuild violated AP list periodically
      if (walksatStepsSinceRebuild === 0 || walksatStepsSinceRebuild >= rebuildInterval) {
        violatedAPs = findViolatingAPs(p, N, AP_K);
        walksatStepsSinceRebuild = 0;
      }
      walksatStepsSinceRebuild++;

      if (violatedAPs.length === 0) {
        // E should be 0 — safety check
        E = computeAPEnergy(p, N, AP_K);
        if (E === 0) break;
        violatedAPs = findViolatingAPs(p, N, AP_K);
        if (violatedAPs.length === 0) break;
      }

      // Pick a random violated AP
      const ap = violatedAPs[((Math.random() * violatedAPs.length) | 0)]!;

      // Find best non-tabu flip across all elements × colors in this AP
      let bestDelta = Infinity;
      let bestPos = -1;
      let bestNewColor = -1;
      let bestTabuDelta = Infinity; // best tabu flip (for aspiration)
      let bestTabuPos = -1;
      let bestTabuColor = -1;

      for (const pos of ap) {
        const old_c = p[pos]!;
        for (let c = 0; c < K; c++) {
          if (c === old_c) continue;
          const dE = computeAPDelta(p, N, AP_K, pos, old_c, c);
          const isTabu = tabuExpiry[pos]! > iter && tabuColor[pos] === c;
          if (isTabu) {
            if (dE < bestTabuDelta) { bestTabuDelta = dE; bestTabuPos = pos; bestTabuColor = c; }
          } else {
            if (dE < bestDelta) { bestDelta = dE; bestPos = pos; bestNewColor = c; }
          }
        }
      }

      // Aspiration: use tabu flip if it beats total best energy
      let chosenPos = bestPos, chosenColor = bestNewColor, chosenDelta = bestDelta;
      if (bestTabuPos !== -1 && bestTabuDelta <= aspirationDelta) {
        chosenPos = bestTabuPos; chosenColor = bestTabuColor; chosenDelta = bestTabuDelta;
      }

      if (chosenPos !== -1 && chosenColor !== -1) {
        const old_c = p[chosenPos]!;
        // Accept if improving, or with Metropolis probability if not
        if (chosenDelta <= 0 || Math.random() < Math.exp(-chosenDelta / T)) {
          // Update tabu: forbid returning to old_c at this pos
          tabuExpiry[chosenPos] = iter + tabuTenure;
          tabuColor[chosenPos] = old_c;
          p[chosenPos] = chosenColor;
          E += chosenDelta;
          if (E < bestE) { bestE = E; bestP = new Int8Array(p); }
          // Mark violated AP cache as dirty
          walksatStepsSinceRebuild = rebuildInterval; // force rebuild next step
        }
      }
    }

    T *= alpha;
  }

  // Final exact energy check
  const finalE = computeAPEnergy(bestP, N, AP_K);
  return { partition: bestP, energy: finalE };
}
