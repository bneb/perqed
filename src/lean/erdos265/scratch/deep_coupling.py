#!/usr/bin/env python3
"""
Deep analysis: What does the coupling identity force?

The coupling identity says:
  q₁·R_shift(N)·P₁(N) - q₂·R₁(N)·P₂(N) = bounded

Dividing by P₁(N):
  q₁·R_shift(N) - q₂·R₁(N)·(P₂(N)/P₁(N)) = O(1/P₁(N))

So: R_shift(N)/R₁(N) ≈ q₂·(P₂(N)/P₁(N))/q₁

Since R_shift, R₁ are bounded integers, the ratio R_shift/R₁ takes
finitely many values. This means P₂/P₁ must track one of finitely
many rational numbers, with error O(1/P₁).

Now P₂(N)/P₁(N) = P₂(N-1)/P₁(N-1) · (a_{N-1}-1)/a_{N-1}.
So the "transition" from step N-1 to N multiplies the ratio by (a_{N-1}-1)/a_{N-1}.

If R_shift(N)/R₁(N) must equal R_shift(N-1)/R₁(N-1) · (a_{N-1}-1)/a_{N-1} · (R₁(N-1)/R₁(N)) · (R_shift(N)/R_shift(N-1))...

The question: does this finite-state constraint force a_{N} to eventually be Sylvester-like?
"""
import sys
sys.set_int_max_str_digits(1000000)
from fractions import Fraction

def sylvester(n, cache={}):
    if n in cache: return cache[n]
    if n == 0: cache[0] = 2; return 2
    prev = sylvester(n-1, cache)
    cache[n] = prev**2 - prev + 1
    return cache[n]

def analyze_ratio_tracking(name, a, n_terms):
    print(f"\n=== {name} ===")
    extra = 3
    S1 = sum(Fraction(1, a(k)) for k in range(n_terms + extra))
    S2 = sum(Fraction(1, a(k) - 1) for k in range(n_terms + extra))
    q1, q2 = S1.denominator, S2.denominator
    
    def R1(N):
        P1 = 1
        for k in range(N): P1 *= a(k)
        partial = sum(Fraction(1, a(k)) for k in range(N))
        return Fraction(q1) * P1 * (S1 - partial)
    
    def Rshift(N):
        P2 = 1
        for k in range(N): P2 *= (a(k) - 1)
        partial = sum(Fraction(1, a(k) - 1) for k in range(N))
        return Fraction(q2) * P2 * (S2 - partial)
    
    P2_over_P1 = Fraction(1)
    
    for N in range(n_terms):
        r1 = R1(N)
        rs = Rshift(N)
        
        ratio = rs / r1  # R_shift/R₁
        predicted = Fraction(q2) * P2_over_P1 / Fraction(q1)  # q₂·(P₂/P₁)/q₁
        
        # The coupling says ratio ≈ predicted
        error = ratio - predicted
        
        # Transition: what does a_N do to the ratio?
        if N > 0:
            transition = Fraction(a(N-1) - 1, a(N-1))  # (a_{N-1}-1)/a_{N-1}
        else:
            transition = Fraction(1)
        
        print(f"  N={N}: a_N={a(N)}, R_shift/R₁={float(ratio):.6f}, "
              f"predicted={float(predicted):.6f}, error={float(error):.2e}, "
              f"R₁={int(r1)}, R_shift={int(rs)}")
        
        # Update P₂/P₁
        if N < n_terms - 1:
            P2_over_P1 *= Fraction(a(N) - 1, a(N))
    
    # Key insight: for what values of a_N is the next R_shift/R₁ ratio
    # still a ratio of bounded integers?
    print(f"\n  Allowed R_shift/R₁ ratios (r_s/r_1 where r_s ∈ [1,{q2}], r_1 ∈ [1,{q1}]):")
    print(f"  There are at most {q1}·{q2} = {q1*q2} possible ratios")
    if q1 * q2 < 100:
        ratios = sorted(set(Fraction(rs, r1) for rs in range(1, q2+1) for r1 in range(1, q1+1)))
        print(f"  Distinct ratios: {len(ratios)}")
        if len(ratios) <= 20:
            for r in ratios:
                print(f"    {r} = {float(r):.6f}")

analyze_ratio_tracking("Sylvester", sylvester, 6)

# Test with a simple sequence to see if q1, q2 are small enough to enumerate
# Use a sequence where sums happen to be rational with small denominators
# The simplest: a geometric-ish sequence
print("\n=== KEY FINDING ===")
print("For Sylvester:")
print("  S1 = 1 = 1/1, so q1 = 1 (after reduction)")
print("  S2 = ∑ 1/(aₖ-1) ≈ 1.691... (this is NOT rational!)")
print()
print("WAIT: For Sylvester, S2 is IRRATIONAL. That's the whole point of")
print("negative_resolution.lean! So Sylvester is NOT an Erdős 265 sequence.")
print()
print("An Erdős 265 sequence (if it exists with limsup > 1) must have")
print("BOTH sums rational. We don't know any concrete examples, so we")
print("can't test numerically. The coupling argument must work abstractly.")
