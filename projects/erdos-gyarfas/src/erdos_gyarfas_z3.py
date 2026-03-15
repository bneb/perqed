"""
Erdős-Gyárfás Conjecture — Z3 Counterexample Search

Searches for a graph on N vertices where:
  1. Every vertex has degree ≥ 3
  2. No simple cycle has length equal to a power of 2 (4, 8, 16, ...)

If SAT  → counterexample found (adjacency matrix printed)
If UNSAT → conjecture holds for this vertex count

Usage: python3 erdos_gyarfas_z3.py <n_vertices>
"""

import sys
import json
from itertools import permutations, combinations
from z3 import *

def encode_erdos_gyarfas(n: int):
    """Encode the negation of the Erdős-Gyárfás conjecture for n vertices."""
    
    s = Solver()
    s.set("timeout", 120000)  # 2 minute timeout
    
    # Edge variables: e[i][j] = True iff edge (i,j) exists
    e = [[Bool(f"e_{i}_{j}") for j in range(n)] for i in range(n)]
    
    # === Structural constraints ===
    
    # No self-loops
    for i in range(n):
        s.add(Not(e[i][i]))
    
    # Symmetry: e[i][j] == e[j][i]
    for i in range(n):
        for j in range(i + 1, n):
            s.add(e[i][j] == e[j][i])
    
    # Min degree >= 3
    for i in range(n):
        deg = Sum([If(e[i][j], 1, 0) for j in range(n)])
        s.add(deg >= 3)
    
    # === Forbid all simple cycles of length 2^k ===
    # For each power-of-2 length L that fits in n vertices,
    # enumerate all possible simple cycles and forbid them.
    
    total_constraints = 0
    power = 2
    while (1 << power) <= n:
        L = 1 << power  # cycle length: 4, 8, 16, ...
        
        # Enumerate all L-subsets of vertices
        for subset in combinations(range(n), L):
            # For each subset, enumerate all distinct simple cycles.
            # Fix the smallest vertex as the starting point (breaks rotational symmetry).
            # Only consider one direction (breaks reflection symmetry).
            # A cycle on L vertices with a fixed start has (L-1)!/2 distinct orderings.
            
            start = subset[0]
            rest = list(subset[1:])
            
            for perm in permutations(rest):
                # Only take one direction: require perm[0] < perm[-1]
                # This breaks the reflection symmetry
                if perm[0] > perm[-1]:
                    continue
                
                cycle = [start] + list(perm)
                
                # Forbid this cycle: NOT(e[c0][c1] AND e[c1][c2] AND ... AND e[c_{L-1}][c0])
                edges_in_cycle = []
                for idx in range(L):
                    u = cycle[idx]
                    v = cycle[(idx + 1) % L]
                    edges_in_cycle.append(e[u][v])
                
                s.add(Not(And(*edges_in_cycle)))
                total_constraints += 1
        
        power += 1
    
    print(f"ENCODING: n={n}, constraints={total_constraints}", file=sys.stderr)
    
    # === Solve ===
    result = s.check()
    
    if result == sat:
        model = s.model()
        # Extract adjacency matrix
        adj = []
        for i in range(n):
            row = []
            for j in range(n):
                val = model.evaluate(e[i][j])
                row.append(1 if is_true(val) else 0)
            adj.append(row)
        
        # Compute degrees
        degrees = [sum(row) for row in adj]
        
        # Output
        output = {
            "status": "sat",
            "n": n,
            "adjacency_matrix": adj,
            "degrees": degrees,
            "edge_count": sum(sum(row) for row in adj) // 2,
        }
        print(json.dumps(output))
        
    elif result == unsat:
        print(json.dumps({"status": "unsat", "n": n}))
        
    else:
        print(json.dumps({"status": "unknown", "n": n, "reason": str(result)}))


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 8
    encode_erdos_gyarfas(n)
