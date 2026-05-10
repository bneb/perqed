/**
 * src/search/vdw_witness.ts — Witness partition validation for VdW search.
 *
 * Protects against the growing-N race condition: when the main thread increments
 * N and sends new configs to workers, a worker may still be mid-run and post
 * back a stale-N partition labelled as the new N. We validate before emitting.
 */

import { computeAPEnergy } from "./ap_energy";

/**
 * Validate that a partition is a legitimate E=0 witness for the given parameters.
 *
 * Checks:
 *  1. witnessN is positive
 *  2. partition.length >= witnessN + 1  (has a 1-indexed slot for every element)
 *  3. Every partition[i] (1 ≤ i ≤ witnessN) is an integer in [0, K)
 *  4. computeAPEnergy is exactly 0
 *
 * Returns true iff all checks pass.
 */
export function validateWitnessPartition(
  partition: Int8Array,
  witnessN: number,
  K: number,
  AP_K: number,
): boolean {
  if (witnessN <= 0) return false;

  // Length check: 1-indexed partition needs indices 1..witnessN
  if (partition.length < witnessN + 1) return false;

  // Color range check: every element must be a valid color index
  for (let i = 1; i <= witnessN; i++) {
    const c = partition[i];
    if (c === undefined || c === null || c < 0 || c >= K) return false;
  }

  // Energy check: must actually be E=0
  const energy = computeAPEnergy(partition, witnessN, AP_K);
  if (energy !== 0) return false;

  return true;
}
