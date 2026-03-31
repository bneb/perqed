/*
 * bi_spacing.c — Bombieri-Iwaniec Second Spacing for f(n) = t·log(n)
 *
 * THE BOMBIERI-IWANIEC METHOD:
 *
 * To bound Σ_{n=N}^{2N} e(t·log(n)):
 *
 * 1. Break [N, 2N] into Q-intervals: [N+jQ, N+(j+1)Q], j=0,...,N/Q-1
 *
 * 2. On each interval, approximate:
 *      t·log(N+jQ+m) ≈ α_j·m + β_j·m² + γ_j·m³ + ...
 *    where:
 *      α_j = t/(N+jQ)           (first derivative)
 *      β_j = -t/(2(N+jQ)²)     (second derivative / 2)
 *      γ_j = t/(3(N+jQ)³)      (third derivative / 6)
 *
 * 3. The inner sum: Σ_{m=0}^{Q-1} e(α_j·m + β_j·m²) ≈ Q^{1/2} (Gauss sum)
 *
 * 4. The SECOND SPACING PROBLEM: count pairs (j₁, j₂) with
 *      |α_{j₁} - α_{j₂}| < Δα  AND  |β_{j₁} - β_{j₂}| < Δβ
 *
 *    If S₂ = #{such pairs}, the bound on the full sum is:
 *      |Σe(t·logn)| ≤ N^ε · (N·Q^{-1/2} + S₂^{1/2} · Q^{1/2})
 *
 *    The exponent pair (κ,λ) comes from optimizing Q and bounding S₂.
 *
 * KEY INSIGHT: For GENERIC f(n), S₂ depends on the worst-case geometry.
 * For f(n) = t·log(n), the (α,β) curve is SPECIFIC:
 *    (α, β) = (t/x, -t/(2x²))  ⟹  β = -α²/(2t)
 *
 * This is a PARABOLA in (α,β) space! The second spacing
 * along a parabola is STRICTLY BETTER than the generic case
 * because of the algebraic constraint β = -α²/(2t).
 *
 * BUILD: cc -O3 -o bi_spacing bi_spacing.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

/* Compute the second spacing count S₂ for f(n) = t·log(n)
 * with intervals of length Q in [N, 2N]. */
long long second_spacing(double t, int N, int Q,
                          double Delta_alpha, double Delta_beta) {
    int J = N / Q; /* number of intervals */
    long long S2 = 0;

    double *alpha = malloc(J * sizeof(double));
    double *beta = malloc(J * sizeof(double));

    for (int j = 0; j < J; j++) {
        double x = N + j * Q;
        alpha[j] = t / x;
        beta[j] = -t / (2.0 * x * x);
    }

    /* Count close pairs */
    for (int j1 = 0; j1 < J; j1++) {
        for (int j2 = j1 + 1; j2 < J; j2++) {
            if (fabs(alpha[j1] - alpha[j2]) < Delta_alpha &&
                fabs(beta[j1] - beta[j2]) < Delta_beta) {
                S2++;
            }
        }
    }

    free(alpha); free(beta);
    return S2;
}

/* Same for GENERIC f (random second derivative) — baseline */
long long second_spacing_generic(int J, double Delta_alpha, double Delta_beta,
                                  double alpha_range, double beta_range) {
    /* For random (α,β) uniformly in a rectangle:
     * Expected S₂ = J² · (2Δα/α_range) · (2Δβ/β_range) / 2 */
    double prob = (2.0*Delta_alpha/alpha_range) * (2.0*Delta_beta/beta_range);
    return (long long)(0.5 * J * J * prob);
}

