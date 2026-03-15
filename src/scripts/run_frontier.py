"""
Erdős-Gyárfás Frontier Pipeline: Nauty + Bounded DFS

Decouples graph generation (nauty/geng) from constraint verification (Python DFS).
This is the General Solver architecture: let C-level symmetry breaking handle
the combinatorial explosion, then verify each concrete graph in microseconds.

Usage:
    brew install nauty
    pip install networkx
    python3 src/scripts/run_frontier.py 10     # verify n=10
    for n in {10..18}; do python3 src/scripts/run_frontier.py $n; done  # overnight
"""

import subprocess
import networkx as nx
import time
import sys
import json
from pathlib import Path


def has_power_of_two_cycle(G):
    """
    Checks if the fixed graph G has a cycle of length 4, 8, or 16.
    Uses a highly optimized bounded DFS for specific lengths.
    """
    target_lengths = {4, 8, 16}  # For n <= 18, cycles can only be up to 16
    max_len = max(target_lengths)

    def dfs(start_node, current_node, depth, visited):
        if depth in target_lengths:
            if start_node in G[current_node]:
                return True
        if depth >= max_len:
            return False

        visited.add(current_node)
        for neighbor in G[current_node]:
            if neighbor not in visited:
                if dfs(start_node, neighbor, depth + 1, visited):
                    return True
        visited.remove(current_node)
        return False

    nodes = list(G.nodes())
    for i, start_node in enumerate(nodes):
        visited = set(nodes[:i])
        if dfs(start_node, start_node, 1, visited):
            return True

    return False


def verify_erdos_gyarfas(n):
    print(f"═══════════════════════════════════════════════")
    print(f"  🔬 ERDŐS-GYÁRFÁS FRONTIER — nauty/geng + DFS")
    print(f"  n = {n} vertices, min degree ≥ 3")
    print(f"═══════════════════════════════════════════════")
    start_time = time.time()

    # Call geng: -d3 (min degree 3), -q (quiet)
    cmd = ["geng", "-d3", "-q", str(n)]
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, text=True)
    except FileNotFoundError:
        print("❌ geng not found. Install nauty: brew install nauty")
        sys.exit(1)

    graphs_checked = 0
    counterexample_found = False
    counterexample_g6 = None

    for line in process.stdout:
        g6_string = line.strip()
        if not g6_string:
            continue

        G = nx.from_graph6_bytes(g6_string.encode("ascii"))
        graphs_checked += 1

        if not has_power_of_two_cycle(G):
            print(f"\n  🚨 COUNTEREXAMPLE FOUND AT n={n} 🚨")
            print(f"  Graph6: {g6_string}")
            print(f"  Edges: {list(G.edges())}")
            print(f"  Degrees: {dict(G.degree())}")
            counterexample_found = True
            counterexample_g6 = g6_string
            process.kill()
            break

        if graphs_checked % 10000 == 0:
            elapsed = time.time() - start_time
            rate = graphs_checked / elapsed if elapsed > 0 else 0
            print(f"  ... {graphs_checked:>10,} graphs verified ({rate:,.0f}/s) ...")

    process.wait()
    elapsed = time.time() - start_time

    if not counterexample_found:
        print(f"\n  ✅ VERIFIED n={n}: All {graphs_checked:,} non-isomorphic graphs satisfy the conjecture.")
        print(f"  ⏱️  Time: {elapsed:.2f}s ({graphs_checked / elapsed:,.0f} graphs/s)")
    
    print(f"═══════════════════════════════════════════════\n")

    # Write results to data/
    result = {
        "n": n,
        "status": "counterexample" if counterexample_found else "verified",
        "graphs_checked": graphs_checked,
        "elapsed_seconds": round(elapsed, 2),
        "counterexample_g6": counterexample_g6,
    }
    
    data_dir = Path(__file__).parent.parent.parent / "data"
    data_dir.mkdir(exist_ok=True)
    results_file = data_dir / "frontier_results.jsonl"
    with open(results_file, "a") as f:
        f.write(json.dumps(result) + "\n")
    
    return not counterexample_found


if __name__ == "__main__":
    target_n = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    verify_erdos_gyarfas(target_n)
