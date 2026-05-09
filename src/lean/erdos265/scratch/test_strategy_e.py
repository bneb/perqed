#!/usr/bin/env python3
"""Strategy E: Coupled residual system — exact integer arithmetic."""
import sys
sys.set_int_max_str_digits(1000000)
from fractions import Fraction

def sylvester(n, cache={}):
    if n in cache: return cache[n]
    if n == 0: cache[0] = 2; return 2
    prev = sylvester(n-1, cache)
    cache[n] = prev**2 - prev + 1
    return cache[n]

def analyze(name, a, n_terms):
    print(f"\n=== {name} ===")
    # Use enough terms for good approximation
    max_k = n_terms + 3
    S1 = sum(Fraction(1, a(k)) for k in range(max_k))
    S2 = sum(Fraction(1, a(k) - 1) for k in range(max_k))
    q1 = S1.denominator
    q2 = S2.denominator
    
    P1, P2 = 1, 1
    partial1, partial2 = Fraction(0), Fraction(0)
    
    for N in range(n_terms):
        tail1 = S1 - partial1
        tail2 = S2 - partial2
        R1 = Fraction(q1) * P1 * tail1
        R2 = Fraction(q2) * P2 * tail2
        
        # Check they're integers
        is_int_R1 = R1.denominator == 1
        is_int_R2 = R2.denominator == 1
        
        R1_int = int(R1) if is_int_R1 else "NOT INT"
        R2_int = int(R2) if is_int_R2 else "NOT INT"
        
        # The coupling: R2*q1*P1 - R1*q2*P2 should be bounded
        # But these are huge. Let's compute the ratio R1/R2 instead.
        if is_int_R1 and is_int_R2 and R2_int != 0:
            # Track the "compatibility number": a_N from each residual
            # From R1: a_N * R1(N) = R1(N+1) + q1 * P1_N
            # We don't know R1(N+1) yet, but we can check consistency
            pass
        
        print(f"  N={N}: a_N={a(N)}, R1={'int' if is_int_R1 else 'FRAC'}({R1_int}), "
              f"R2={'int' if is_int_R2 else 'FRAC'}({R2_int}), "
              f"R1 in [1,q1={q1}]? {'YES' if is_int_R1 and 1<=R1_int<=q1 else 'NO'}, "
              f"R2 in [1,q2={q2}]? {'YES' if is_int_R2 and 1<=R2_int<=q2 else 'NO'}")
        
        partial1 += Fraction(1, a(N))
        partial2 += Fraction(1, a(N) - 1)
        P1 *= a(N)
        P2 *= (a(N) - 1)

analyze("Sylvester (5 terms)", sylvester, 5)

# Non-Sylvester: a_{n+1} = a_n^2 + 1
def fast(n, cache={}):
    if n in cache: return cache[n]
    if n == 0: cache[0] = 3; return 3
    prev = fast(n-1, cache)
    cache[n] = prev**2 + 1
    return cache[n]

fast_cache = {}
analyze("a_{n+1}=a_n^2+1, a_0=3", lambda n: fast(n, fast_cache), 5)

# Key test: what happens with a sequence that has limsup > 1?
# Let's try a_n = ceil(alpha^{2^n}) for various alpha
from math import ceil

for alpha in [1.2, 1.5, 1.8]:
    cache = {}
    def make_seq(alpha_val):
        def seq(n, c={}):
            if n in c: return c[n]
            c[n] = max(2, ceil(alpha_val ** (2**n)))
            # Ensure strictly increasing
            if n > 0 and c[n] <= seq(n-1, c):
                c[n] = seq(n-1, c) + 1
            return c[n]
        return seq
    
    s = make_seq(alpha)
    try:
        analyze(f"ceil({alpha}^(2^n))", s, 5)
    except Exception as e:
        print(f"  Error: {e}")

print("\n=== OBSERVATION ===")
print("For Sylvester: S1 = 1 exactly (telescoping).")
print("For non-Sylvester fast-growing: S1 and S2 are NOT nice rationals.")
print("The key question: can S1 AND S2 both be rational for non-Sylvester?")
print("The coupled residual constrains this — R1 and R2 must BOTH be integers.")
