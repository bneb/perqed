#!/usr/bin/env python3
"""
Erdős 265: Can limsup a_k^{1/2^k} > 1 with both sums rational?

This script tries to BUILD a counterexample by running a coupled greedy
algorithm targeting specific rational pairs (S1, S2), then measuring
the growth rate. If growth consistently throttles to limsup ≤ 1,
that's evidence the conjecture is TRUE.
"""

from fractions import Fraction
import math

def coupled_greedy(S1_target, S2_target, max_steps=30):
    """
    Build a sequence by greedy algorithm: at each step choose the smallest
    integer a_n ≥ 2 (and > a_{n-1}) such that:
      1/a_n ≤ remaining S1 budget
      1/(a_n - 1) ≤ remaining S2 budget

    Returns list of (a_n, growth_ratio) where growth_ratio = a_n^{1/2^n}.
    """
    T1 = Fraction(S1_target)  # remaining S1
    T2 = Fraction(S2_target)  # remaining S2
    seq = []
    prev_a = 1  # for strict monotonicity
    
    for n in range(max_steps):
        if T1 <= 0 or T2 <= 0:
            break
        
        # Greedy: smallest a such that 1/a ≤ T1 AND 1/(a-1) ≤ T2 AND a > prev_a
        # 1/a ≤ T1  =>  a ≥ ceil(1/T1)
        # 1/(a-1) ≤ T2  =>  a-1 ≥ ceil(1/T2)  =>  a ≥ ceil(1/T2) + 1
        
        a_min_1 = int(math.ceil(1 / float(T1)))
        a_min_2 = int(math.ceil(1 / float(T2))) + 1
        a = max(a_min_1, a_min_2, prev_a + 1)
        
        # Verify exact arithmetic
        if Fraction(1, a) > T1 or Fraction(1, a - 1) > T2:
            a += 1
        if Fraction(1, a) > T1 or Fraction(1, a - 1) > T2:
            break
            
        T1 -= Fraction(1, a)
        T2 -= Fraction(1, a - 1)
        
        if n > 0:
            growth = float(a) ** (1.0 / 2**n)
        else:
            growth = float(a)
        
        seq.append((n, a, growth, float(T1), float(T2)))
        prev_a = a
    
    return seq

def try_with_waste(S1_target, S2_target, waste_at=None, waste_factor=2, max_steps=25):
    """
    Like coupled_greedy but at specified steps, choose a LARGER a_n
    (introducing waste) to see if we can steer the second sum toward rational.
    """
    T1 = Fraction(S1_target)
    T2 = Fraction(S2_target)
    seq = []
    prev_a = 1
    
    for n in range(max_steps):
        if T1 <= 0 or T2 <= 0:
            break
        
        a_min_1 = int(math.ceil(1 / float(T1)))
        a_min_2 = int(math.ceil(1 / float(T2))) + 1
        a = max(a_min_1, a_min_2, prev_a + 1)
        
        # Introduce waste at specified steps
        if waste_at and n in waste_at:
            a = max(a, int(a * waste_factor))
        
        if Fraction(1, a) > T1 or Fraction(1, a - 1) > T2:
            a += 1
        if Fraction(1, a) > T1 or Fraction(1, a - 1) > T2:
            break
            
        T1 -= Fraction(1, a)
        T2 -= Fraction(1, a - 1)
        
        growth = float(a) ** (1.0 / 2**n) if n > 0 else float(a)
        seq.append((n, a, growth, float(T1), float(T2)))
        prev_a = a
    
    return seq

def analyze_sequence(seq, label=""):
    """Print growth analysis."""
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    print(f"{'k':>3} {'a_k':>20} {'a_k^(1/2^k)':>15} {'log(a_k)/2^k':>15}")
    print(f"{'-'*55}")
    for n, a, growth, t1, t2 in seq:
        log_ratio = math.log(a) / 2**n if a > 1 else 0
        print(f"{n:>3} {a:>20} {growth:>15.6f} {log_ratio:>15.6f}")
    
    if len(seq) > 1:
        last_n, last_a, last_g, _, _ = seq[-1]
        print(f"\nFinal: a_{last_n} = {last_a}")
        print(f"log(a_{last_n})/2^{last_n} = {math.log(last_a)/2**last_n:.8f}")
        print(f"a_{last_n}^(1/2^{last_n}) = {last_g:.8f}")
        
        # Check ratio of consecutive terms
        print(f"\nGrowth ratios a_{n+1}/a_n^2:")
        for i in range(1, len(seq)):
            _, a_prev, _, _, _ = seq[i-1]
            _, a_curr, _, _, _ = seq[i]
            if a_prev > 1:
                ratio = a_curr / (a_prev * (a_prev - 1))
                print(f"  a_{seq[i][0]}/a_{seq[i-1][0]}(a_{seq[i-1][0]}-1) = {ratio:.6f}")

