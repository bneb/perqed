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
import { computeAPEnergy, computeAPDelta } from "./ap_energy";

/**
 * Available initialization strategies for the SA partition.
 *
 * - "modular":       (i-1) % K  — original default, strong attractor at E≈6
 * - "random":        uniform random — maximum diversity, different basin each run
 * - "gaussian_norm": ((i*i+1) % 13) % K — quadratic Gaussian residue, E≈420 seed
 * - "lookup_shift":  period-18 LUT shifted by seed_offset — E≈407 seed
 * - "blocks":        consecutive blocks of floor(N/K) — monotone start
 * - "crossover":     uniform crossover of two parent partitions (genetic)
 */
export type SeedStrategy =
  | "modular"
  | "random"
  | "gaussian_norm"
  | "lookup_shift"
  | "blocks"
  | "crossover";

export interface PartitionSAConfig {
  domain_size: number;
  num_partitions: number;
  energy_target?: "schur" | "vdw"; // default "schur"
  ap_length?: number;              // required if energy_target === "vdw"
  sa_iterations?: number;       // default 10_000_000
  initial_temperature?: number; // default 5.0
  cooling_rate?: number;        // default computed to reach ~0.01 by end
  enable_reheats?: boolean;     // whether to overheat when stagnating
  stagnation_threshold?: number; // iterations without bestEnergy improving
  enable_rl?: boolean;          // use tabular Q-learning inside mutation loop
  epsilon?: number;             // epsilon-greedy parameter (e.g. 0.1)
  alpha?: number;               // Q-learning rate (e.g. 0.05)
  warmStart?: Int8Array;        // 1-indexed; takes priority over seed_strategy
  seed_strategy?: SeedStrategy; // default "modular"
  seed_offset?: number;         // for "lookup_shift": shifts the LUT start
  crossover_parents?: [Int8Array, Int8Array]; // required for "crossover"
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
 * Build the initial partition according to the configured SeedStrategy.
 * warmStart takes priority — if provided, it is returned as-is (with missing
 * elements filled randomly).
 */
export function initializePartition(config: PartitionSAConfig): Int8Array {
  const { domain_size: N, num_partitions: K, seed_strategy = "modular", seed_offset = 0 } = config;

  // warmStart always wins
  if (config.warmStart && config.warmStart.length === N + 1) {
    const p = new Int8Array(config.warmStart);
    for (let i = 1; i <= N; i++) {
      if (p[i]! < 0 || p[i]! >= K) p[i] = Math.floor(Math.random() * K);
    }
    return p;
  }

  const p = new Int8Array(N + 1);

  switch (seed_strategy) {
    case "random":
      for (let i = 1; i <= N; i++) p[i] = Math.floor(Math.random() * K);
      break;

    case "gaussian_norm":
      for (let i = 1; i <= N; i++) p[i] = ((i * i + 1) % 13) % K;
      break;

    case "lookup_shift": {
      const lut = [0, 1, 2, 3, 4, 5, 0, 1, 2, 4, 5, 3, 0, 2, 1, 4, 5, 3];
      for (let i = 1; i <= N; i++) p[i] = lut[(i - 1 + seed_offset) % lut.length]! % K;
      break;
    }

    case "blocks":
      for (let i = 1; i <= N; i++) p[i] = Math.min(Math.floor((i - 1) * K / N), K - 1);
      break;

    case "crossover": {
      if (!config.crossover_parents) throw new Error("crossover strategy requires crossover_parents");
      const [pa, pb] = config.crossover_parents;
      for (let i = 1; i <= N; i++) p[i] = Math.random() < 0.5 ? pa[i]! : pb[i]!;
      break;
    }

    default: // "modular"
      for (let i = 1; i <= N; i++) p[i] = (i - 1) % K;
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
    energy_target = "schur",
    ap_length,
    sa_iterations = 10_000_000,
    initial_temperature = 5.0,
  } = config;

  if (energy_target === "vdw" && !ap_length) {
    throw new Error("ap_length is required when energy_target is vdw");
  }

  const computeEnergy = (p: Int8Array) =>
    energy_target === "vdw"
      ? computeAPEnergy(p, domain_size, ap_length!)
      : computeSumFreeEnergy(p, domain_size, num_partitions);

  const getDeltaE = (p: Int8Array, elem: number, oldC: number, newC: number) =>
    energy_target === "vdw"
      ? computeAPDelta(p, domain_size, ap_length!, elem, oldC, newC)
      : deltaEnergy(p, elem, oldC, newC, domain_size);

  // Cooling: reach T~0.01 by end of run
  const cooling_rate = config.cooling_rate ?? Math.pow(0.01 / initial_temperature, 1 / sa_iterations);

  // Q-Learning Memory Matrix Allocation
  const qTensor = config.enable_rl ? new Float32Array((domain_size + 1) * num_partitions) : null;

  // Initialize partition via configured seed strategy (warmStart wins if provided)
  let current: Int8Array = initializePartition(config);

  let currentEnergy = computeEnergy(current);

  // Best seen
  let bestPartition = new Int8Array(current);
  let bestEnergy = currentEnergy;

  let T = initial_temperature;
  let lastImprovement = 0;

  for (let iter = 0; iter < sa_iterations; iter++) {
    if (bestEnergy === 0) break;

    // Pick random element
    const elem = 1 + Math.floor(Math.random() * domain_size);
    const oldClass = current[elem]!;
    
    let newClass = 0;
    if (config.enable_rl && qTensor && Math.random() >= (config.epsilon ?? 0.1)) {
        // Exploitation (Greedy $O(K)$ lookup)
        const baseIdx = elem * num_partitions;
        let bestQ = -Infinity;
        let bestOpts: number[] = [];
        for (let c = 0; c < num_partitions; c++) {
            if (c === oldClass) continue;
            const q = qTensor[baseIdx + c]!;
            if (q > bestQ) {
                bestQ = q;
                bestOpts = [c];
            } else if (q === bestQ) {
                bestOpts.push(c);
            }
        }
        newClass = bestOpts[Math.floor(Math.random() * bestOpts.length)]!;
    } else {
        // Random Exploration
        newClass = Math.floor(Math.random() * (num_partitions - 1));
        if (newClass >= oldClass) newClass++;
    }

    const dE = getDeltaE(current, elem, oldClass, newClass);

    // Q-Learning Scalar Update Logic
    if (config.enable_rl && qTensor) {
        const reward = -dE;
        const idx = elem * num_partitions + newClass;
        const val = qTensor[idx] as number;
        qTensor[idx] = val + (config.alpha ?? 0.05) * (reward - val);
    }

    if (dE <= 0 || Math.random() < Math.exp(-dE / T)) {
      current[elem] = newClass;
      currentEnergy += dE;

      if (currentEnergy < bestEnergy) {
        bestEnergy = currentEnergy;
        bestPartition = new Int8Array(current);
        lastImprovement = iter;
      }
    }

    if (config.enable_reheats && iter - lastImprovement > (config.stagnation_threshold ?? 500_000)) {
      T = Math.max(1.0, Math.pow(bestEnergy, 0.4));
      lastImprovement = iter; // Reset trigger to prevent chain overheating
    } else {
      T *= cooling_rate;
    }
  }

  // Final exact energy check on bestPartition
  const finalEnergy = computeEnergy(bestPartition);

  return {
    partition: bestPartition,
    energy: finalEnergy,
    status: finalEnergy === 0 ? "witness" : "violations",
    iterations: sa_iterations,
    description,
  };
}
