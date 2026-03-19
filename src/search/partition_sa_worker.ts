/**
 * partition_sa_worker.ts — Simulated Annealing optimizer for sum-free partition problems.
 *
 * Uses the Metropolis criterion to minimize violations of x+y=z within color classes.
 * Designed for Schur-type problems (S(r) lower bounds) and Van der Waerden numbers.
 *
 * Algorithm:
 *   1. Initialize partition (from warm start or randomly)
 *   2. At each step: pick a random element, propose a new class assignment
 *   3. Accept if ΔE < 0 (always) or with probability exp(-ΔE/T) (uphill moves)
 *   4. Cool temperature geometrically: T *= coolingRate each step
 *   5. Return best partition seen across all iterations
 *
 * Energy = number of (x, y, z=x+y) triples all in the same color class.
 *          0 = valid witness (all classes are sum-free).
 */

import { computeSumFreeEnergy } from "../math/optim/SumFreeEnergy";

export interface PartitionSAConfig {
  domain_size: number;
  num_partitions: number;
  sa_iterations?: number;       // default 5_000_000
  initial_temperature?: number; // default 5.0
  cooling_rate?: number;        // default computed to reach ~0.01 by end
  warmStart?: Int8Array;        // 1-indexed; if omitted, random init
  description: string;
}

export interface PartitionSAResult {
  partition: Int8Array;
  energy: number;
  status: "witness" | "violations";
  iterations: number;
  description: string;
}

/**
 * Build a fresh random partition with all elements in [0, num_partitions).
 */
function randomPartition(domain_size: number, num_partitions: number): Int8Array {
  const p = new Int8Array(domain_size + 1).fill(-1);
  for (let i = 1; i <= domain_size; i++) {
    p[i] = Math.floor(Math.random() * num_partitions);
  }
  return p;
}

/**
 * Compute the energy delta (ΔE) of flipping element `elem` from its current class
 * to `newClass`, WITHOUT doing the full O(N²) energy recomputation.
 *
 * ΔE = new_violations_for_elem - old_violations_for_elem
 *
 * old_violations: (x,y) pairs in oldClass where elem+y or x+elem = z also in oldClass
 * new_violations: same for newClass after the proposed move
 */
function deltaEnergy(
  partition: Int8Array,
  elem: number,
  oldClass: number,
  newClass: number,
  domain_size: number,
): number {
  let delta = 0;

  // Violations lost from oldClass (elem is leaving)
  for (let y = 1; y <= domain_size; y++) {
    if (y === elem) continue;
    if (partition[y] !== oldClass) continue;
    const z = elem + y;
    if (z <= domain_size && partition[z] === oldClass) delta--;
    // Also check if elem = x+y => z=elem, x=elem-y
    const x = elem - y;
    if (x >= 1 && partition[x] === oldClass) delta--;
  }
  // Self-referential: elem+elem=2*elem
  const dbl = 2 * elem;
  if (dbl <= domain_size && partition[dbl] === oldClass) delta--;

  // Violations gained in newClass (elem is joining)
  for (let y = 1; y <= domain_size; y++) {
    if (y === elem) continue;
    if (partition[y] !== newClass) continue;
    const z = elem + y;
    if (z <= domain_size && partition[z] === newClass) delta++;
    const x = elem - y;
    if (x >= 1 && partition[x] === newClass) delta++;
  }
  if (dbl <= domain_size && partition[dbl] === newClass) delta++;

  return delta;
}

/**
 * Run the SA optimizer. Returns the best partition found.
 */
export async function runPartitionSA(config: PartitionSAConfig): Promise<PartitionSAResult> {
  const {
    domain_size,
    num_partitions,
    description,
    sa_iterations = 5_000_000,
    initial_temperature = 5.0,
  } = config;

  // Cooling: reach T~0.01 by end of run
  const cooling_rate = config.cooling_rate ?? Math.pow(0.01 / initial_temperature, 1 / sa_iterations);

  // Initialize partition
  let current: Int8Array;
  if (config.warmStart && config.warmStart.length === domain_size + 1) {
    current = new Int8Array(config.warmStart);
    // Fix any unassigned elements from warm start
    for (let i = 1; i <= domain_size; i++) {
    if (current[i] < 0) current[i] = Math.floor(Math.random() * num_partitions);
    }
  } else {
    current = randomPartition(domain_size, num_partitions);
  }

  let currentEnergy = computeSumFreeEnergy(current, domain_size, num_partitions);

  // Best seen
  let bestPartition = new Int8Array(current);
  let bestEnergy = currentEnergy;

  let T = initial_temperature;

  for (let iter = 0; iter < sa_iterations; iter++) {
    if (bestEnergy === 0) break;

    // Pick random element
    const elem = 1 + Math.floor(Math.random() * domain_size);
    const oldClass = current[elem]!;
    let newClass = Math.floor(Math.random() * (num_partitions - 1));
    if (newClass >= oldClass) newClass++;

    const dE = deltaEnergy(current, elem, oldClass, newClass, domain_size);

    if (dE <= 0 || Math.random() < Math.exp(-dE / T)) {
      current[elem] = newClass;
      currentEnergy += dE;

      if (currentEnergy < bestEnergy) {
        bestEnergy = currentEnergy;
        bestPartition = new Int8Array(current);
      }
    }

    T *= cooling_rate;
  }

  // Final exact energy check on bestPartition
  const finalEnergy = computeSumFreeEnergy(bestPartition, domain_size, num_partitions);

  return {
    partition: bestPartition,
    energy: finalEnergy,
    status: finalEnergy === 0 ? "witness" : "violations",
    iterations: sa_iterations,
    description,
  };
}
