/**
 * Z3 Circulant Script Generator
 *
 * Generates a self-contained Python/Z3 script that solves the Ramsey
 * witness search problem restricted to circulant graphs on N vertices.
 *
 * Search space: 2^floor(N/2) circulant colorings (2^17 for N=35).
 * Z3's CDCL engine solves this exactly in seconds, bypassing SA entirely.
 *
 * Script output format:
 *   SAT:{bits}   — satisfiable, bits is a binary string of length floor(N/2)
 *                  where bits[d-1] = '1' means distance d is "red" (edge present)
 *   UNSAT        — no circulant graph satisfies the constraints
 *   ERROR:{msg}  — unexpected failure
 */

/**
 * Generate a Python/Z3 script for circulant Ramsey witness search.
 *
 * Constraints encoded:
 *   1. For each K_r subgraph: not all r*(r-1)/2 distances can be "red" (True)
 *   2. For each K_s subgraph: not all s*(s-1)/2 distances can be "blue" (False)
 *
 * @param N  Number of vertices (e.g. 35 for R(4,6))
 * @param r  Red clique size to forbid (e.g. 4)
 * @param s  Blue clique size to forbid (e.g. 6)
 */
export function generateRamseyZ3Script(N: number, r: number, s: number): string {
  return `import itertools
import sys
from z3 import *

N = ${N}
r = ${r}
s = ${s}

# e[d-1] = Bool: True means distance d is "red" (edge present), False = "blue" (absent)
num_distances = N // 2
e = [Bool(f'e_{d}') for d in range(1, num_distances + 1)]

def circ_dist(i, j):
    diff = abs(i - j)
    return min(diff, N - diff)

solver = Solver()
solver.set("timeout", 120000)  # 2 minute timeout

# Constraint 1: No monochromatic red K_r
# For every r-subset of vertices, at least one pair must NOT be red
for combo in itertools.combinations(range(N), r):
    dists = set()
    for a in range(r):
        for b in range(a + 1, r):
            dists.add(circ_dist(combo[a], combo[b]))
    # Not all distances in this clique can be True (red)
    solver.add(Or([Not(e[d - 1]) for d in dists]))

# Constraint 2: No monochromatic blue K_s
# For every s-subset of vertices, at least one pair must NOT be blue
for combo in itertools.combinations(range(N), s):
    dists = set()
    for a in range(s):
        for b in range(a + 1, s):
            dists.add(circ_dist(combo[a], combo[b]))
    # Not all distances in this clique can be False (blue)
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
