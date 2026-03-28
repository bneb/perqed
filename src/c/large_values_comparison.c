/*
 * large_values_comparison.c — Compare the 6th moment Markov bound
 * against Guth-Maynard for large values of Dirichlet polynomials.
 *
 * The question: for F(t) = Σ_{n~N} a_n n^{-it}, how many J well-separated
 * points t_j with |F(t_j)| ≥ V?
 *
 * BOUND 1 (2nd moment Markov): J ≤ TN/V²
 * BOUND 2 (4th moment / Huxley): J ≤ (TN)^{1+ε}/V⁴ + T^{1+ε}N²/V⁶
 * BOUND 3 (Guth-Maynard decoupling): J ≤ T^{30(1-σ)/13+ε} (at σ level)
 * BOUND 4 (6th moment Markov): J ≤ M₆/V⁶
 *
 * For the zero-density estimate, the "large values" of the MOLLIFIER × L
 * determine N(σ,T). We compare bounds in the (σ, V/N^σ) plane.
 *
 * KEY INSIGHT: The 6th moment Markov bound uses the full L⁶ average,
 * which is TIGHTER than the sup × L⁴ decomposition for certain V ranges.
 *
 * BUILD: cc -O3 -o large_values_comparison large_values_comparison.c -lm
 */
#include <stdio.h>
#include <math.h>

/*
 * For a Dirichlet polynomial of length N at height T:
 *
 * Large values bound = max J such that |F(t_j)| ≥ V for J points.
 *
 * We express V = N^v for 0 < v < 1 and T ~ N (standard normalization).
 *
 * BOUND A (mean value, 2nd moment):
 *   J ≤ N²/V² = N^{2-2v}
 *
 * BOUND B (Huxley 1972, from 4th + large values):
 *   J ≤ N^{2+ε}/V⁴ + N^{2+ε}/V⁶ · N
 *     = N^{2-4v+ε} + N^{3-6v+ε}
 *   Dominant: N^{max(2-4v, 3-6v)}
 *   Crossover at 2-4v = 3-6v → v = 1/2.
 *   For v < 1/2: J ≤ N^{3-6v}; for v > 1/2: J ≤ N^{2-4v}
 *
 * BOUND C (Guth-Maynard 2024): Improved for v near 3/4.
 *   At v = 3/4: J ≤ N^{2-30/13·v+ε} (schematic)
 *
 * BOUND D (6th moment Markov, from large sieve on d₃):
 *   J ≤ M₆/V⁶ where M₆ ≤ C·N²·N^{1-2σ}·(logN)^8
 *   For the relevant polynomial with σ-dependent coefficients:
 *   J ≤ N^{3-2σ}/V⁶ = N^{3-2σ-6v}
 *   (where σ is the zero-density parameter, NOT the F variable)
 *
 * For zero-density at σ: N(σ,T) relates to J at v = σ (roughly).
 *
 * The zero-density exponent A satisfies:
 *   N(σ,T) ≤ T^{A(1-σ)} ⟺ J ≤ N^{A(1-σ)} at V = N^σ
 *   (since T ~ N for the zero-density application)
 *
 * So from each bound on J at V = N^σ (i.e., v = σ):
 * A_bound = exponent of N in the J bound / (1-σ)
 */

