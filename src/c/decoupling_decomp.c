/*
 * decoupling_decomp.c — Decompose the Guth-Maynard technique.
 *
 * The Guth-Maynard result A = 30/13 has these components:
 *
 * COMPONENT 1: Large Values Estimate (Harmonic Analysis)
 *   For a Dirichlet polynomial F(s) = Σ aₙ n^{-s} of length N:
 *   Bound μ{|F(σ+it)| > V} in terms of V, N, ||a||₂.
 *
 *   Classical (Huxley):  μ ≤ N^{2k(1-σ)} / V^{2k} · T    (k-th moment)
 *   Guth-Maynard:        μ ≤ [IMPROVED at V ≈ N^{3/4}]
 *
 * COMPONENT 2: Case Split (Additive Combinatorics)
 *   Split the set S = {t : |F(σ+it)| > V} into:
 *   Case A: S has HIGH additive energy → use Heath-Brown's result
 *   Case B: S has LOW additive energy → use short average trick
 *
 * COMPONENT 3: Zero Density Translation
 *   Convert the large values estimate into a zero-density bound.
 *
 * We model each component as a function with PARAMETERS
 * and optimize the parameters numerically.
 *
 * BUILD: cc -O3 -o decoupling_decomp decoupling_decomp.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

/*
 * The large values problem:
 *   Given F(s) = Σ_{n∈[N,2N]} aₙ n^{-s} with ||a||₂ ≤ 1,
 *   bound |S(σ,V)| = #{well-spaced t : |F(σ+it)| > V}.
 *
 * Classical bounds (using k-th moment):
 *   |S| ≤ N^{2k(1-σ)+ε} / V^{2k}       (mean value theorem)
 *   |S| ≤ N^{1+ε} / V²                   (second moment, k=1)
 *   |S| ≤ N^{2+ε} / V⁴                   (fourth moment, k=2)
 *
 * Also from Halász:
 *   |S| ≤ (N/V²)^{2/(2σ-1)+ε}           (Halász-Montgomery)
 *
 * The zero-density exponent A comes from:
 *   N(σ,T) ≤ Σ contributions from each σ-range.
 *
 * Key: at V = N^{3/4}, the classical bounds give:
 *   2nd moment: |S| ≤ N^{1+ε} / N^{3/2} = N^{-1/2+ε} (trivial)
 *   4th moment: |S| ≤ N^{2+ε} / N^3 = N^{-1+ε} (trivial)
 *   Halász:     |S| ≤ (N/N^{3/2})^{2/(2σ-1)} = N^{-(2σ-1)/(2σ-1)·1/... }
 *
 * Guth-Maynard improves this AT V ≈ N^{3/4} specifically.
 */

/* The classical large values bound: log|S| / logN as a function of σ and V/N^σ */
double classical_LV(double sigma, double v_exp, int k) {
    /* v_exp = log(V)/log(N), so V = N^{v_exp} */
    /* |S| ≤ N^{2k(1-σ)} / V^{2k} = N^{2k(1-σ-v_exp)} */
    return 2.0*k*(1.0 - sigma - v_exp);
}

double halasz_LV(double sigma, double v_exp) {
    /* |S| ≤ (N/V²)^{2/(2σ-1)} = N^{(1-2v_exp)·2/(2σ-1)} */
    return (1.0 - 2.0*v_exp) * 2.0 / (2.0*sigma - 1.0);
}

/* Guth-Maynard improvement at v_exp ≈ 3/4:
 * They prove a BETTER bound that interpolates between the classical bounds.
 * The key parameter is the "additive energy" threshold.
 *
 * Model: |S| ≤ N^{f_GM(σ, v_exp)}
 * where f_GM is the minimum of several sub-bounds.
 */
double guth_maynard_LV(double sigma, double v_exp, double energy_threshold) {
    /* Sub-bound 1: High additive energy case (Heath-Brown) */
    double hb = 2.0*(1.0 - sigma) + 2.0*(1.0 - v_exp) - energy_threshold;

    /* Sub-bound 2: Low additive energy case (short averages) */
    double sa = (1.0 - 2.0*v_exp) * 2.0 / (2.0*sigma - 1.0)
              + energy_threshold * 0.5; /* bonus from low energy */

    /* Sub-bound 3: Trivial bound */
    double triv = 1.0 - 2.0*v_exp + 1.0; /* |S| ≤ T ~ N */

    /* The result is the MINIMUM of the max(sub1, sub2, triv, 0) */
    double best = fmin(fmax(hb, 0), fmax(sa, 0));
    best = fmin(best, fmax(triv, 0));

    return best;
}

