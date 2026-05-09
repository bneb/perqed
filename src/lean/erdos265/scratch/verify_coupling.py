#!/usr/bin/env python3
"""Verify the coupling identity algebraically with exact arithmetic."""
import sys
sys.set_int_max_str_digits(1000000)
from fractions import Fraction

def sylvester(n, cache={}):
    if n in cache: return cache[n]
    if n == 0: cache[0] = 2; return 2
    prev = sylvester(n-1, cache)
    cache[n] = prev**2 - prev + 1
    return cache[n]

def verify_coupling(name, a, n_terms):
    print(f"\n=== {name} ===")
    extra = 3
    S1 = sum(Fraction(1, a(k)) for k in range(n_terms + extra))
    S2 = sum(Fraction(1, a(k) - 1) for k in range(n_terms + extra))
    q1 = S1.denominator; p1 = S1.numerator
    q2 = S2.denominator; p2 = S2.numerator
    
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
    
    for N in range(n_terms):
        r1 = R1(N); r1n = R1(N+1)
        rs = Rshift(N); rsn = Rshift(N+1)
        
        # The identity: aₙ = (R1(N+1) + q1*P1(N)) / R1(N)
        #               aₙ-1 = (Rshift(N+1) + q2*P2(N)) / Rshift(N)
        # Subtracting: 1 = ... gives the coupling identity:
        # R1(N)*Rshift(N) = Rshift(N)*R1(N+1) + q1*Rshift(N)*P1(N) 
        #                 - R1(N)*Rshift(N+1) - q2*R1(N)*P2(N)
        # Rearranged:
        # q1*Rshift(N)*P1(N) - q2*R1(N)*P2(N) = R1(N)*Rshift(N) - Rshift(N)*R1(N+1) + R1(N)*Rshift(N+1)
        
        P1N = 1
        for k in range(N): P1N *= a(k)
        P2N = 1
        for k in range(N): P2N *= (a(k) - 1)
        
        LHS = q1 * rs * P1N - q2 * r1 * P2N
        RHS = r1 * rs - rs * r1n + r1 * rsn
        
        print(f"  N={N}: R1={int(r1)}, Rshift={int(rs)}, "
              f"LHS=RHS? {LHS == RHS}, "
              f"RHS={int(RHS)}, |RHS|≤3*q1*q2={abs(int(RHS)) <= 3*q1*q2}")

verify_coupling("Sylvester", sylvester, 5)

cache2 = {}
def fast(n, c=cache2):
    if n in c: return c[n]
    if n == 0: c[0] = 3; return 3
    c[n] = fast(n-1, c)**2 + 1; return c[n]
verify_coupling("a_{n+1}=a_n^2+1", fast, 4)
