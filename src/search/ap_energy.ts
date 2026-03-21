/**
 * ap_energy.ts — Van der Waerden AP energy function.
 *
 * E = number of monochromatic k-term arithmetic progressions in a coloring.
 * E = 0 iff the coloring is AP-free in every color class.
 */

/**
 * Count monochromatic k-term APs in a partition.
 * O(N²/k) — use computeAPDelta for incremental updates in the SA hot loop.
 * @param partition  1-indexed Int8Array, values in [0, K)
 * @param N          Domain size (elements 1..N)
 * @param k          AP length (3 for VdW W(3;r))
 */
export function computeAPEnergy(
  partition: Int8Array,
  N: number,
  k: number,
): number {
  let E = 0;
  for (let a = 1; a <= N; a++) {
    const color = partition[a]!;
    for (let d = 1; a + (k - 1) * d <= N; d++) {
      let mono = true;
      for (let i = 1; i < k; i++) {
        if (partition[a + i * d] !== color) { mono = false; break; }
      }
      if (mono) E++;
    }
  }
  return E;
}

/** All monochromatic k-APs as arrays of element indices (1-indexed). */
export function findViolatingAPs(
  partition: Int8Array,
  N: number,
  k: number,
): number[][] {
  const aps: number[][] = [];
  for (let a = 1; a <= N; a++) {
    const color = partition[a]!;
    for (let d = 1; a + (k - 1) * d <= N; d++) {
      let mono = true;
      const ap: number[] = [a];
      for (let i = 1; i < k; i++) {
        const idx = a + i * d;
        if (partition[idx] !== color) { mono = false; break; }
        ap.push(idx);
      }
      if (mono) aps.push(ap);
    }
  }
  return aps;
}

/**
 * The set of elements that participate in at least one violating AP.
 * These are candidates for Z3 repair / mutation.
 */
export function repairCandidates(
  partition: Int8Array,
  N: number,
  k: number,
): Set<number> {
  const aps = findViolatingAPs(partition, N, k);
  const candidates = new Set<number>();
  for (const ap of aps) for (const idx of ap) candidates.add(idx);
  return candidates;
}

/**
 * Generate a Z3-Python script that searches for a repair of elements
 * in `repairSet` such that no monochromatic k-AP covers any of them.
 */
export function generateZ3APRepairScript(
  partition: Int8Array,
  N: number,
  K: number,
  repairSet: number[],
  k: number,
): string {
  const fixed = Array.from({ length: N + 1 }, (_, i) => i).filter(
    i => i >= 1 && !repairSet.includes(i)
  );

  const lines: string[] = [
    "from z3 import *",
    `N = ${N}; K = ${K}; k = ${k}`,
    `c = [Int(f'c_{i}') for i in range(N + 1)]`,
    "s = Solver()",
    "# Domain constraints",
    ...Array.from({ length: N }, (_, i) => i + 1).map(
      i => `s.add(And(c[${i}] >= 0, c[${i}] < K))`
    ),
    "# Fix non-repair elements",
    ...fixed.map(i => `s.add(c[${i}] == ${partition[i]})`),
    "# No monochromatic k-AP",
    `for a in range(1, N + 1):`,
    `    for d in range(1, (N - a) // (k - 1) + 1):`,
    `        if a + (k - 1) * d <= N:`,
    `            ap = [a + i * d for i in range(k)]`,
    `            s.add(Or(*[c[ap[i]] != c[ap[0]] for i in range(1, k)]))`,
    "if s.check() == sat:",
    "    m = s.model()",
    "    print('sat')",
    `    for i in range(1, N + 1):`,
    `        print(f'c_{i}={m[c[i]]}')`,
    "else:",
    "    print('unsat')",
  ];
  return lines.join("\n");
}

/**
 * O(N) incremental energy delta when partition[i] changes from old_c → new_c.
 *
 * Scans only those k-APs of length k that pass through index i.
 * For each such AP, checks whether the OTHER k-1 elements were all old_c
 * (AP is broken: delta--) or are all new_c (AP is created: delta++).
 *
 * Correctness invariant:
 *   computeAPEnergy(p_after, N, k) === computeAPEnergy(p_before, N, k) + computeAPDelta(...)
 *
 * @param partition  Current (unmodified) partition
 * @param N          Domain size
 * @param k          AP length
 * @param i          Index being mutated (1-indexed)
 * @param old_c      Color before mutation
 * @param new_c      Color after mutation
 */
export function computeAPDelta(
  partition: Int8Array,
  N: number,
  k: number,
  i: number,
  old_c: number,
  new_c: number,
): number {
  if (old_c === new_c) return 0;
  let delta = 0;

  // i can sit at position pos ∈ [0, k-1] in a k-AP starting at x with step d.
  // x = i - pos*d, last element = x + (k-1)*d = i + (k-1-pos)*d
  // Constraints: x >= 1  →  d ≤ (i-1)/pos         (pos > 0)
  //              last ≤ N →  d ≤ (N-i)/(k-1-pos)   (k-1-pos > 0)

  for (let pos = 0; pos < k; pos++) {
    const slotsAfter = k - 1 - pos;
    const slotsBefore = pos;

    let max_d: number;
    if (slotsAfter === 0) {
      // i is the last element; bounded only by start ≥ 1
      max_d = slotsBefore > 0 ? Math.floor((i - 1) / slotsBefore) : N;
    } else {
      max_d = Math.floor((N - i) / slotsAfter);
      if (slotsBefore > 0) max_d = Math.min(max_d, Math.floor((i - 1) / slotsBefore));
    }

    for (let d = 1; d <= max_d; d++) {
      const x = i - pos * d;
      let otherAllOld = true;
      let otherAllNew = true;

      for (let step = 0; step < k; step++) {
        if (step === pos) continue;
        const c = partition[x + step * d]!;
        if (c !== old_c) otherAllOld = false;
        if (c !== new_c) otherAllNew = false;
        if (!otherAllOld && !otherAllNew) break;
      }

      if (otherAllOld) delta--; // broke a mono AP under old_c
      if (otherAllNew) delta++; // created a mono AP under new_c
    }
  }

  return delta;
}
