#!/usr/bin/env python3
"""Erdős 265: Focused growth rate analysis."""
from fractions import Fraction
import math

def coupled_greedy_full(S1, S2, max_steps=20):
    """Coupled greedy with full diagnostics. Returns when sequence terminates."""
    T1, T2 = Fraction(S1), Fraction(S2)
    prev_a = 1
    results = []
    
    for n in range(max_steps):
        if T1 <= 0 or T2 <= 0:
            break
        
        # Use exact arithmetic for ceil
        a_min_1 = int((-(-T1.numerator // T1.denominator))) if T1 > 0 else 10**18
        # ceil(1/T1) = ceil(T1.denom / T1.numer)
        a_min_1 = (T1.denominator + T1.numerator - 1) // T1.numerator
        a_min_2 = (T2.denominator + T2.numerator - 1) // T2.numerator + 1
        
        a = max(int(a_min_1), int(a_min_2), prev_a + 1)
        
        # Safety check with exact arithmetic
        while Fraction(1, a) > T1 or Fraction(1, a - 1) > T2:
            a += 1
        
        R1 = T1  # since q1=1 and P1 is folded in
        log_a = math.log(a) if a > 1 else 0
        log_ratio = log_a / 2**n
        
        results.append({
            'n': n, 'a': a,
            'log_ratio': log_ratio,
            'growth': math.exp(log_ratio),
            'T1': float(T1), 'T2': float(T2),
            'ratio_to_sylvester': a / (prev_a * max(prev_a - 1, 1)) if n > 0 else 0,
        })
        
        T1 -= Fraction(1, a)
        T2 -= Fraction(1, a - 1)
        prev_a = a
    
    return results

# KEY QUESTION: Does log(a_k)/2^k → 0 for all rational target pairs?
# If it stays > 0, the conjecture is FALSE. If it → 0, likely TRUE.

print("="*70)
print("GROWTH RATE EXPERIMENT: log(a_k)/2^k for coupled greedy")
print("="*70)
print()
print("Sylvester reference: log(a_k)/2^k → 0.4687 (limsup ≈ 1.598)")
print("Conjecture TRUE ⟺ log(a_k)/2^k → 0 for all Erdős 265 sequences")
print()

# Generate many rational target pairs (S1, S2) with S2 > S1
# and S2 - S1 ≈ Sylvester's gap (≈ 0.707)
test_cases = [
    # (S1, S2, description)
    (Fraction(3,1), Fraction(5,1), "large targets"),
    (Fraction(5,1), Fraction(9,1), "very large targets"),
    (Fraction(10,1), Fraction(18,1), "huge targets"),
    (Fraction(3,2), Fraction(5,2), "moderate"),
    (Fraction(7,4), Fraction(13,4), "moderate 2"),
    (Fraction(5,3), Fraction(3,1), "gap ≈ 1.33"),
    (Fraction(2,1), Fraction(4,1), "gap = 2"),
    (Fraction(3,1), Fraction(6,1), "gap = 3"),
]

for S1, S2, desc in test_cases:
    results = coupled_greedy_full(S1, S2, max_steps=25)
    if len(results) < 3:
        continue
    
    print(f"--- S1={S1}, S2={S2} ({desc}) ---")
    print(f"  k  {'a_k':>15}  {'log/2^k':>10}  {'limsup':>10}  {'a/prev²':>10}")
    for r in results:
        print(f"  {r['n']:>2}  {r['a']:>15}  {r['log_ratio']:>10.6f}  {r['growth']:>10.6f}  {r['ratio_to_sylvester']:>10.4f}")
    
    # Key diagnostic: is log_ratio increasing or decreasing?
    if len(results) >= 4:
        last_3 = [r['log_ratio'] for r in results[-3:]]
        trend = "INCREASING ⚠️" if last_3[-1] > last_3[-2] > last_3[-3] else \
                "DECREASING ✓" if last_3[-1] < last_3[-2] < last_3[-3] else \
                "MIXED"
        print(f"  Trend (last 3): {trend}")
        print(f"  Final log/2^k = {results[-1]['log_ratio']:.8f}")
    print()

# Now the critical test: what happens with VERY large targets?
print("\n" + "="*70)
print("SCALING TEST: Does larger S1 help sustain growth?")
print("="*70)

for S1_num in [10, 50, 100, 500]:
    S1 = Fraction(S1_num, 1)
    S2 = S1 * 2  # generous gap
    results = coupled_greedy_full(S1, S2, max_steps=30)
    
    if len(results) >= 5:
        final_lr = results[-1]['log_ratio']
        max_lr = max(r['log_ratio'] for r in results)
        n_terms = len(results)
        print(f"  S1={S1_num}: {n_terms} terms, max log/2^k = {max_lr:.6f}, final = {final_lr:.6f}")
