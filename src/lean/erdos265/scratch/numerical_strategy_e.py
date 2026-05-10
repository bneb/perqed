#!/usr/bin/env python3
"""
Erdős 265: Numerical experiments for Strategy E.

Tests whether oscillatory sequences (limsup > 1) can have both sums
approximately rational, and tracks R₁(N) growth to inform E.α.
"""
from fractions import Fraction
from math import gcd, log2, sqrt
import itertools

def R1(a_seq, p, q, N):
    """Compute R₁(N) = q · ∏_{k<N} a_k · (p/q - Σ_{k<N} 1/a_k)"""
    prod_val = Fraction(1)
    partial_sum = Fraction(0)
    for k in range(N):
        prod_val *= a_seq[k]
        partial_sum += Fraction(1, a_seq[k])
    return q * prod_val * (Fraction(p, q) - partial_sum)

def R_shift(a_seq, p2, q2, N):
    """Compute R_shift(N) = q₂ · ∏_{k<N}(a_k-1) · (p₂/q₂ - Σ_{k<N} 1/(a_k-1))"""
    prod_val = Fraction(1)
    partial_sum = Fraction(0)
    for k in range(N):
        prod_val *= (a_seq[k] - 1)
        partial_sum += Fraction(1, a_seq[k] - 1)
    return q2 * prod_val * (Fraction(p2, q2) - partial_sum)

def coupling_C(a_seq, p1, q1, p2, q2, N):
    """C(N) = R₁(N)·R_shift(N) + R₁(N)·R_shift(N+1) - R_shift(N)·R₁(N+1)"""
    r1_N = R1(a_seq, p1, q1, N)
    r1_N1 = R1(a_seq, p1, q1, N+1)
    rs_N = R_shift(a_seq, p2, q2, N)
    rs_N1 = R_shift(a_seq, p2, q2, N+1)
    return r1_N * rs_N + r1_N * rs_N1 - rs_N * r1_N1

def limsup_indicator(a_seq, k):
    """Compute a_k^{1/2^k}"""
    if a_seq[k] <= 0:
        return 0
    return a_seq[k] ** (1.0 / (2 ** k))

# ============================================================
# Experiment 1: Sylvester sequence (baseline, should show locking)
# ============================================================
print("=" * 70)
print("Experiment 1: Sylvester sequence (FastGrowth baseline)")
print("=" * 70)

sylvester = [2]
for i in range(12):
    a = sylvester[-1]
    sylvester.append(a * a - a + 1)

# Compute exact sums
S1 = sum(Fraction(1, a) for a in sylvester)
S2 = sum(Fraction(1, a - 1) for a in sylvester)
print(f"Partial S1 = {float(S1):.15f} (denom = {S1.denominator})")
print(f"Partial S2 = {float(S2):.15f} (denom = {S2.denominator})")
print(f"S1 ≈ {S1}")
print(f"S2 ≈ {S2}")

# Use S1 as "target" p/q for residual computation
p1, q1 = S1.numerator, S1.denominator
p2, q2 = S2.numerator, S2.denominator

print(f"\nR₁(N) and R_shift(N) for Sylvester:")
for N in range(min(8, len(sylvester))):
    r1 = R1(sylvester, p1, q1, N)
    rs = R_shift(sylvester, p2, q2, N)
    print(f"  N={N}: R₁={r1}, R_shift={rs}, a^(1/2^k)={limsup_indicator(sylvester, N):.4f}")

# ============================================================
# Experiment 2: Oscillatory sequence
# Build a sequence that sometimes takes big jumps and sometimes doesn't
# ============================================================
print("\n" + "=" * 70)
print("Experiment 2: Oscillatory sequence (big jump every other step)")
print("=" * 70)

# Start with a_0 = 2, then alternate between:
#   - "big jump": a_{k+1} = a_k^2 + 1 (faster than Sylvester)
#   - "small step": a_{k+1} = a_k + 1 (linear growth, NOT FastGrowth)
osc = [2]
for i in range(14):
    a = osc[-1]
    if i % 2 == 0:
        # Big jump
        osc.append(a * a + 1)
    else:
        # Small step - just increment
        osc.append(a + 1)