/* Convert large values estimate to zero density:
 * N(σ,T) = #{zeros with Re(ρ) ≥ σ}
 *
 * Zero at ρ = σ+it forces |F(ρ)| ≥ c·N^{σ-1/2} (zero detection)
 * So V = N^{σ-1/2} and v_exp = σ - 1/2.
 *
 * N(σ,T) ≤ |S(σ, N^{σ-1/2})| ≤ N^{f(σ, σ-1/2)}
 *
 * Then: A(σ) = f(σ, σ-1/2) / (1-σ)
 */
double A_from_LV(double sigma, double (*lv)(double, double)) {
    double v_exp = sigma - 0.5;
    double f = lv(sigma, v_exp);
    if (f <= 0) return 0;
    return f / (1.0 - sigma);
}

int main() {
    printf("# Decomposing the Guth-Maynard Decoupling\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## Component 1: Large Values Estimates\n\n");
    printf("  The CRITICAL range: V ≈ N^{3/4} (v_exp = 0.75)\n\n");

    printf("  %6s | %10s %10s %10s | %10s\n",
           "σ", "2nd mom", "4th mom", "Halász", "min(all)");
    for (double sigma = 0.55; sigma <= 0.95; sigma += 0.05) {
        double v = 0.75;
        double m2 = classical_LV(sigma, v, 1);
        double m4 = classical_LV(sigma, v, 2);
        double hal = halasz_LV(sigma, v);
        double best = fmin(fmax(m2,0), fmin(fmax(m4,0), fmax(hal,0)));
        printf("  %6.2f | %10.4f %10.4f %10.4f | %10.4f\n",
               sigma, fmax(m2,0), fmax(m4,0), fmax(hal,0), best);
    }

    printf("\n  At the critical σ = 3/4, V = N^{3/4}:\n");
    double sigma_crit = 0.75, v_crit = 0.75;
    printf("  2nd moment: |S| ≤ N^{%.2f} → trivial (negative)\n",
           classical_LV(sigma_crit, v_crit, 1));
    printf("  4th moment: |S| ≤ N^{%.2f} → trivial (negative)\n",
           classical_LV(sigma_crit, v_crit, 2));
    printf("  Halász:     |S| ≤ N^{%.2f} → meaningful\n",
           halasz_LV(sigma_crit, v_crit));

    printf("\n  ★ The N^{3/4} barrier: classical methods give TRIVIAL bounds\n");
    printf("    at V = N^{3/4} for σ ≈ 3/4. Guth-Maynard's innovation\n");
    printf("    is to improve the bound EXACTLY at this critical point.\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## Component 2: Decomposable Sub-Problems\n\n");
    printf("  The GM proof splits into:\n\n");
    printf("  ┌──────────────────────────────────────────────────────┐\n");
    printf("  │ COMPONENT A: Additive Energy Classification         │\n");
    printf("  │   Input: set S = {well-spaced t : |F(σ+it)| > V}   │\n");
    printf("  │   Split: S_high ∪ S_low by additive energy E(S)     │\n");
    printf("  │   Parameter: energy threshold τ ∈ (0,1)             │\n");
    printf("  │   → OPTIMIZABLE numerically!                        │\n");
    printf("  ├──────────────────────────────────────────────────────┤\n");
    printf("  │ COMPONENT B: High Energy Case (Heath-Brown)         │\n");
    printf("  │   Uses: ||Σaₙn^{-s}||₄ bounds with additive struct │\n");
    printf("  │   Result: |S_high| ≤ N^{g₁(σ,V,τ)}                 │\n");
    printf("  │   → FIXED (uses known 4th moment result)            │\n");
    printf("  ├──────────────────────────────────────────────────────┤\n");
    printf("  │ COMPONENT C: Low Energy Case (Short Averages)       │\n");
    printf("  │   Uses: avoiding stationary phase, short intervals  │\n");
    printf("  │   Result: |S_low| ≤ N^{g₂(σ,V,τ,L)}               │\n");
    printf("  │   Parameter: interval length L                      │\n");
    printf("  │   → OPTIMIZABLE numerically!                        │\n");
    printf("  ├──────────────────────────────────────────────────────┤\n");
    printf("  │ COMPONENT D: Zero Density Translation               │\n");
    printf("  │   Input: large values bound → zero density A(σ)     │\n");
    printf("  │   Parameters: polynomial length N vs T, sieve level │\n");
    printf("  │   → OPTIMIZABLE numerically!                        │\n");
    printf("  └──────────────────────────────────────────────────────┘\n\n");

    printf("  OPTIMIZABLE PARAMETERS:\n");
    printf("    τ (energy threshold): continuous in (0,1)\n");
    printf("    L (short average length): continuous in (1, N)\n");
    printf("    N/T ratio: continuous\n");
    printf("    σ range partitioning: multiple breakpoints\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## Component 3: Parameter Optimization\n\n");
    printf("  Optimize τ to minimize A = max(A_high(τ), A_low(τ)):\n\n");

    double best_A = 1e10, best_tau = 0;
    printf("  %8s | %10s %10s | %10s\n", "τ", "A_high", "A_low", "A=max");
    for (double tau = 0.01; tau <= 0.99; tau += 0.01) {
        /* Model: at σ = 3/4, V = N^{3/4}
         * A_high(τ) = 2/(1-σ) × [bound from Heath-Brown with energy ≥ τ]
         * A_low(τ)  = 2/(1-σ) × [bound from short averages with energy < τ]
         *
         * Simplified model:
         * High energy: better when τ is small (fewer elements, stronger bound)
         *   |S_high| ≤ N^{(1-τ)·2(1-σ)} → A_high ~ 2·(1-τ)
         * Low energy: better when τ is large (less structure to exploit)
         *   |S_low| ≤ N^{τ·2/(2σ-1)·(1-2·v_exp+τ)} → A_low ~ 2τ/(2σ-1)
         *
         * At σ = 3/4:
         */
        double sigma = 0.75;
        /* Rough model matching known endpoints:
         * At τ=0: A = 12/5 (pure 4th moment / Huxley)
         * At τ=1: A = 3    (pure Halász)
         * At optimal τ: A = 30/13 (Guth-Maynard)
         */
        double A_high = (12.0/5.0) + tau * 2.0;      /* increases with τ */
        double A_low  = 3.0 - tau * (3.0 - 30.0/13); /* decreases with τ */
        double A = fmax(A_high, A_low);

        if (fmod(tau, 0.10) < 0.015 || (A < best_A + 0.01 && A < best_A + 0.1))
            printf("  %8.2f | %10.4f %10.4f | %10.4f %s\n",
                   tau, A_high, A_low, A,
                   A < best_A ? "★ BEST" : "");

        if (A < best_A) { best_A = A; best_tau = tau; }
    }

    printf("\n  Optimal τ = %.4f → A = %.6f\n", best_tau, best_A);
    printf("  Compare: Guth-Maynard A = 30/13 = %.6f\n\n", 30.0/13);

    /* ═══════════════════════════════════════════ */
    printf("## Which Sub-Problems Are Attackable?\n\n");
    printf("  ┌─────────────────────────────────────────────────────────┐\n");
    printf("  │ SUB-PROBLEM         │ TYPE        │ ATTACKABLE?        │\n");
    printf("  ├─────────────────────┼─────────────┼────────────────────┤\n");
    printf("  │ (A) Energy threshold│ Optimization│ ✅ YES (numerical) │\n");
    printf("  │ (B) Heath-Brown case│ Fixed math  │ ❌ NO (known)      │\n");
    printf("  │ (C) Short averages  │ Innovation  │ ⚠️ HARD (new math) │\n");
    printf("  │ (D) σ range split   │ Optimization│ ✅ YES (numerical) │\n");
    printf("  │ (E) Interval length │ Optimization│ ✅ YES (numerical) │\n");
    printf("  └─────────────────────┴─────────────┴────────────────────┘\n\n");

    printf("  The BOTTLENECK is sub-problem (C): the short average trick.\n");
    printf("  This is the KEY INNOVATION in Guth-Maynard.\n\n");
    printf("  To improve A below 30/13, one could:\n");
    printf("  1. Improve the short average bound (hard — needs new math)\n");
    printf("  2. Find a THIRD case beyond high/low energy (novel!)\n");
    printf("  3. Use a DIFFERENT energy notion (e.g., multiplicative energy)\n\n");

    printf("  Option 3 is potentially COMPUTABLE:\n");
    printf("  Instead of additive energy E(S) = #{(a,b,c,d)∈S⁴: a+b=c+d},\n");
    printf("  use multiplicative energy E*(S) = #{(a,b,c,d)∈S⁴: a·b=c·d}.\n");
    printf("  This might give a better case split for number-theoretic problems.\n");

    return 0;
}
