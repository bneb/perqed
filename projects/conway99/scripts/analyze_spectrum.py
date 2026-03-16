#!/usr/bin/env python3
"""
Conway 99 Spectrum Analyzer

Analyzes the eigenvalue spectrum of saved graph states to determine
convergence toward SRG(99, 14, 1, 2).

Target eigenvalues:
  k  = 14  (multiplicity 1)
  r  =  4  (multiplicity 22)
  s  = -3  (multiplicity 76)

Usage:
  python3 projects/conway99/scripts/analyze_spectrum.py <path_to_state.json>
  python3 projects/conway99/scripts/analyze_spectrum.py projects/conway99/data/best_states/*.json
"""

import json
import sys
import os
import numpy as np
from pathlib import Path


def analyze_state(filepath: str, verbose: bool = True) -> dict:
    with open(filepath, 'r') as f:
        data = json.load(f)

    energy = data.get('energy', '?')
    worker_id = data.get('workerId', '?')

    # Reconstruct the 99×99 adjacency matrix
    flat_A = data['adjacency']
    A = np.array(flat_A, dtype=np.float64).reshape(99, 99)

    # Sanity checks
    assert np.allclose(A, A.T), "Matrix is not symmetric!"
    assert np.allclose(np.diag(A), 0), "Matrix has nonzero diagonal!"

    degrees = A.sum(axis=1)
    min_deg, max_deg = int(degrees.min()), int(degrees.max())

    # Eigenvalue computation
    eigenvalues = np.linalg.eigvalsh(A)  # eigvalsh for symmetric matrices
    eigenvalues = np.sort(eigenvalues)[::-1]  # descending

    # Cluster eigenvalues (round to 1 decimal for grouping)
    rounded = np.round(eigenvalues, 1)
    unique, counts = np.unique(rounded, return_counts=True)
    spectrum = dict(zip(unique, counts))

    # Distance to target spectrum
    target = np.array([14.0] + [4.0]*22 + [-3.0]*76)
    target = np.sort(target)[::-1]
    spectral_distance = np.linalg.norm(eigenvalues - target)

    if verbose:
        basename = os.path.basename(filepath)
        print(f"\n{'='*60}")
        print(f"  File: {basename}")
        print(f"  Energy: {energy} | Worker: {worker_id}")
        print(f"  Degree range: [{min_deg}, {max_deg}]")
        print(f"  Spectral distance to target: {spectral_distance:.2f}")
        print(f"{'='*60}")

        print(f"\n  {'Target SRG(99,14,1,2)':<30} {'Current State':<30}")
        print(f"  {'─'*28}   {'─'*28}")
        print(f"  {'14.00: mult  1':<30} ", end="")

        # Show top eigenvalue
        print(f"{eigenvalues[0]:.2f}: mult 1")

        # Show cluster around r=4
        cluster_r = eigenvalues[1:23]
        r_mean = cluster_r.mean()
        r_std = cluster_r.std()
        print(f"  {' 4.00: mult 22':<30} {r_mean:.2f} ± {r_std:.2f}: mult 22 (slots 2-23)")

        # Show cluster around s=-3
        cluster_s = eigenvalues[23:]
        s_mean = cluster_s.mean()
        s_std = cluster_s.std()
        print(f"  {'-3.00: mult 76':<30} {s_mean:.2f} ± {s_std:.2f}: mult 76 (slots 24-99)")

        print(f"\n  Full spectrum (rounded to 0.1):")
        for val in sorted(spectrum.keys(), reverse=True):
            bar = '█' * int(spectrum[val])
            print(f"    {val:6.1f}: {int(spectrum[val]):3d} {bar}")

    return {
        'filepath': filepath,
        'energy': energy,
        'eigenvalues': eigenvalues,
        'spectral_distance': spectral_distance,
        'top': eigenvalues[0],
        'r_mean': float(eigenvalues[1:23].mean()),
        'r_std': float(eigenvalues[1:23].std()),
        's_mean': float(eigenvalues[23:].mean()),
        's_std': float(eigenvalues[23:].std()),
    }


def analyze_trajectory(filepaths: list[str]):
    """Analyze multiple states to show convergence trajectory."""
    results = []
    for fp in sorted(filepaths):
        try:
            r = analyze_state(fp, verbose=False)
            results.append(r)
        except Exception as e:
            print(f"  Skipping {fp}: {e}")

    if not results:
        print("No valid states found.")
        return

    # Sort by energy
    results.sort(key=lambda r: r['energy'])

    print(f"\n{'='*80}")
    print(f"  CONVERGENCE TRAJECTORY ({len(results)} states)")
    print(f"{'='*80}")
    print(f"  {'Energy':>8}  {'λ₁':>7}  {'r̄(22)':>8}  {'σ_r':>6}  {'s̄(76)':>8}  {'σ_s':>6}  {'‖Δ‖':>8}")
    print(f"  {'─'*8}  {'─'*7}  {'─'*8}  {'─'*6}  {'─'*8}  {'─'*6}  {'─'*8}")

    for r in results[:20]:  # Show top 20
        print(f"  {r['energy']:>8}  {r['top']:>7.2f}  {r['r_mean']:>8.2f}  {r['r_std']:>6.2f}  "
              f"{r['s_mean']:>8.2f}  {r['s_std']:>6.2f}  {r['spectral_distance']:>8.2f}")

    # Show best
    best = results[0]
    print(f"\n  Best state: E={best['energy']}, ‖Δspectrum‖={best['spectral_distance']:.2f}")
    print(f"  Target: λ₁=14.00, r̄=4.00, s̄=-3.00")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 analyze_spectrum.py <state.json>           # Single state")
        print("  python3 analyze_spectrum.py states/*.json          # Trajectory")
        sys.exit(1)

    filepaths = sys.argv[1:]

    if len(filepaths) == 1:
        analyze_state(filepaths[0])
    else:
        analyze_trajectory(filepaths)
        # Also show detailed analysis of the best
        best_fp = sorted(filepaths, key=lambda f: json.load(open(f))['energy'])[0]
        analyze_state(best_fp)
