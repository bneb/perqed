#!/usr/bin/env python3
"""
Erdős Problem #1075 — Computational Exploration (r=3)

Question: Does there exist c_3 > 1/27 such that any 3-uniform hypergraph on n
vertices with >= (1+ε)(n/3)^3 edges contains a subhypergraph on m vertices
with >= c_3 * m^3 edges, where m → ∞?

This script:
1. Generates 3-uniform hypergraphs just above the threshold (n/3)^3
2. For each, finds the densest induced subhypergraph on m vertices (for various m)
3. Reports the ratio |E(H[S])| / m^3 to estimate c_3

Strategy:
  - For small n: exact or greedy search for densest subhypergraph
  - Compare against the balanced 3-partite construction (which gives exactly 1/27)
  - Also test adversarial constructions (balanced 3-partite + small perturbation)
"""

import itertools
import random
import math
from collections import defaultdict

random.seed(42)


def balanced_3partite_edges(n):
    """
    Return edges of the complete balanced 3-partite 3-uniform hypergraph on n vertices.
    Partition: V = A ∪ B ∪ C with |A|=|B|=|C|=n/3 (approximately).
    Edges = all {a, b, c} with a ∈ A, b ∈ B, c ∈ C.
    """
    sizes = [n // 3, n // 3, n - 2 * (n // 3)]
    parts = []
    start = 0
    for s in sizes:
        parts.append(list(range(start, start + s)))
        start += s

    edges = set()
    for a in parts[0]:
        for b in parts[1]:
            for c in parts[2]:
                edge = tuple(sorted([a, b, c]))
                edges.add(edge)
    return edges, parts


def count_induced_edges(edges_set, subset):
    """Count edges of a hypergraph induced on a subset."""
    subset_set = frozenset(subset)
    count = 0
    for e in edges_set:
        if all(v in subset_set for v in e):
            count += 1
    return count


def all_3edges(n):
    """All possible 3-element subsets of {0, ..., n-1}."""
    return list(itertools.combinations(range(n), 3))


def greedy_densest_subhypergraph(edges_set, n, target_m):
    """
    Greedy algorithm to find a dense induced subhypergraph on target_m vertices.
    Start with all n vertices, iteratively remove the vertex in fewest edges.
    """
    vertices = set(range(n))
    # Build degree map
    degree = defaultdict(int)
    active_edges = set(edges_set)

    for e in active_edges:
        for v in e:
            degree[v] += 1

    while len(vertices) > target_m:
        # Find vertex with minimum degree
        min_v = min(vertices, key=lambda v: degree.get(v, 0))
        vertices.remove(min_v)

        # Remove edges containing min_v
        to_remove = [e for e in active_edges if min_v in e]
        for e in to_remove:
            active_edges.remove(e)
            for v in e:
                if v != min_v:
                    degree[v] -= 1
        del degree[min_v]

    return vertices, len(active_edges)


def random_densest_search(edges_set, n, target_m, trials=200):
    """Random sampling to find dense subhypergraphs."""
    best_count = 0
    best_subset = None

    for _ in range(trials):
        subset = random.sample(range(n), target_m)
        count = count_induced_edges(edges_set, subset)
        if count > best_count:
            best_count = count
            best_subset = subset

    return best_subset, best_count


def analyze_hypergraph(name, edges_set, n, m_values):
    """Analyze a hypergraph: find densest subhypergraphs at various sizes."""
    num_edges = len(edges_set)
    threshold = (n / 3) ** 3
    ratio_to_threshold = num_edges / threshold if threshold > 0 else float('inf')

    print(f"\n{'=' * 60}")
    print(f"  {name}")
    print(f"  n = {n}, |E| = {num_edges}")
    print(f"  Threshold (n/3)^3 = {threshold:.1f}")
    print(f"  Ratio |E|/(n/3)^3 = {ratio_to_threshold:.4f}")
    print(f"{'=' * 60}")
    print(f"  {'m':>4}  {'|E(H[S])|':>10}  {'m^3':>8}  {'|E|/m^3':>10}  {'vs 1/27':>10}")
    print(f"  {'-' * 4}  {'-' * 10}  {'-' * 8}  {'-' * 10}  {'-' * 10}")

    results = []
    for m in m_values:
        if m > n or m < 3:
            continue

        # Use greedy + random, take best
        _, greedy_count = greedy_densest_subhypergraph(edges_set, n, m)
        _, random_count = random_densest_search(edges_set, n, m, trials=300)
        best_count = max(greedy_count, random_count)

        m_cubed = m ** 3
        density = best_count / m_cubed if m_cubed > 0 else 0
        ratio_vs_27 = density / (1 / 27)

        results.append((m, best_count, density, ratio_vs_27))
        print(f"  {m:4d}  {best_count:10d}  {m_cubed:8d}  {density:10.6f}  {ratio_vs_27:10.4f}x")

    return results


def construct_perturbed_3partite(n, extra_fraction=0.05):
    """
    Balanced 3-partite + random extra edges.
    This simulates the (1+ε)(n/3)^3 regime.
    """
    base_edges, parts = balanced_3partite_edges(n)
    all_possible = set(itertools.combinations(range(n), 3))
    non_base = all_possible - base_edges

    num_extra = int(len(base_edges) * extra_fraction)
    extra = random.sample(list(non_base), min(num_extra, len(non_base)))

    return base_edges | set(extra)


def construct_random_above_threshold(n, epsilon=0.1):
    """
    Random 3-uniform hypergraph with exactly (1+ε)(n/3)^3 edges.
    """
    threshold = (n / 3) ** 3
    target = int((1 + epsilon) * threshold)
    all_possible = list(itertools.combinations(range(n), 3))

    if target > len(all_possible):
        target = len(all_possible)

    edges = random.sample(all_possible, target)
    return set(edges)


def construct_clique_plus_sparse(n, clique_size):
    """
    A dense clique on clique_size vertices + sparse random edges to fill to threshold.
    This should give subhypergraphs denser than 1/27.
    """
    # All edges within the clique
    clique_edges = set(itertools.combinations(range(clique_size), 3))

    # Add some random edges involving other vertices
    threshold = (n / 3) ** 3
    target = int(1.05 * threshold)
    remaining = target - len(clique_edges)

    if remaining > 0:
        other_edges = []
        for e in itertools.combinations(range(n), 3):
            if e not in clique_edges:
                other_edges.append(e)
        extra = random.sample(other_edges, min(remaining, len(other_edges)))
        return clique_edges | set(extra)
    else:
        return clique_edges


def main():
    print("=" * 60)
    print("  ERDŐS PROBLEM #1075 — Computational Exploration (r=3)")
    print("  Question: Is there c_3 > 1/27 ≈ 0.037037 ?")
    print("=" * 60)

    # ---- Test 1: Pure balanced 3-partite (should give exactly 1/27) ----
    for n in [12, 15, 18, 21]:
        edges, _ = balanced_3partite_edges(n)
        m_values = [m for m in range(4, n, max(1, n // 5))]
        analyze_hypergraph(
            f"Complete balanced 3-partite (n={n})",
            edges, n, m_values
        )

    # ---- Test 2: Perturbed 3-partite (ε = 5%, 10%, 20%) ----
    for n in [15, 18, 21]:
        for eps_pct in [5, 10, 20]:
            edges = construct_perturbed_3partite(n, extra_fraction=eps_pct / 100)
            m_values = [m for m in range(4, n, max(1, n // 5))]
            analyze_hypergraph(
                f"Perturbed 3-partite (n={n}, ε={eps_pct}%)",
                edges, n, m_values
            )

    # ---- Test 3: Random hypergraphs above threshold ----
    for n in [15, 18, 21]:
        for eps in [0.05, 0.1, 0.2]:
            edges = construct_random_above_threshold(n, epsilon=eps)
            m_values = [m for m in range(4, n, max(1, n // 5))]
            analyze_hypergraph(
                f"Random above threshold (n={n}, ε={eps})",
                edges, n, m_values
            )

    # ---- Test 4: Clique + sparse (adversarial for denser subgraphs) ----
    for n in [15, 18, 21]:
        clique_size = max(5, n // 3 + 1)
        edges = construct_clique_plus_sparse(n, clique_size)
        m_values = [m for m in range(4, n, max(1, n // 5))]
        analyze_hypergraph(
            f"Clique({clique_size}) + sparse (n={n})",
            edges, n, m_values
        )

    # ---- Summary ----
    print("\n" + "=" * 60)
    print("  SUMMARY")
    print("=" * 60)
    print("""
  The key question is whether all constructions above the
  threshold (1+ε)(n/3)^3 yield densest subhypergraphs with
  density ratio > 1/27 ≈ 0.037037.

  If the balanced 3-partite graph gives exactly 1/27 (as expected),
  then any perturbation that adds non-3-partite edges should push
  the densest subhypergraph density ABOVE 1/27 — which is what
  Problem 1075 conjectures.

  Key observations to check:
  1. Pure 3-partite: density ≈ 1/27 (baseline)
  2. Perturbed: density > 1/27 (evidence FOR the conjecture)
  3. Random: density > 1/27 (evidence FOR the conjecture)
  4. Adversarial: the hardest case — how close to 1/27 can we get?
    """)


if __name__ == "__main__":
    main()
