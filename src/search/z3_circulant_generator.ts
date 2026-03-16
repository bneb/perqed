/**
 * Z3 Circulant Script Generator
 *
 * Generates a self-contained Python/Z3 script that solves the Ramsey
 * witness search problem restricted to circulant graphs on N vertices.
 *
 * Key optimization: all constraint clause computation is done in TypeScript
 * at script-generation time, not at Python runtime. The generated Python
 * script receives the clauses as literal lists — no Python loops over
 * combinatorially large vertex sets. This avoids the C(35,6)=1.6M
 * iteration bottleneck that caused the naive approach to time out.
 *
 * Script output format:
 *   SAT:{bits}   — satisfiable, bits is a binary string of length floor(N/2)
 *   UNSAT        — no circulant graph satisfies the constraints
 *   ERROR:{msg}  — unexpected failure
 */

function circDist(i: number, j: number, N: number): number {
  const diff = Math.abs(i - j);
  return Math.min(diff, N - diff);
}

/**
 * Generate all unique distance-sets for k-cliques in K_N.
 * Each k-subset of vertices produces a set of pairwise distances.
 * We deduplicate on the distance-set (as a sorted string key) to
 * avoid adding semantically identical constraints multiple times.
 *
 * Returns an array of unique distance-arrays, each representing
 * one constraint clause: OR over all distances in the array.
 */
function buildDistanceClauses(N: number, k: number): number[][] {
  const seen = new Set<string>();
  const clauses: number[][] = [];

  // Iterative k-combination generator
  function* combinations(n: number, r: number): Generator<number[]> {
    const combo = Array.from({ length: r }, (_, i) => i);
    if (r > n) return;
    while (true) {
      yield [...combo];
      let i = r - 1;
      while (i >= 0 && combo[i]! === n - r + i) i--;
      if (i < 0) break;
      combo[i]!++;
      for (let j = i + 1; j < r; j++) combo[j] = combo[j - 1]! + 1;
    }
  }

  for (const combo of combinations(N, k)) {
    // Collect the set of pairwise distances (use set to deduplicate)
    const distSet = new Set<number>();
    for (let a = 0; a < k; a++) {
      for (let b = a + 1; b < k; b++) {
        distSet.add(circDist(combo[a]!, combo[b]!, N));
      }
    }
    const sorted = Array.from(distSet).sort((a, b) => a - b);
    const key = sorted.join(",");
    if (!seen.has(key)) {
      seen.add(key);
      clauses.push(sorted);
    }
  }
  return clauses;
}

/**
 * Generate a Python/Z3 script for circulant Ramsey witness search.
 * All constraint computation is done at generation time in TypeScript.
 *
 * @param N  Number of vertices (e.g. 35 for R(4,6))
 * @param r  Red clique size to forbid (e.g. 4)
 * @param s  Blue clique size to forbid (e.g. 6)
 */
export function generateRamseyZ3Script(N: number, r: number, s: number): string {
  const maxDist = Math.floor(N / 2);

  // Precompute all unique distance-clauses in TypeScript (fast)
  const redClauses = buildDistanceClauses(N, r);   // Forbid all-red K_r
  const blueClauses = buildDistanceClauses(N, s);  // Forbid all-blue K_s

  // Serialize clauses as compact Python list literals
  const redStr = JSON.stringify(redClauses);
  const blueStr = JSON.stringify(blueClauses);

  return `from z3 import *

num_distances = ${maxDist}
e = [Bool(f'e_{"{d}"}') for d in range(1, num_distances + 1)]

solver = Solver()

# Constraint 1: No monochromatic red K_${r}
# ${redClauses.length} unique distance-set clauses (precomputed, deduplicated)
for dists in ${redStr}:
    solver.add(Or([Not(e[d - 1]) for d in dists]))

# Constraint 2: No monochromatic blue K_${s}
# ${blueClauses.length} unique distance-set clauses (precomputed, deduplicated)
for dists in ${blueStr}:
    solver.add(Or([e[d - 1] for d in dists]))

result = solver.check()

if result == sat:
    model = solver.model()
    bits = "".join(
        "1" if is_true(model[e[d - 1]]) else "0"
        for d in range(1, num_distances + 1)
    )
    print(f"SAT:{bits}")
elif result == unsat:
    print("UNSAT")
else:
    print(f"ERROR:{result}")
`;
}