# ============================================================
# EXPERIMENT 1: Pure greedy for various rational targets
# ============================================================
print("EXPERIMENT 1: Pure coupled greedy")
print("If limsup > 1 is achievable, greedy should find it.")

targets = [
    (Fraction(3, 2), Fraction(5, 2)),
    (Fraction(7, 4), Fraction(13, 4)),
    (Fraction(2, 1), Fraction(4, 1)),
    (Fraction(5, 3), Fraction(3, 1)),
]

for S1, S2 in targets:
    if S2 > S1:  # S2 > S1 always since 1/(x-1) > 1/x
        seq = coupled_greedy(S1, S2, max_steps=20)
        if seq:
            analyze_sequence(seq, f"S1={S1}, S2={S2}")

# ============================================================
# EXPERIMENT 2: What does the Sylvester sequence look like?
# ============================================================
print("\n\nEXPERIMENT 2: Pure Sylvester sequence (for comparison)")
print("This has limsup ≈ 1.264 but irrational shifted sum.")

sylvester = [2]
for i in range(12):
    a = sylvester[-1]
    sylvester.append(a * (a - 1) + 1)

print(f"\n{'k':>3} {'log10(a_k)':>15} {'a_k^(1/2^k)':>15} {'log/2^k':>15}")
for k, a in enumerate(sylvester[:13]):
    log_a = math.log(a)
    lr = log_a / 2**k
    g = math.exp(lr)
    log10_a = math.log10(a)
    print(f"{k:>3} {log10_a:>15.2f} {g:>15.6f} {lr:>15.6f}")

# ============================================================
# EXPERIMENT 3: Try to construct a "fast" Erdős 265 sequence
# by choosing targets that leave room for fast growth
# ============================================================
print("\n\nEXPERIMENT 3: Attempt fast-growing Erdős 265 sequence")
print("Strategy: pick rational targets, try to exceed Sylvester growth")

# The sum of 1/a_k for Sylvester starting at 2 is 1.
# The sum of 1/(a_k - 1) for Sylvester starting at 2 is ≈ 1.707...
# Let's try targets near these values but both rational.

for S1, S2 in [(Fraction(1,1), Fraction(17,10)), 
               (Fraction(1,1), Fraction(7,4)),
               (Fraction(1,1), Fraction(2,1))]:
    seq = coupled_greedy(S1, S2, max_steps=15)
    if seq:
        analyze_sequence(seq, f"Near-Sylvester: S1={S1}, S2={S2}")

# ============================================================
# EXPERIMENT 4: Key diagnostic — track R1 and R_shift
# ============================================================
print("\n\nEXPERIMENT 4: R₁ and R_shift dynamics")
print("R₁ = q₁·P₁·T₁, R_shift = q₂·P₂·T₂")

S1 = Fraction(1, 1)
S2 = Fraction(7, 4)
q1, q2 = S1.denominator, S2.denominator
T1, T2 = S1, S2
P1, P2 = Fraction(1), Fraction(1)
prev_a = 1

print(f"\nTarget: S1={S1}, S2={S2}")
print(f"{'k':>3} {'a_k':>12} {'R1':>12} {'R_shift':>12} {'C(N)':>15} {'D(N)':>15}")

for n in range(15):
    if T1 <= 0 or T2 <= 0:
        break
    
    R1 = q1 * P1 * T1
    R_shift = q2 * P2 * T2
    C_N = q1 * R_shift * P1 - q2 * R1 * P2
    D_N = C_N / (P1 * P2) if P1 * P2 != 0 else 0
    
    a_min_1 = int(math.ceil(1 / float(T1)))
    a_min_2 = int(math.ceil(1 / float(T2))) + 1
    a = max(a_min_1, a_min_2, prev_a + 1)
    
    if Fraction(1, a) > T1 or Fraction(1, a - 1) > T2:
        a += 1
    if Fraction(1, a) > T1 or Fraction(1, a - 1) > T2:
        break
    
    print(f"{n:>3} {a:>12} {float(R1):>12.4f} {float(R_shift):>12.4f} {float(C_N):>15.4f} {float(D_N):>15.8f}")
    
    T1 -= Fraction(1, a)
    T2 -= Fraction(1, a - 1)
    P1 *= a
    P2 *= (a - 1)
    prev_a = a

print("\n\nDone. Check whether any sequence achieves a_k^{1/2^k} > 1 persistently.")
