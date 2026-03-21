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
): { violatingTriples: [number, number, number][]; repairElements: number[] } {
  const violatingTriples: [number, number, number][] = [];
  const repairSet = new Set<number>();

  for (let x = 1; x <= domainSize; x++) {
    for (let y = x; y <= domainSize; y++) {
      const z = x + y;
      if (z > domainSize) break;
      if (partition[x] === partition[y] && partition[y] === partition[z]) {
        violatingTriples.push([x, y, z]);
        repairSet.add(x);
        repairSet.add(y);
        repairSet.add(z);
      }
    }
  }

  // Smart expansion: for each violating element, include same-color-class
  // elements that appear in triples with it. These are the elements whose
  // reassignment would create or destroy violations involving the repair set.
  const expandedSet = new Set(repairSet);
  for (const elem of repairSet) {
    const elemColor = partition[elem];
    // Elements that pair with elem in a triple (x+y=z)
    for (let y = 1; y <= domainSize; y++) {
      if (y === elem) continue;
      if (partition[y] !== elemColor) continue; // only same-color matters
      const z = elem + y;
      if (z <= domainSize && partition[z] === elemColor) {
        expandedSet.add(y);
        expandedSet.add(z);
      }
      if (elem > y) {
        const x2 = elem - y;
        if (x2 >= 1 && partition[x2] === elemColor) {
          expandedSet.add(y);
          expandedSet.add(x2);
        }
      }
    }
  }

  // If still too small (< 200), do a broader expansion: include all elements
  // within ±100 of any violating element to give Z3 more degrees of freedom
  if (expandedSet.size < 200) {
    for (const elem of repairSet) {
      for (let d = -100; d <= 100; d++) {
        const neighbor = elem + d;
        if (neighbor >= 1 && neighbor <= domainSize) {
          expandedSet.add(neighbor);
        }
      }
    }
  }

  // Cap at 300 elements (Z3 boolean SAT handles this fine)
  const repairElements = [...expandedSet].sort((a, b) => a - b);
  if (repairElements.length > 300) {
    // Keep the direct violators + closest neighbors
    const direct = [...repairSet];
    const byProximity = repairElements
      .filter(e => !repairSet.has(e))
      .sort((a, b) => {
        const aDist = Math.min(...direct.map(d => Math.abs(a - d)));
        const bDist = Math.min(...direct.map(d => Math.abs(b - d)));
        return aDist - bDist;
      })
      .slice(0, 295);
    return { violatingTriples, repairElements: [...direct, ...byProximity].sort((a, b) => a - b) };
  }

  return { violatingTriples, repairElements };
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
  lines.push("# Sum-free constraints via Python loop to keep script size manageable");
  lines.push("# For every (x, y, z=x+y) where at least one is free, for each color k:");
  lines.push("#   NOT (c[x][k] AND c[y][k] AND c[z][k])");
  lines.push("");

  // Emit the constraint triples as a Python list literal, then loop over them.
  // This avoids generating 10k+ individual s.add() calls which hit Python's
  // compile-time recursion limit for large ASTs.
  const triples: [number, number, number][] = [];
  for (let x = 1; x <= domainSize; x++) {
    for (let y = x; y <= domainSize; y++) {
      const z = x + y;
      if (z > domainSize) break;
      if (repairSet.has(x) || repairSet.has(y) || repairSet.has(z)) {
        triples.push([x, y, z]);
      }
    }
  }

  // Emit triples as a compact Python list
  const tripleStrs = triples.map(([x, y, z]) => `(${x},${y},${z})`);
  // Split into chunks of 500 to avoid very long single lines
  const CHUNK = 500;
  lines.push("_triples = [");
  for (let i = 0; i < tripleStrs.length; i += CHUNK) {
    lines.push("  " + tripleStrs.slice(i, i + CHUNK).join(",") + ",");
  }
  lines.push("]");
  lines.push("for _x, _y, _z in _triples:");
  lines.push("  for _k in range(K):");
  lines.push("    s.add(Not(And(c[_x][_k], c[_y][_k], c[_z][_k])))");


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
): Promise<Z3RepairResult> {
  const { violatingTriples, repairElements } = findRepairWindow(partition, domainSize);

  if (violatingTriples.length === 0) {
    return { solved: true, partition: new Int8Array(partition), z3Output: "Already E=0" };
  }

  console.log(`   🔧 [Z3Repair] ${violatingTriples.length} violating triples, ${repairElements.length} elements in repair window`);

  const script = generateZ3RepairScript(partition, domainSize, numPartitions, repairElements);
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
    const energy = computeSumFreeEnergy(repaired, domainSize, numPartitions);
    if (energy === 0) {
      return { solved: true, partition: repaired, repairedElements, z3Output: result.output };
    } else {
      console.log(`   ⚠️ [Z3Repair] Z3 said SAT but verification shows E=${energy}. Possible parse error.`);
      return { solved: false, z3Output: result.output };
    }
  }

  return { solved: false, z3Output: result.output };
}
