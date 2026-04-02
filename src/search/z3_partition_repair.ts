/**
 * z3_partition_repair.ts — Z3 SMT-based local repair for near-zero energy partitions.
 *
 * When the SA engine achieves a low energy (E ≤ 50), this module identifies the
 * violating elements and generates a Z3 Python script that:
 *   1. Freezes all non-violating elements at their SA-assigned colors
 *   2. Creates Z3 Int variables for the violating neighbourhood
 *   3. Adds constraints: for every (x,y,z) with x+y=z in {1..N}, NOT all same color
 *   4. Asks Z3 to find a satisfying assignment (SAT) or prove UNSAT
 *
 * If SAT, the repaired partition is returned as E=0 witness.
 */

import { SolverBridge } from "../solver";
import { computeSumFreeEnergy } from "../math/optim/SumFreeEnergy";

export interface Z3RepairResult {
  solved: boolean;
  partition?: Int8Array;  // Full partition if solved
  repairedElements?: Map<number, number>;  // element → new color
  z3Output: string;
}

/**
 * Identify all elements involved in monochromatic (x+y=z) violations,
 * plus their 1-hop neighbours (elements that share a triple with any violating element).
 */
export function findRepairWindow(
  partition: Int8Array,
  domainSize: number,
  conflictDetector: (p: Int8Array, N: number) => number[][],
): { violatingSets: number[][]; repairElements: number[] } {
  const violatingSets = conflictDetector(partition, domainSize);
  const repairSet = new Set<number>();

  for (const set of violatingSets) {
    for (const elem of set) {
      repairSet.add(elem);
    }
  }

  // Expansion: for each violating element, include elements that share a potential conflict set with it.
  // We use the conflictDetector on a "virtual" same-color partition to discover neighbors.
  const expandedSet = new Set(repairSet);
  
  // Note: For large domains, full neighbor discovery might be slow. 
  // We'll use a proximity-based expansion as a fallback if the set is small.

  // Proximity-based expansion
  if (expandedSet.size < 200) {
    Array.from(repairSet).forEach(elem => {
      for (let d = -50; d <= 50; d++) {
        const neighbor = elem + d;
        if (neighbor >= 1 && neighbor <= domainSize) {
          expandedSet.add(neighbor);
        }
      }
    });
  }

  // Cap at 300 elements
  const repairElements = Array.from(expandedSet).sort((a, b) => a - b);
  if (repairElements.length > 300) {
    const direct = Array.from(repairSet);
    const byProximity = repairElements
      .filter(e => !repairSet.has(e))
      .sort((a, b) => {
        const aDist = Math.min(...direct.map(d => Math.abs(a - d)));
        const bDist = Math.min(...direct.map(d => Math.abs(b - d)));
        return aDist - bDist;
      })
      .slice(0, 300 - direct.length);
    return { violatingSets, repairElements: [...direct, ...byProximity].sort((a, b) => a - b) };
  }

  return { violatingSets, repairElements };
}

/**
 * Generate a Z3 Python script using BOOLEAN SAT encoding.
 * Each element gets K boolean variables: c_i_0, c_i_1, ..., c_i_(K-1)
 * Exactly one must be true per element. Triple exclusion is purely boolean.
 * This is dramatically faster than SMT Int encoding for partition problems.
 */
