/**
 * src/search/vdw_orchestrator.ts — Pure decision functions for the VdW island orchestrator.
 *
 * Extracted from vdw_solver.ts to make the orchestration logic independently testable.
 * Every function here is a pure predicate with no side effects.
 *
 * Bugs caught by tests:
 *   Bug 1 (shouldRunZ3): Z3 was firing at bestE=0 → UNSAT → 40% restart storm
 *   Bug 2 (shouldRestartIsland): restarts fired when globalBestEnergy=0 (witness in hand)
 *   Bug 3 (shouldRestartIsland): island was restarting itself (islandEnergy === globalBestEnergy)
 *   Bug 4 (computePartitionHash): Z3 was firing repeatedly on unchanged partition
 */

/**
 * Returns true iff Z3 repair should be attempted this sync.
 *
 * Preconditions for Z3 to be useful:
 *  - bestE > 0: there are actual violations to fix (E=0 means witness already found)
 *  - bestE <= repairThreshold: within the range where min-hitting-set is tractable
 */
export function shouldRunZ3(bestE: number, repairThreshold: number): boolean {
  return bestE > 0 && repairThreshold > 0 && bestE <= repairThreshold;
}

/**
 * Returns true iff this island should be forcibly restarted.
 *
 * An island should NOT be restarted when:
 *  - globalBestEnergy === 0: a witness is already in hand; don't disturb the search
 *  - islandEnergy <= globalBestEnergy: this island IS the global best (or co-best); protect it
 *  - stagnantSyncs < stagnationLimit: island hasn't been stuck long enough yet
 *
 * @param stagnantSyncs    how many syncs this island has gone without improvement
 * @param islandEnergy     this island's current energy
 * @param globalBestEnergy the minimum energy across all islands
 * @param stagnationLimit  threshold to trigger restart
 */
export function shouldRestartIsland(
  stagnantSyncs: number,
  islandEnergy: number,
  globalBestEnergy: number,
  stagnationLimit: number,
): boolean {
  if (globalBestEnergy === 0) return false;           // witness found — don't disturb
  if (islandEnergy <= globalBestEnergy) return false; // this island is the leader (or co-leader)
  return stagnantSyncs >= stagnationLimit;
}

/**
 * Compute a cheap integer fingerprint of a partition for deduplication.
 *
 * Used to skip redundant Z3 calls when the best partition hasn't changed.
 * Not a cryptographic hash — collisions are acceptable (they just cause one
 * extra Z3 call), but different partition values at different positions should
 * produce different hashes in practice.
 *
 * Returns -1 for empty partitions (sentinel: "never seen").
 */
export function computePartitionHash(partition: Int8Array): number {
  if (partition.length === 0) return -1;
  // Position-weighted sum: v[i] * (i+1) ensures [1,0] ≠ [0,1]
  let h = 0;
  for (let i = 0; i < partition.length; i++) {
    h += (partition[i]! * (i + 1)) | 0;
  }
  return h;
}
