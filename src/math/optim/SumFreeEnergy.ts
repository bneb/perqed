/**
 * SumFreeEnergy — Energy function for 1D set partition problems.
 *
 * Counts the number of (x, y, z) triples within the same color class
 * where x + y = z. Energy = 0 iff every class is sum-free.
 *
 * This is the TypeScript equivalent of the bitboard C++ optimization:
 *   For each color c:
 *     Let B_c = bitset of elements in class c
 *     For each x in P_c: E += popcount(B_c & (B_c >> x))
 *
 * We implement this in pure TypeScript using BigInt bitsets for correctness
 * and small-medium domain sizes. For very large domains (> 10,000),
 * a native C++ worker should be spawned instead.
 */

/**
 * Compute the sum-free energy of a partition.
 *
 * @param partition   1-indexed Int8Array (index 0 unused). partition[i] is the
 *                    color class of integer i, or -1 if unassigned.
 * @param domainSize  Maximum integer in the domain (e.g. 537 for S(6)).
 * @param numPartitions  Number of color classes.
 * @returns  Energy score — number of (x, y, z=x+y) violation triples.
 *           0 means every class is sum-free (a valid witness).
 */
export function computeSumFreeEnergy(
  partition: Int8Array,
  domainSize: number,
  numPartitions: number,
): number {
  if (domainSize <= 0) return 0;

  // Build one sorted array per color class (1-indexed elements only)
  const classes: number[][] = Array.from({ length: numPartitions }, () => []);

  for (let i = 1; i <= domainSize; i++) {
    const color = partition[i];
    if (color !== undefined && color >= 0 && color < numPartitions) {
      classes[color]!.push(i);
    }
  }

  let energy = 0;

  // For each color class, count (x, y) pairs where x + y is also in the class
  for (let c = 0; c < numPartitions; c++) {
    const members = classes[c]!;
    if (members.length < 2) continue;

    // Build a Set for O(1) membership lookup
    const memberSet = new Set(members);

    for (let xi = 0; xi < members.length; xi++) {
      const x = members[xi]!;
      for (let yi = xi; yi < members.length; yi++) {
        const y = members[yi]!;
        const z = x + y;
        if (z <= domainSize && memberSet.has(z)) {
          energy++;
        }
      }
    }
  }

  return energy;
}
