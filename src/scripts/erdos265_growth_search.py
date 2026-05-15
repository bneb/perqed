#!/usr/bin/env python3
"""
Test whether the residual constraint R₁(N) | (q₁·P_N + R₁(N+1))
forces d_N ≤ C·(a_N-1) for infinite fast-growing sequences.
"""
from fractions import Fraction
import math

def analyze_residuals(a_terms, q1_target=None):
    """
    Given a sequence prefix, compute:
    - The residuals R₁(N) = q₁ · ∏a_k · tail₁
    - The shifted partial sum denominators d_N
    - Whether d_N ≤ C·(a_N-1) with C depending on q₁
    """
    # First, compute what q₁ would be if the sum converges to a rational
    # For a finite prefix, the partial sum IS the sum
    s1 = sum(Fraction(1, a) for a in a_terms)
    q1 = s1.denominator if q1_target is None else q1_target
    p1 = s1.numerator if q1_target is None else int(q1_target * s1)
    
    s2 = Fraction(0)
    prod_a = 1
    prod_c = 1
    
    print(f"Sequence: {a_terms[:6]}{'...' if len(a_terms) > 6 else ''}")
    print(f"S1 = {s1} (q1={q1})")
    print(f"{'k':>3} {'a_k':>15} {'c_k':>15} {'d_N':>15} {'c_N':>15} {'d/c':>8} {'R1':>5} {'∏a':>15}")
    print("-" * 100)
    
    for k, a in enumerate(a_terms):
        c = a - 1
        s2 += Fraction(1, c)
        d_N = s2.denominator
        
        # Compute R₁ = q₁ · ∏_{j<k} a_j · tail₁(k)
        # tail₁(k) = s1 - ∑_{j<k} 1/a_j
        partial_s1 = sum(Fraction(1, a_terms[j]) for j in range(k))
        tail1 = s1 - partial_s1
        R1 = q1 * prod_a * tail1  # should be integer for infinite sequence
        
        ratio = d_N / c if c > 0 else float('inf')
        r1_val = float(R1)
        
        print(f"{k:3d} {a:15d} {c:15d} {d_N:15d} {c:15d} {ratio:8.2f} {r1_val:5.1f} {prod_a:15d}")
        
        prod_a *= a
        prod_c *= c
    
    print(f"\nKey: d/c ratio should stay bounded if cancellation_bound holds")

# Build Sylvester-like sequences with perturbations
def sylvester_seq(a0, perturbations, length):
    seq = [a0]
    for i in range(length - 1):
        a = seq[-1]
        delta = perturbations[i] if i < len(perturbations) else 0
        seq.append(a*a - a + 1 + delta)
    return seq

if __name__ == "__main__":
    print("=" * 100)
    print("Pure Sylvester (∑ 1/a_k = 1, q₁ = 1)")
    analyze_residuals(sylvester_seq(2, [], 7))
    
    print("\n" + "=" * 100)
    print("Sylvester + δ₂=3")
    analyze_residuals(sylvester_seq(2, [0, 0, 3], 7))
    
    print("\n" + "=" * 100)
    print("Sylvester + δ₁=-1, δ₂=-1")
    analyze_residuals(sylvester_seq(2, [0, -1, -1], 7))
    
    print("\n" + "=" * 100)
    print("Starting a₀=3")
    analyze_residuals(sylvester_seq(3, [0, 3], 6))
