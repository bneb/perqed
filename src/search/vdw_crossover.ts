/**
 * vdw_crossover.ts — AP-boundary crossover and conflict resolution utilities.
 *
 * AP-boundary crossover:
 *   For each element i, assign the color from whichever parent contributes
 *   fewer local AP violations through i. This preferentially propagates
 *   "correct" assignments from each parent.
 *
 * Minimum Hitting Set (greedy approximation):
 *   Given a list of violated APs, find a small set of elements such that
 *   every violated AP contains at least one element from the set.
 *   Used to focus Z3 repair on the minimal set of elements to re-color.
 *   Greedy ln(n)-approximation: pick element in most APs, remove covered APs, repeat.
 */

import { computeAPDelta } from "./ap_energy";

// ── Local violation count ─────────────────────────────────────────────────────

/**
 * Count how many violated APs pass through element i in the current partition.
 * O(N) per element.
 */
export function localAPViolations(
  partition: Int8Array,
  i: number,
  N: number,
  AP_K: number,
): number {
  const c = partition[i]!;
  let count = 0;

  for (let pos = 0; pos < AP_K; pos++) {
    const slotsAfter = AP_K - 1 - pos;
    const slotsBefore = pos;
    let max_d: number;
    if (slotsAfter === 0) {
      max_d = slotsBefore > 0 ? Math.floor((i - 1) / slotsBefore) : N;
    } else {
      max_d = Math.floor((N - i) / slotsAfter);
      if (slotsBefore > 0) max_d = Math.min(max_d, Math.floor((i - 1) / slotsBefore));
    }
    for (let d = 1; d <= max_d; d++) {
      const x = i - pos * d;
      let allSame = true;
      for (let step = 0; step < AP_K; step++) {
        if (partition[x + step * d] !== c) { allSame = false; break; }
      }
      if (allSame) count++;
    }
  }
  return count;
}

// ── AP-boundary crossover ─────────────────────────────────────────────────────

/**
 * For each position i, choose the color from whichever parent has
 * fewer local AP violations through i. Ties go to parent A.
 *
 * The result inherits the "best" assignment from each parent at each position,
 * exploiting the fact that two independently-stuck colorings have different
 * violation patterns.
 */
export function crossover(
  a: Int8Array,
  b: Int8Array,
  N: number,
  AP_K: number,
): Int8Array {
  const child = new Int8Array(N + 1);
  for (let i = 1; i <= N; i++) {
    const localA = localAPViolations(a, i, N, AP_K);
    const localB = localAPViolations(b, i, N, AP_K);
    child[i] = localA <= localB ? a[i]! : b[i]!;
  }
  return child;
}

// ── Minimum hitting set (greedy ln-approximation) ─────────────────────────────

/**
 * Given a list of violated APs (each an array of element indices), find a
 * small set of elements that "hits" (intersects) every AP.
 *
 * Used to minimize the Z3 repair window: instead of passing all violated-AP
 * elements to Z3, pass only the hitting set (typically 5-20 elements vs 100+).
 *
 * Algorithm: greedy frequency sort — O(|APs| × |AP length| × |hitting set|)
 */
export function minHittingSet(violatedAPs: number[][]): number[] {
  if (violatedAPs.length === 0) return [];

  // Working copy of APs as mutable sets
  const remaining: Set<number>[] = violatedAPs.map(ap => new Set(ap));
  const hitSet: number[] = [];

  while (remaining.some(s => s.size > 0)) {
    // Count element frequencies across remaining (uncovered) APs
    const freq = new Map<number, number>();
    for (const ap of remaining) {
      for (const elem of ap) {
        freq.set(elem, (freq.get(elem) ?? 0) + 1);
      }
    }
    if (freq.size === 0) break;

    // Pick element with highest frequency
    let best = -1, bestCount = 0;
    for (const [elem, count] of freq) {
      if (count > bestCount) { bestCount = count; best = elem; }
    }
    if (best === -1) break;

    hitSet.push(best);

    // Remove APs covered by this element (i.e., APs that contain `best`)
    for (const ap of remaining) ap.delete(best);
    // Filter out fully covered APs (they are now size 0 from our perspective
    // — we mark them by removing all their elements)
    for (let idx = 0; idx < remaining.length; idx++) {
      // The AP is "hit" if its original set contained `best`
      // Since we deleted `best` from the set, any set that had `best` is now
      // "covered" — mark it empty
    }
    // Rebuild: only keep APs that still have uncovered elements AND were not hit
    // Actually: we already deleted `best` from every set. Covered sets are those
    // that originally contained `best`. We need to fully empty them now.
    // Simplest: track which APs contained `best` before deletion.
    // Let's just clear APs where deletion of `best` was meaningful.
    // Since we can't tell post-hoc, let's rebuild:
    for (let idx = 0; idx < violatedAPs.length; idx++) {
      if (violatedAPs[idx]!.includes(best)) {
        remaining[idx]!.clear(); // This AP is now hit
      }
    }
  }

  return hitSet;
}