export function generateZ3RepairScript(
  partition: Int8Array,
  domainSize: number,
  numPartitions: number,
  repairElements: number[],
  allPossibleConflicts: number[][],
): string {
  const repairSet = new Set(repairElements);

  const lines: string[] = [
    "from z3 import *",
    "",
    `N = ${domainSize}`,
    `K = ${numPartitions}`,
    "",
    "s = Solver()",
    "s.set('timeout', 120000)  # 2 minute timeout",
    "",
    "# Boolean SAT encoding: c[i][k] = True iff element i has color k",
    "c = {}",
  ];

  // For repair elements: create K boolean variables with exactly-one constraint
  // For fixed elements: just store their known color as a constant
  for (let i = 1; i <= domainSize; i++) {
    if (repairSet.has(i)) {
      // Create K boolean variables
      const varNames = [];
      for (let k = 0; k < numPartitions; k++) {
        varNames.push(`c_${i}_${k}`);
      }
      lines.push(`c[${i}] = [Bool('${varNames.join("'), Bool('")}')]`);
      // Exactly-one constraint (at least one + at most one)
      lines.push(`s.add(Or(*c[${i}]))`);  // at least one color
      lines.push(`s.add(*[Not(And(c[${i}][j], c[${i}][k])) for j in range(K) for k in range(j+1, K)])`);  // at most one
    } else {
      // Fixed: store as a list of constants
      const color = partition[i];
      const bools = Array.from({ length: numPartitions }, (_, k) => k === color ? "True" : "False");
      lines.push(`c[${i}] = [${bools.join(", ")}]`);
    }
  }

  lines.push("");
  // Triple/AP exclusion: For any conflict set where at least one element is free
  const triples: number[][] = [];
  for (const set of allPossibleConflicts) {
    if (set.some(e => repairSet.has(e))) {
      triples.push(set);
    }
  }

  // Emit conflict sets as a compact Python list
  const tripleStrs = triples.map(set => `(${set.join(",")})`);
  const CHUNK = 500;
  lines.push("_conflicts = [");
  for (let i = 0; i < tripleStrs.length; i += CHUNK) {
    lines.push("  " + tripleStrs.slice(i, i + CHUNK).join(",") + ",");
  }
  lines.push("]");
  lines.push("for _set in _conflicts:");
  lines.push("  for _k in range(K):");
  lines.push("    s.add(Not(And(*[c[e][_k] for e in _set])))");


  lines.push("");
  lines.push("result = s.check()");
  lines.push("print(result)");
  lines.push("if result == sat:");
  lines.push("    m = s.model()");

  // Print assignments for repair elements — decode boolean to integer color
  for (const elem of repairElements) {
    lines.push(`    color = next(k for k in range(K) if is_true(m[c[${elem}][k]]))`);
    lines.push(`    print(f'c_${elem}={color}')`);
  }

  return lines.join("\n");
}

/**
 * Run Z3 to repair a near-zero energy partition.
 * Returns the full repaired partition if Z3 finds SAT.
 */
export async function runZ3Repair(
  partition: Int8Array,
  domainSize: number,
  numPartitions: number,
  solver: SolverBridge,
  conflictDetector: (p: Int8Array, N: number) => number[][],
): Promise<Z3RepairResult> {
  const { violatingSets, repairElements } = findRepairWindow(partition, domainSize, conflictDetector);

  if (violatingSets.length === 0) {
    return { solved: true, partition: new Int8Array(partition), z3Output: "Already E=0" };
  }

  // For the script, we need ALL POSSIBLE conflicts in the domain (like x+y=z for all x,y)
  // but only those that touch our repair widow. 
  // Wait, if I pass a detector that find violators, I also need a way to get the "structure" of the problem.
  // Actually, for Z3 to repair, it needs to know all constraints.
  // In Schur, we know x+y=z. In VdW, we know all k-APs.
  // The detector should probably return ALL possible conflict sets for the domain if we want it truly generic.
  // Let's redefine the detector to return ALL theoretical conflicts for N.
  
  const allConflicts = conflictDetector(new Int8Array(domainSize + 1).fill(-1), domainSize); 

  console.log(`   🔧 [Z3Repair] ${violatingSets.length} violating sets, ${repairElements.length} elements in repair window`);

  const script = generateZ3RepairScript(partition, domainSize, numPartitions, repairElements, allConflicts);
  const result = await solver.runZ3(script, 180_000); // 3 minute timeout

  if (result.success || result.output.includes("sat") && !result.output.includes("unsat")) {
    // Parse the model
    const repaired = new Int8Array(partition);
    const repairedElements = new Map<number, number>();

    const lines = result.output.split("\n");
    for (const line of lines) {
      const match = line.match(/c_(\d+)=(\d+)/);
      if (match) {
        const elem = parseInt(match[1]!);
        const color = parseInt(match[2]!);
        repaired[elem] = color;
        repairedElements.set(elem, color);
      }
    }

    // Verify the repair
    // Note: Verification also needs to be generic. 
    // We can check if any of the allConflicts are monochromatic in the new partition.
    let verifiedEnergy = 0;
    for (const set of allConflicts) {
      const color = repaired[set[0]!];
      if (color === undefined || color < 0) continue;
      if (set.every(e => repaired[e] === color)) {
        verifiedEnergy++;
      }
    }

    if (verifiedEnergy === 0) {
      return { solved: true, partition: repaired, repairedElements, z3Output: result.output };
    } else {
      console.log(`   ⚠️ [Z3Repair] Z3 said SAT but verification shows E=${verifiedEnergy}. Possible parse error.`);
      return { solved: false, z3Output: result.output };
    }
  }

  return { solved: false, z3Output: result.output };
}