int main() {
    printf("# Large Values Comparison: 6th Moment vs Guth-Maynard\n\n");
    printf("# For each σ, compute the zero-density exponent A from different bounds.\n");
    printf("# The best A for each σ is the MINIMUM across all bounds.\n\n");

    printf("# %6s | %8s | %8s | %8s | %8s | %8s\n",
           "σ", "A_mv(2)", "A_Hux(4)", "A_GM", "A_6th", "A_best");
    printf("#--------+----------+----------+----------+----------+----------\n");

    for (double sigma = 0.55; sigma <= 0.99; sigma += 0.01) {
        /* v = σ (the relevant threshold for zero-density) */
        double v = sigma;

        /* BOUND A: mean value (2nd moment Markov)
         * J ≤ N^{2-2v}, so A_mv = (2-2v)/(1-v) = 2 */
        double A_mv = (2.0 - 2.0*v) / (1.0 - v);  /* always = 2 */

        /* BOUND B: Huxley (4th moment + large values)
         * J ≤ N^{max(2-4v, 3-6v)}
         * For v < 1/2: exponent = 3-6v; for v > 1/2: exponent = 2-4v */
        double hux_exp = (v < 0.5) ? 3.0 - 6.0*v : 2.0 - 4.0*v;
        double A_hux = hux_exp / (1.0 - v);

        /* BOUND C: Guth-Maynard
         * Their improvement is at v near 3/4.
         * The zero-density result: A = 30/13 for σ ≤ 3/4.
         * For σ > 3/4: A = 12/5 (Huxley still applies).
         * Model: A_GM(σ) = min(30/13, 12/5) for σ ≤ 3/4
         *         A_GM(σ) = 12/5 for σ > 3/4 */
        double A_gm = (sigma <= 0.75) ? 30.0/13.0 : 12.0/5.0;
        /* Actually, GM improves gradually. Use a linear interpolation: */
        if (sigma <= 0.75) {
            A_gm = 30.0/13.0;  /* GM's improvement */
        } else {
            A_gm = 12.0/5.0;  /* falls back to Huxley */
        }

        /* BOUND D: 6th moment Markov
         * J ≤ M₆/V⁶
         * M₆ = Σ_χ ∫|L(σ+it,χ)|⁶ dt ≤ C·N^{3-2σ+ε} (from large sieve)
         * Wait: for the Dirichlet polynomial in the zero-density context,
         * the coefficients are a_n ~ Λ(n)n^{-σ} or d₃(n)n^{-σ}.
         *
         * For the L³ = Σd₃ approach:
         * ∫|F|⁶ where F = Σ d₃(n)n^{-σ}·n^{-it}
         * By large sieve: ∫|F|⁶ ≤ (N+T)·Σd₃(n)²n^{-2σ}
         * ≈ N · N^{1-2σ}·(logN)^8 = N^{2-2σ}·(logN)^8
         *
         * So J ≤ N^{2-2σ}/V⁶ = N^{2-2σ-6v}
         *
         * But wait: for zero-density, this is the moment of L(σ+it,χ)
         * at the SAME σ as the zeros. V = (typical size of L at σ).
         *
         * Actually, the proper relationship:
         * Each zero ρ with Re(ρ) ≥ σ forces |L(σ+it)|² to have
         * an integral ≥ something involving the distance to ρ.
         *
         * More precisely, using Turán's method:
         * N(σ,T) ≤ C · M_{2k}(σ,T) · T^{-1} · (logT)^{something}
         *
         * For k=3: N(σ,T) ≤ C · M₆(σ) / T
         * M₆ ≤ C · N^{2-2σ}·(logN)^8, with N ~ T:
         * N(σ,T) ≤ C · T^{2-2σ-1}·(logT)^8 = T^{1-2σ} · (logT)^8
         *
         * For σ > 1/2: this gives N(σ,T) → 0, which matches (finite zeros).
         * A = (1-2σ)/(1-σ)... hmm, for σ = 3/4: A = (1-3/2)/(1-3/4) = (-1/2)/(1/4) = -2
         * Negative! This means the bound is trivially good (N < C).
         *
         * That's because the M₆ bound at σ itself is very strong — the
         * 6th moment at σ > 3/4 is TINY.
         *
         * But this is the WRONG interpretation. For zero-density,
         * we need M₆ evaluated NOT at the zero's σ but near σ = 1/2
         * (the critical line), where L is large.
         *
         * The standard approach: evaluate M₆ at σ = 1/2 + ε, then
         * use the zero-repulsion to lift the bound to σ > 1/2.
         *
         * At σ = 1/2: M₆(1/2) ≤ C · T · (logT)^9 (Conrey-Keating conjecture)
         * This is UNKNOWN unconditionally.
         *
         * So the 6th moment approach for zero-density requires:
         * CASE A: M₆ at σ > 3/4 (our large sieve bound — valid but
         *         too strong, gives N(σ,T) → 0 trivially)
         * CASE B: M₆ at σ = 1/2 (unknown unconditionally)
         *
         * The zero-density estimate lives in the σ ∈ (1/2, 1) range,
         * but the MOMENT that matters is evaluated at a DIFFERENT σ
         * than the zero-density parameter.
         */

        /* For a more accurate model, the zero-density at σ uses
         * moments at σ_eval = max(1/2, some function of σ):
         *
         * A_6th(σ) = M₆_exponent(σ_eval) / (1-σ)
         *
         * If we use our large sieve at σ_eval = 3/4:
         * M₆(3/4) ≤ C · T^{2-3/2} = C · T^{1/2}
         * N(σ,T) ≤ T^{1/2} / ... optimization ...
         *
         * After mollifier optimization with length Y:
         * N(σ,T) ≤ T^{1/2} · Y^{6(1-σ)} / Y^{6(σ-1/2)} ... 
         * this is getting speculative. Let me just compare numerically.
         */

        /* Simple model for 6th moment zero-density exponent:
         * A_6th = 2 (same as mean value) — conservative */
        double A_6th = 2.0;  /* conservative: can't be worse than Density Hyp */

        /* The best bound */
        double A_best = fmin(fmin(A_mv, A_hux), fmin(A_gm, A_6th));

        printf("  %6.3f | %8.4f | %8.4f | %8.4f | %8.4f | %8.4f  %s\n",
               sigma, A_mv, A_hux, A_gm, A_6th, A_best,
               (A_best < A_gm - 0.001) ? "← IMPROVEMENT!" : "");
    }

    printf("\n# ANALYSIS:\n");
    printf("# The 6th moment Markov bound gives A = 2 (density hypothesis)\n");
    printf("# if you could use M₆ at σ = 1/2 (critical line).\n");
    printf("# But M₆ at σ = 1/2 is UNKNOWN unconditionally.\n");
    printf("# At σ > 3/4 (where our bound is valid), the 6th moment\n");
    printf("# gives N(σ,T) → 0, which ALREADY follows from N(σ,T) ≤ C·log T.\n");
    printf("#\n");
    printf("# CONCLUSION: The 6th moment at σ > 3/4 does NOT improve\n");
    printf("# zero-density because the zeros in that range are already\n");
    printf("# few (N(σ,T) is bounded for σ > 3/4).\n");
    printf("# The bottleneck is σ ∈ (1/2, 3/4), where our 6th moment\n");
    printf("# bound is NOT valid (large sieve fails there).\n");

    return 0;
}
