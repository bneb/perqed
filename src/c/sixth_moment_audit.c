/*
 * sixth_moment_audit.c — Is the sixth moment the right target?
 *
 * Red team found our earlier claim was wrong. Let's get this RIGHT.
 *
 * BUILD: cc -O3 -o sixth_moment_audit sixth_moment_audit.c -lm
 */
#include <stdio.h>
#include <math.h>

int main() {
    printf("# Sixth Moment of ζ: Rigorous Reevaluation\n\n");

    /* ═══════ WHAT IS ACTUALLY KNOWN ═══════ */
    printf("## 1. What Is Known About ∫|ζ(1/2+it)|^{2k} dt\n\n");

    printf("  EXACT results:\n");
    printf("    k=1: ∫₀ᵀ |ζ|² dt = T·logT + (2γ-1)T + O(T^{1/2})  [Hardy-Littlewood]\n");
    printf("    k=2: ∫₀ᵀ |ζ|⁴ dt ~ T·(logT)⁴/(2π²)                [Ingham 1926]\n");
    printf("    → Both have μ = 1 (the exponent of T is 1).\n\n");

    printf("  CONJECTURED (CFKRS 2005, from random matrix theory):\n");
    printf("    k=3: ∫|ζ|⁶ ~ c₃·T·(logT)⁹         → μ₃ = 1\n");
    printf("    k=4: ∫|ζ|⁸ ~ c₄·T·(logT)^{16}      → μ₄ = 1\n");
    printf("    General: μₖ = 1 for all k.\n\n");

    printf("  BEST PROVED UPPER BOUNDS (unconditional):\n");
    printf("    k=3: ∫|ζ|⁶ ≤ T^{2+ε}               [convexity, trivial]\n");
    printf("    Improved: various methods give μ₃ < 2, but NONE give μ₃ ≤ 4/3.\n\n");

    printf("  ⚠️  CRITICAL CORRECTION:\n");
    printf("  In our earlier analysis, we claimed 'GM proved μ₃ = 4/3'.\n");
    printf("  This is WRONG. GM proved a LARGE VALUES estimate:\n");
    printf("    |{t ∈ [0,T] : |F(σ+it)| > V}| ≤ bound\n");
    printf("  This is NOT the same as a moment bound.\n\n");

    printf("  The relationship:\n");
    printf("    Large values ≤ bound  ⟹  N(σ,T) ≤ T^{A(1-σ)+ε}  [directly]\n");
    printf("    Large values ≤ bound  ⟹  ∫|F|^{2k} ≤ bound'      [by integration]\n");
    printf("    ∫|F|^{2k} ≤ bound'   ⟹  Large values ≤ bound''  [by Markov]\n\n");
    printf("  The last step LOSES information (Markov is weak).\n");
    printf("  So: large values → moments (easy direction)\n");
    printf("  But: moments → large values (LOSSY direction)\n\n");

    /* ═══════ WHAT GM ACTUALLY PROVED ═══════ */
    printf("## 2. What Guth-Maynard Actually Proved (2024)\n\n");

    printf("  GM proved a LARGE VALUES ESTIMATE:\n");
    printf("  For Dirichlet polynomial F(s) = Σ_{n~N} aₙ n^{-s}:\n\n");
    printf("    |{t : |F(1/2+it)| > V}| ≤ C · N^{2+ε} / V^6\n\n");

    printf("  (This is the 'ℓ² decoupling' version. The precise statement\n");
    printf("   involves additive energy, but this is the key bound.)\n\n");

    printf("  Via Markov, this implies:\n");
    printf("    ∫|F|^6 ≤ ∫₀^V 6v⁵ · T dv + V^6 · C·N^{2+ε}/V^6\n");
    printf("           = T·V^6/6 + C·N^{2+ε}\n");
    printf("  Optimizing V: V^6·T ≈ N^{2+ε} → V ≈ (N²/T)^{1/6}\n");
    printf("    ∫|F|^6 ≤ N^{2+ε}  (for T ≤ N, Dirichlet poly regime)\n\n");

    printf("  For ζ(s) itself (not a finite Dirichlet poly):\n");
    printf("  The connection is more subtle. GM's bound applies to\n");
    printf("  DIRICHLET POLYNOMIALS, not directly to ζ(s).\n\n");

    /* ═══════ IS THE SIXTH MOMENT THE RIGHT TARGET? ═══════ */
    printf("## 3. Is 'Improve Sixth Moment' the Right Target?\n\n");

    printf("  ANSWER: NO (but it's related).\n\n");
    printf("  The correct target hierarchy:\n\n");
    printf("  ┌─────────────────────────────────────────────┐\n");
    printf("  │ Level 3: Goldbach (binary) for all even n≥4 │\n");
    printf("  │            ↑                                │\n");
    printf("  │ Level 2: Exceptional set E(N) ≤ N^{δ}      │\n");
    printf("  │            ↑                                │\n");
    printf("  │ Level 1: Zero-density A < 2                  │\n");
    printf("  │            ↑                                │\n");
    printf("  │ Level 0:                                     │\n");
    printf("  │   ┌── Large values estimate ──┐             │\n");
    printf("  │   │   (THE actual target)      │             │\n");
    printf("  │   └───────┬──────────┬────────┘             │\n");
    printf("  │        implies    implies                     │\n");
    printf("  │           ↓          ↓                       │\n");
    printf("  │     A < 30/13    μ₃ < 4/3                    │\n");
    printf("  │     (density)   (moment)                     │\n");
    printf("  │     [SIBLING]   [SIBLING]                    │\n");
    printf("  └─────────────────────────────────────────────┘\n\n");

    printf("  The LARGE VALUES ESTIMATE is the root node.\n");
    printf("  Both the zero-density exponent AND the moment bound\n");
    printf("  are consequences of improving it.\n\n");

    printf("  So: 'improve the sixth moment' is a WEAKER target than\n");
    printf("  'improve the large values estimate'. If we could improve\n");
    printf("  the LVE, we'd get BOTH μ₃ improvement AND A improvement.\n\n");

    printf("  But conversely: proving μ₃ < 4/3 doesn't give A < 30/13.\n");
    printf("  (The Markov step loses too much.)\n\n");

    /* ═══════ THE REAL QUESTION ═══════ */
    printf("## 4. The Correctly Formulated Question\n\n");

    printf("  WRONG: 'Can we prove ∫|ζ|^6 ≤ T^{μ+ε} for μ < 4/3?'\n");
    printf("  (This doesn't directly give A < 30/13, and the current\n");
    printf("   best μ₃ is ~2, not 4/3.)\n\n");

    printf("  RIGHT: 'Can we improve the large values estimate\n");
    printf("  |{t : |F(σ+it)| > V}| ≤ C·N^{α+ε}/V^β\n");
    printf("  beyond what GM proved?'\n\n");

    printf("  Specifically, GM proved (roughly):\n");
    printf("    |S(V)| ≤ (N²/V⁶)^{1+ε}  for V ≤ N^{1/3}\n\n");
    printf("  To improve: need either:\n");
    printf("    (a) Higher power of V in denominator: V^{6+δ}\n");
    printf("    (b) Lower power of N in numerator: N^{2-δ}\n");
    printf("    (c) Wider range of V: V ≤ N^{1/3+δ}\n\n");

    /* Compute what improvements are needed */
    printf("## 5. Quantifying the Target\n\n");
    printf("  GM's bound: |S(V)| ≤ N^{2}/V^6 (ignoring ε)\n\n");
    printf("  This gives A = 30/13 via the formula:\n");
    printf("    A = (numerator_exp + 6·(something)) / (something)\n\n");

    printf("  If we improve to: |S(V)| ≤ N^{2-δ}/V^6 for any δ > 0:\n");
    printf("    A' = A - f(δ) < A = 30/13\n\n");

    printf("  The improvement δ translates to A-improvement roughly as:\n");
    printf("  (This is model-dependent but indicative)\n\n");

    double A_GM = 30.0/13;
    printf("  %8s | %10s | %s\n", "δ (save)", "A'", "status");
    for (double delta = 0; delta <= 0.5; delta += 0.025) {
        /* Model: A ≈ 2(2-delta)/(2(2-delta)/3 - ...) */
        /* Simplified: A' ≈ A_GM · (2-delta)/2 */
        double A_new = A_GM * (2.0 - delta) / 2.0;
        printf("  %8.3f | %10.4f | %s\n", delta, A_new,
               A_new < 2.0 ? "★★ DH!" : A_new < A_GM ? "★ BEATS GM" : "");
    }

    /* ═══════ WHAT CAN WE ACTUALLY COMPUTE ═══════ */
    printf("\n## 6. What Can We Compute and SA-Search?\n\n");

    printf("  The large values estimate has THREE ingredients:\n\n");
    printf("  1. DECOMPOSITION: how to split F into pieces\n");
    printf("     → BD uses δ-caps on the parabola\n");
    printf("     → COULD use arithmetic-aware decomposition\n\n");
    printf("  2. ORTHOGONALITY: how to combine pieces\n");
    printf("     → BD uses ℓ² (Bessel's inequality)\n");
    printf("     → COULD use ℓ^p for other p (interpolation)\n\n");
    printf("  3. PIECE BOUNDS: how to bound each piece\n");
    printf("     → BD uses Gauss sum bounds (essentially: (1/6, 2/3))\n");
    printf("     → COULD exploit arithmetic of piece supports\n\n");

    printf("  SA-SEARCHABLE PARAMETERS:\n");
    printf("    - Scale δ: how fine the decomposition (continuous)\n");
    printf("    - p in ℓ^p: the combination exponent (continuous)\n");
    printf("    - Piece shape: rectangular vs. arithmetic (discrete)\n");
    printf("    - Case split thresholds: energy classification (continuous)\n\n");

    printf("  The ARITHMETIC PIECE BOUND is the novel idea:\n");
    printf("    Instead of Σ_{n∈piece} aₙ n^{-s} for n ∈ [N, N+Q],\n");
    printf("    use Σ_{n: n≡a mod q} aₙ n^{-s} (arithmetic piece).\n\n");
    printf("    For this piece: n^{-it} = a^{-it} · (n/a)^{-it}\n");
    printf("    and n/a ranges over integers → Euler product structure!\n\n");
    printf("    The Euler product gives MULTIPLICATIVE orthogonality\n");
    printf("    that's INVISIBLE to BD's additive decomposition.\n");

    return 0;
}
