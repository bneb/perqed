#!/usr/bin/env python3
"""
Concrete test: Is C.3 true?

C.3 claims: if a_k >= alpha^{2^k} infinitely often (alpha > 1),
then a_{n+1} - 1 > q_n^2 infinitely often,
where q_n = denominator of partial sum of 1/(a_k - 1).

Test with concrete sequences near the boundary.
"""

from fractions import Fraction
from math import log2, ceil

def test_sequence(name, a, n_terms):
    """Test whether a_{n+1}-1 > q_n^2 ever holds."""
    print(f"\n=== {name} ===")
    partial_sum = Fraction(0)
    for n in range(n_terms):
        term = Fraction(1, a(n) - 1)
        partial_sum += term
        q_n = partial_sum.denominator
        
        if n + 1 < n_terms:
            a_next = a(n + 1)
            ratio = (a_next - 1) / (q_n ** 2) if q_n > 0 else float('inf')
            limsup_approx = a(n) ** (1 / 2**n) if n > 0 else a(0)
            exceeds = "YES" if a_next - 1 > q_n**2 else "no"
            print(f"  n={n}: a_n={a(n)}, a_{n+1}={a_next}, q_n={q_n}, "
                  f"q_n^2={q_n**2}, a_{n+1}-1={a_next-1}, exceeds={exceeds}, "
                  f"a_n^(1/2^n)={limsup_approx:.4f}")

# Sylvester sequence: a_{n+1} = a_n^2 - a_n + 1
def sylvester(n, cache={}):
    if n in cache: return cache[n]
    if n == 0: cache[0] = 2; return 2
    prev = sylvester(n-1, cache)
    cache[n] = prev**2 - prev + 1
    return cache[n]

test_sequence("Sylvester", sylvester, 6)

# Slightly faster than Sylvester: a_{n+1} = a_n^2
def fast_sq(n, cache={}):
    if n in cache: return cache[n]
    if n == 0: cache[0] = 3; return 3
    prev = fast_sq(n-1, cache)
    cache[n] = prev**2
    return cache[n]

test_sequence("a_{n+1} = a_n^2 (alpha=3)", fast_sq, 5)

# Barely doubly exponential: a_n = ceil(1.5^{2^n})
def barely_double_exp(n):
    return ceil(1.5 ** (2**n))

test_sequence("ceil(1.5^{2^n})", barely_double_exp, 8)

# Sparse spikes: mostly linear, occasional double-exp jumps
def sparse_spikes(n):
    if n % 5 == 0 and n > 0:  # spike every 5th term
        return ceil(2.0 ** (2**n))
    else:
        return 100 + n  # boring growth

test_sequence("Sparse spikes (every 5th)", sparse_spikes, 11)

# Key question: for the spike sequence, does the denominator
# grow so fast (from the spike terms) that non-spike a_{n+1}
# can never exceed q_n^2?
print("\n=== KEY ANALYSIS ===")
print("If a_k spikes at k=5,10,... but is ~100 elsewhere,")
print("the denominator q_n absorbs the spike via prod(a_k-1),")
print("making q_n^2 huge. Then a_{n+1} ~ 100 << q_n^2.")
print("So C.3 needs the SPIKE terms a_{n+1} to exceed q_n^2,")
print("not the non-spike terms.")
print("The question: at a spike index n_j, is a_{n_j+1} > q_{n_j}^2?")