S1_osc = sum(Fraction(1, a) for a in osc)
S2_osc = sum(Fraction(1, a - 1) for a in osc)
p1o, q1o = S1_osc.numerator, S1_osc.denominator
p2o, q2o = S2_osc.numerator, S2_osc.denominator

print(f"Partial S1 = {float(S1_osc):.15f}")
print(f"Partial S2 = {float(S2_osc):.15f}")
print(f"q1 = {q1o} (digits: {len(str(q1o))})")
print(f"q2 = {q2o} (digits: {len(str(q2o))})")

print(f"\nR₁(N) and R_shift(N) for oscillatory:")
for N in range(min(10, len(osc))):
    r1 = R1(osc, p1o, q1o, N)
    rs = R_shift(osc, p2o, q2o, N)
    print(f"  N={N}: R₁={r1} ({len(str(r1.numerator))} digits), R_shift={rs} ({len(str(rs.numerator))} digits), a_N={osc[N]}, a^(1/2^N)={limsup_indicator(osc, N):.4f}")

# ============================================================
# Experiment 3: The coupling difference C(N+1) - C(N) 
# (for E.β telescoping strategy)
# ============================================================
print("\n" + "=" * 70)
print("Experiment 3: Coupling C(N) values and differences")
print("=" * 70)

# Use Sylvester for clean numbers
print("Sylvester sequence C(N):")
prev_C = None
for N in range(min(7, len(sylvester) - 1)):
    C_N = coupling_C(sylvester, p1, q1, p2, q2, N)
    diff = C_N - prev_C if prev_C is not None else None
    print(f"  N={N}: C(N)={C_N}, diff={diff}")
    prev_C = C_N

print("\nOscillatory sequence C(N):")
prev_C = None
for N in range(min(10, len(osc) - 1)):
    C_N = coupling_C(osc, p1o, q1o, p2o, q2o, N)
    diff = C_N - prev_C if prev_C is not None else None
    diff_str = f"{diff}" if diff is not None and len(str(diff.numerator)) < 40 else (f"({len(str(diff.numerator))} digits)" if diff is not None else None)
    C_str = f"{C_N}" if len(str(C_N.numerator)) < 40 else f"({len(str(C_N.numerator))} digits)"
    print(f"  N={N}: C(N)={C_str}, diff={diff_str}")
    prev_C = C_N

# ============================================================
# Experiment 4: Can R₁ grow unbounded in oscillatory case?
# Track R₁ as integer, check if it stays bounded
# ============================================================
print("\n" + "=" * 70)
print("Experiment 4: R₁ boundedness check")
print("=" * 70)

# More aggressive oscillation: very large jumps then resets
agg = [2]
for i in range(10):
    a = agg[-1]
    if i % 3 == 0:
        # Massive jump
        agg.append(a * a * a)
    elif i % 3 == 1:
        # Small
        agg.append(a + 1)
    else:
        # Medium
        agg.append(a * 2)

S1_agg = sum(Fraction(1, a) for a in agg)
S2_agg = sum(Fraction(1, a - 1) for a in agg)
p1a, q1a = S1_agg.numerator, S1_agg.denominator
p2a, q2a = S2_agg.numerator, S2_agg.denominator

print(f"Aggressive oscillatory sequence: {agg[:8]}...")
print(f"q1 has {len(str(q1a))} digits, q2 has {len(str(q2a))} digits")

print(f"\nR₁(N) growth:")
max_r1 = Fraction(0)
for N in range(min(8, len(agg))):
    r1 = R1(agg, p1a, q1a, N)
    if abs(r1) > max_r1:
        max_r1 = abs(r1)
    r1_over_q = float(r1) / q1a if q1a != 0 else 0
    print(f"  N={N}: |R₁|/q₁ = {r1_over_q:.6f}, a_N = {agg[N]}")

print(f"\nMax |R₁|/q₁ = {float(max_r1)/q1a:.6f}")
print(f"R₁ bounded by q₁? {'YES' if max_r1 <= q1a else 'NO'}")
