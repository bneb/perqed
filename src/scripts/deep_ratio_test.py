#!/usr/bin/env python3
from fractions import Fraction
import math

def extend_and_test_ratio(prefix, target_depth=20):
    seq = list(prefix)
    s1 = sum(Fraction(1, a) for a in seq)
    s2 = sum(Fraction(1, a - 1) for a in seq)
    
    print(f"\nExtending prefix {prefix}")
    
    for step in range(len(prefix), target_depth):
        a_prev = seq[-1]
        base = a_prev * a_prev - a_prev + 1
        
        best_delta = 0
        best_ratio = float('inf')
        best_new_s2 = None
        best_new_a = None
        
        # Search perturbations to KEEP BOTH SUMS RATIONAL
        # Specifically, we want to minimize the product of denominators
        candidates = []
        for delta in range(-50, 51):
            a_next = base + delta
            if a_next <= a_prev: continue
            
            new_s1 = s1 + Fraction(1, a_next)
            new_s2 = s2 + Fraction(1, a_next - 1)
            
            score = new_s1.denominator * new_s2.denominator
            candidates.append((score, delta, a_next, new_s1, new_s2))
            
        if not candidates: break
        candidates.sort(key=lambda x: x[0])
        score, delta, a_next, new_s1, new_s2 = candidates[0]
        
        seq.append(a_next)
        s1 = new_s1
        s2 = new_s2
        
        c_N = a_next - 1
        d_N = s2.denominator
        ratio = d_N / c_N
        print(f"k={step:2d} | a_k = {a_next:25d} | delta={delta:3d} | d_N/c_N = {ratio:10.5f}")

if __name__ == "__main__":
    extend_and_test_ratio([2, 3, 6, 30], target_depth=15)