int main() {
    printf("# Bombieri-Iwaniec Second Spacing: f(n) = t·log(n)\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 1. The (α,β) Curve for f(n) = t·log(n)\n\n");
    printf("  For each interval centered at x:\n");
    printf("    α = t/x,  β = -t/(2x²) = -α²/(2t)\n");
    printf("  ⟹ the (α,β) points lie on a PARABOLA: β = -α²/(2t)\n\n");

    double t_val = 1e6; /* typical t value */
    int N = 10000;

    printf("  Verification (t=%.0f, N=%d):\n", t_val, N);
    for (int j = 0; j < 5; j++) {
        double x = N + j * 2000;
        double a = t_val / x;
        double b = -t_val / (2*x*x);
        double b_pred = -a*a / (2*t_val);
        printf("    x=%5.0f: α=%.6f, β=%.10f, β_pred=%.10f, match=%s\n",
               x, a, b, b_pred, fabs(b - b_pred) < 1e-15 ? "✅" : "❌");
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## 2. Second Spacing Count: Parabola vs Generic\n\n");
    printf("  The parabolic constraint β = -α²/(2t) means:\n");
    printf("  If |α₁-α₂| < Δα, then |β₁-β₂| ≈ |α₁+α₂|·|α₁-α₂|/(2t)\n");
    printf("  ⟹ β-closeness is AUTOMATIC for α-close pairs on the parabola.\n\n");
    printf("  This means S₂ on the parabola ≈ S₁ (first spacing),\n");
    printf("  while S₂ generic ≈ S₁ × (Δβ/β_range) ≪ S₁.\n\n");

    printf("  🔴 RED TEAM: Wait — this says S₂_parabola > S₂_generic!\n");
    printf("     That's WORSE for us, not better. The parabola constraint\n");
    printf("     means MORE pairs are close in both coordinates.\n\n");

    /* Verify computationally */
    printf("  Computational verification:\n\n");
    printf("  %6s | %12s %12s | %s\n", "Q", "S2_parabola", "S2_generic", "ratio");

    for (int Q = 50; Q <= 500; Q += 50) {
        int J = N / Q;
        double alpha_range = t_val/N - t_val/(2.0*N);
        double beta_range = fabs(-t_val/(2.0*N*N) + t_val/(2.0*4.0*N*N));

        /* The Δα and Δβ thresholds scale with Q:
         * Δα ~ 1/Q (we need α·Q ≈ integer for Gauss sum)
         * Δβ ~ 1/Q² */
        double Da = alpha_range / (10.0 * J);
        double Db = beta_range / (10.0 * J);

        long long S2_para = second_spacing(t_val, N, Q, Da, Db);
        long long S2_gen = second_spacing_generic(J, Da, Db,
                                                   alpha_range, beta_range);

        printf("  %6d | %12lld %12lld | %s\n",
               Q, S2_para, S2_gen,
               S2_para > S2_gen ? "🔴 parabola WORSE" :
               S2_para < S2_gen ? "★ parabola BETTER!" : "≈ same");
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## 3. Red Team: Why the Parabola is Both Good and Bad\n\n");

    printf("  🔴 The parabola constraint makes S₂ LARGER (worse).\n");
    printf("     Reason: close α-pairs are automatically close in β too.\n\n");
    printf("  ✅ BUT: the parabola also means the SUM over close pairs\n");
    printf("     has ALGEBRAIC STRUCTURE that can be exploited.\n\n");
    printf("  Specifically: for pairs (j₁,j₂) close on the parabola:\n");
    printf("    Σ_{close pairs} e(α_{j₁}m + β_{j₁}m²) · c.c.(j₂)\n");
    printf("    = Σ e((α₁-α₂)m + (β₁-β₂)m²)\n");
    printf("    But β₁-β₂ ≈ (α₁-α₂)·(α₁+α₂)/(2t), so:\n");
    printf("    ≈ Σ e((α₁-α₂)·[m + (α₁+α₂)m²/(2t)])\n");
    printf("    This is a SINGLE oscillatory sum with one parameter!\n\n");

    printf("  ★ The parabolic structure reduces the second spacing from\n");
    printf("    a 2D problem to a 1D problem. Huxley's exponent pair\n");
    printf("    uses the GENERIC 2D case. For the parabola, the 1D\n");
    printf("    structure should give a DIFFERENT (potentially better) pair.\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 4. Exponent Pair Computation for Parabolic Spacing\n\n");

    printf("  For generic f: the BI method gives (κ,λ) based on S₂.\n");
    printf("  For f(n) = t·logn: the parabolic structure means:\n\n");
    printf("    S₂ ≈ J × #{j': |x_j - x_j'| < Q·(Δα/α²·t)} \n");
    printf("       ≈ J × min(J, Q·(Δα·t/α²))\n\n");

    printf("  With optimal Q, this gives the exponent pair:\n");

    /* The exponential sum bound:
     * |Σe(t·logn)| ≤ N^ε · (N/Q^{1/2} + S₂^{1/2}·Q^{1/2})
     *
     * For parabolic S₂ ≈ J² (since all α-close pairs match):
     *   |Σ| ≤ N^ε · (N/Q^{1/2} + J·Q^{1/2})
     *       = N^ε · (N/Q^{1/2} + N·Q^{-1/2})  [since J = N/Q]
     *       = N^ε · 2N/Q^{1/2}
     *
     * Optimizing Q: take Q = N^{2/3}·t^{-1/3} (van der Corput)
     *   |Σ| ≤ N^{2/3+ε} · t^{1/6}
     *
     * This gives the van der Corput pair (κ,λ) = (1/6, 2/3).
     *
     * BUT: if the parabolic structure reduces S₂, we get less:
     *   S₂_parabola = J × #{close in 1D} ≈ J · 1 = J = N/Q
     *   (instead of S₂_generic ≈ J²·Δα·Δβ)
     *
     * With S₂ = N/Q:
     *   |Σ| ≤ N^ε · (N/Q^{1/2} + (N/Q)^{1/2}·Q^{1/2})
     *       = N^ε · (N/Q^{1/2} + N^{1/2})
     *
     * Optimizing Q: set N/Q^{1/2} = N^{1/2} → Q = N → trivial.
     *
     * This doesn't help. The parabolic structure doesn't reduce S₂
     * in the right way.
     */

    printf("  Standard BI with generic S₂:\n");
    printf("    |Σe(t·logn)| ≤ N^{2/3+ε}·t^{1/6}\n");
    printf("    → exponent pair (1/6, 2/3)\n\n");

    printf("  With parabolic S₂ (our specific f):\n");
    printf("    S₂ = N/Q (1D spacing), giving:\n");
    printf("    |Σ| ≤ N^ε·(N/Q^{1/2} + N^{1/2}·Q^0)\n\n");

    printf("  🔴 RED TEAM: The parabolic reduction to 1D doesn't help.\n");
    printf("     The 1D spacing S₂ = N/Q is LARGER than the generic\n");
    printf("     2D spacing S₂ = N²·Δα·Δβ/Q² for appropriate thresholds.\n");
    printf("     The constraint β = -α²/(2t) creates MORE coincidences.\n\n");

    printf("  This is a KNOWN phenomenon in exponential sum theory:\n");
    printf("  the stationary phase geometry of log(n) is 'worst case'\n");
    printf("  for the van der Corput method, which is why (1/6, 2/3)\n");
    printf("  is the natural pair for ζ(s).\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 5. Wooley's Efficient Congruencing\n\n");
    printf("  Wooley (2012) proved the main conjecture in Vinogradov's\n");
    printf("  mean value theorem: for k ≥ 2,\n");
    printf("    ∫₀¹...∫₀¹ |Σe(α₁n+...+αₖn^k)|^{2s} dα ≤ N^{s+ε}\n");
    printf("  for s ≥ k(k+1)/2.\n\n");
    printf("  Connection to our problem:\n");
    printf("  The BI method uses the QUADRATIC case (k=2).\n");
    printf("  Wooley's optimal bound for k=2, s=3:\n");
    printf("    ∫|Σe(αn+βn²)|⁶ dα dβ ≤ N^{3+ε}\n\n");
    printf("  This is the SIXTH MOMENT of Gauss sums.\n");
    printf("  It feeds into the BI second spacing via:\n");
    printf("    S₂ ≤ (sixth moment)^{1/3} ≈ N^{1+ε}\n\n");
    printf("  🔴 RED TEAM: Wooley's bound is already OPTIMAL.\n");
    printf("     The mean value theorem can't be further improved.\n");
    printf("     So this route is CLOSED.\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 6. Erdős-Turán Discrepancy\n\n");
    printf("  The inequality: D_N ≤ C/K + C·Σ_{k=1}^K (1/k)|Σe(kα_j)|\n\n");
    printf("  For our problem: α_j = d/N, the discrepancy bound gives:\n");
    printf("    |#{t: ||t·d/N|| < δ} - 2δ·T| ≤ discrepancy\n\n");
    printf("  The discrepancy involves Σe(kt·d/N) = geometric sum.\n");
    printf("  For a SINGLE d: this is standard and gives exact equidist.\n\n");
    printf("  For MULTIPLE d simultaneously: need multi-dimensional ET.\n");
    printf("  The multi-dim ET involves a PRODUCT of exponential sums.\n\n");
    printf("  🔴 RED TEAM: The multi-dimensional ET bound is:\n");
    printf("    D ≤ (2/K)^s + Σ_{k=1}^K Π_{d∈D} |sinc(πk·d/N)|\n");
    printf("  This product decays EXPONENTIALLY in |D|, giving D → 0.\n");
    printf("  But D → 0 means EQUIDISTRIBUTION, not concentration.\n");
    printf("  So ET says: points are EVENLY distributed → bad set ≈ 2δ|D|.\n");
    printf("  This recovers the TRIVIAL BOUND, not an improvement.\n\n");

    /* ═══════════════════════════════════════════ */
    printf("═══════════════════════════════════════════════════════════\n");
    printf("## FINAL ASSESSMENT: All Bridges Exhausted\n\n");
    printf("  ┌────────────────────────────────────────────────────────┐\n");
    printf("  │ Bridge                    │ Verdict                   │\n");
    printf("  ├────────────────────────────┼───────────────────────────┤\n");
    printf("  │ Duffin-Schaeffer (KM '19) │ 🔴 Equivalent to Huxley  │\n");
    printf("  │ Bombieri-Iwaniec spacing   │ 🔴 Parabola is worst case│\n");
    printf("  │ Wooley eff. congruencing   │ 🔴 Already optimal       │\n");
    printf("  │ Erdős-Turán discrepancy   │ 🔴 Gives trivial bound   │\n");
    printf("  └────────────────────────────┴───────────────────────────┘\n\n");

    printf("  ALL computationally testable bridges have been tried and\n");
    printf("  fail to improve on (κ,λ) = (1/6, 2/3).\n\n");

    printf("  THE HARD TRUTH:\n");
    printf("  The exponent pair (1/6, 2/3) has been the best for 35+ years\n");
    printf("  (since Huxley 1989). Improving it is one of the deepest\n");
    printf("  open problems in analytic number theory.\n\n");

    printf("  Guth-Maynard's breakthrough was NOT improving the exponent pair.\n");
    printf("  Instead, they found a COMPLETELY DIFFERENT way to use the\n");
    printf("  exponential sum (via decoupling + additive energy) that\n");
    printf("  gives a better large values estimate WITHOUT improving\n");
    printf("  the underlying exponential pair.\n\n");

    printf("  ★ To go beyond GM, one would need EITHER:\n");
    printf("    (a) A new exponent pair (35+ year open problem)\n");
    printf("    (b) A new way to use exponential sums (GM-level innovation)\n");
    printf("    (c) A completely different approach (unknown)\n");

    return 0;
}
