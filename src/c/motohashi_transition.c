/*
 * motohashi_transition.c — The Fourth Moment at the Transition σ ≈ 3/4
 *
 * THE KEY COMPUTATION:
 *   ∫₀ᵀ |ζ(σ+it)|⁴ dt =? T · ζ(2σ)⁴/ζ(4σ) + spectral remainder
 *
 *   If the spectral remainder is NEGATIVE at σ = 3/4:
 *     The fourth moment is SMALLER than the diagonal prediction.
 *     This could give a better zero-density estimate than GM.
 *
 *   If the spectral remainder is POSITIVE or ZERO:
 *     The fourth moment matches the diagonal — no improvement.
 *
 *   Motohashi at σ=1/2: the spectral remainder involves Σ L(1/2,u_j)³
 *     which is known to contribute to the error term.
 *   At σ>1/2: the remainder might be different.
 *
 * ALSO: Compare GM's bound (from sixth moment) to what the
 *   fourth moment gives at each σ. If the fourth moment
 *   gives smaller A for some σ, that's interesting.
 *
 * BUILD: cc -O3 -o motohashi_transition motohashi_transition.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

/* Truncated ζ function */
double zeta_re_im(double sigma, double t, int N, double *re_out, double *im_out) {
    double re = 0, im = 0;
    for (int n = 1; n <= N; n++) {
        double angle = -t * log(n);
        double mag = pow(n, -sigma);
        re += mag*cos(angle); im += mag*sin(angle);
    }
    *re_out = re; *im_out = im;
    return re*re + im*im;
}

/* ζ(s) for real s > 1 */
double zeta_real(double s, int N) {
    double sum = 0;
    for (int n = 1; n <= N; n++) sum += pow(n, -s);
    return sum;
}

int main() {
    printf("# Motohashi at the Transition: σ = 3/4\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 1. Fourth Moment ∫|ζ(σ+it)|⁴ vs Diagonal Prediction\n\n");

    printf("  Diagonal prediction: C(σ) = ζ(2σ)⁴/ζ(4σ)\n");
    printf("  Full fourth moment: ∫|ζ|⁴ dt / T ≈ C(σ) + R(σ)\n");
    printf("  R(σ) = spectral remainder from Motohashi\n\n");

    int N_zeta = 2000;  /* truncation length */

    printf("  %6s | %10s | %10s | %10s | %10s | %s\n",
           "σ", "C(σ) diag", "∫|ζ|⁴/T", "R(σ)", "R/C", "sign of R");

    double sigmas[] = {0.55, 0.60, 0.65, 0.70, 0.725, 0.75, 0.775, 0.80, 0.85, 0.90, 0};
    for (int si = 0; sigmas[si] > 0; si++) {
        double sigma = sigmas[si];

        /* Diagonal prediction */
        double z2s = zeta_real(2*sigma, 100000);
        double z4s = zeta_real(4*sigma, 100000);
        double C_diag = pow(z2s, 4) / z4s;

        /* Numerical fourth moment */
        int T = 5000;
        int nsamples = 4000;
        double int4 = 0;
        for (int k = 0; k < nsamples; k++) {
            double t = T + (double)k/nsamples * T;
            double re, im;
            double mag2 = zeta_re_im(sigma, t, N_zeta, &re, &im);
            int4 += mag2 * mag2;
        }
        int4 /= nsamples;  /* average |ζ|⁴ ≈ ∫|ζ|⁴/T */

        double R = int4 - C_diag;

        printf("  %6.3f | %10.2f | %10.2f | %+10.2f | %+10.4f | %s\n",
               sigma, C_diag, int4, R, R/C_diag,
               R < -0.01*C_diag ? "NEGATIVE ★" :
               R > 0.01*C_diag ? "POSITIVE" : "~zero");
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## 2. T-Scaling of the Fourth Moment at σ=3/4\n\n");

    printf("  If ∫|ζ|⁴ = T·C + R·T^α, what is α?\n");
    printf("  Motohashi: at σ=1/2, α = 2/3. At σ>1/2: α < 1?\n\n");

    double sigma_target = 0.75;
    printf("  σ = %.2f:\n\n", sigma_target);
    printf("  %8s | %12s | %12s | %12s\n",
           "T", "∫|ζ|⁴/T", "diagonal", "remainder%");

    int Ts[] = {500, 1000, 2000, 5000, 10000, 20000, 0};
    double z2s = zeta_real(2*sigma_target, 100000);
    double z4s = zeta_real(4*sigma_target, 100000);
    double C_diag = pow(z2s, 4) / z4s;

    for (int ti = 0; Ts[ti]; ti++) {
        int T = Ts[ti];
        int nsamples = 3000;
        double int4 = 0;
        for (int k = 0; k < nsamples; k++) {
            double t = T + (double)k/nsamples * T;
            double re, im;
            double mag2 = zeta_re_im(sigma_target, t, N_zeta, &re, &im);
            int4 += mag2 * mag2;
        }
        int4 /= nsamples;
        double remainder_pct = 100.0*(int4 - C_diag)/C_diag;

        printf("  %8d | %12.4f | %12.4f | %+12.2f%%\n",
               T, int4, C_diag, remainder_pct);
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## 3. Zero-Density from Fourth vs Sixth Moment\n\n");

    printf("  GM uses the SIXTH moment: A₃ = 30/13 = 2.3077\n");
    printf("  What does the FOURTH moment give?\n\n");

    printf("  For the fourth moment (k=2) of a length-N polynomial:\n");
    printf("    N(σ,T) · N^{4(1-σ)} ≤ ∫|F(σ+it)|⁴ dt\n");
    printf("    ∫|F|⁴ ≤ (T + N²) · (Σ|a_n|²/n^{2σ})²\n");
    printf("    With N = T^{1/2}: ∫|F|⁴ ≤ T · (logT)² (generic)\n");
    printf("    N(σ,T) ≤ T · (logT)² / N^{4(1-σ)}\n");
    printf("            ≤ T^{1-2(1-σ)} · (logT)² = T^{2σ-1+ε}\n\n");

    printf("  So A₂ = 1/(1-σ) · (2σ-1) = (2σ-1)/(1-σ)... no.\n");
    printf("  Let me be more careful.\n\n");

    printf("  From the fourth moment with optimal N:\n");
    printf("  N(σ,T) ≤ T^{A₂(1-σ)+ε} where:\n\n");

    printf("  The fourth moment MVT gives:\n");
    printf("    ∫_T^{2T} |F|⁴ ≤ T · N^{1+ε} (for F of length N)\n");
    printf("    [This uses the GENERIC fourth moment bound]\n\n");

    printf("  Combined with |F(ρ)| ≥ N^{1-σ-ε}:\n");
    printf("    N(σ,T) · N^{4(1-σ)} ≤ T · N^{1+ε}\n");
    printf("    N(σ,T) ≤ T · N^{1-4(1-σ)}\n");
    printf("    Optimize: take N = T^{1/(4(1-σ)-1)} when 4(1-σ)>1, i.e. σ<3/4\n");
    printf("    N(σ,T) ≤ T^{1/(4(1-σ)-1)·(1-4(1-σ))+1} ... messy\n\n");

    printf("  Cleaner: N(σ,T) ≤ T^{A_k(1-σ)+ε} where (Huxley's formula):\n");
    printf("    A_k = 2k / (2k(σ-1/2) + 1)  (simplified Ingham-Huxley)\n\n");

    printf("  %6s | %8s | %8s | %8s | %s\n",
           "σ", "A₂(4th)", "A₃(6th)", "better?", "note");

    double sig_vals[] = {0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 0};
    for (int i = 0; sig_vals[i] > 0; i++) {
        double s = sig_vals[i];
        double A2 = 4.0 / (4*(s-0.5) + 1);    /* k=2 */
        double A3 = 6.0 / (6*(s-0.5) + 1);    /* k=3 (GM) */
        /* Density hypothesis floor: A = 2 */
        printf("  %6.2f | %8.4f | %8.4f | %8s | %s\n",
               s, A2, A3,
               A2 < A3 ? "4TH ★" : "6th",
               A3 < 2.0 ? "both < DH" :
               A2 < 2.0 && A3 >= 2.0 ? "4th gives DH!" : "");
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## 4. The Critical Comparison at σ = 3/4\n\n");

    printf("  At σ = 3/4:\n");
    printf("    A₂ (fourth moment) = 4/(4·0.25+1) = 4/2 = 2.0 = DH!\n");
    printf("    A₃ (sixth moment, GM) = 6/(6·0.25+1) = 6/2.5 = 2.4\n\n");

    printf("  ★★★ THE FOURTH MOMENT IS BETTER AT σ = 3/4!\n\n");

    printf("  A₂ = 2.0 = Density Hypothesis at σ = 3/4.\n");
    printf("  A₃ = 2.4 (GM's sixth moment gives a WORSE bound here).\n\n");

    printf("  This means: the FOURTH moment, if computed with\n");
    printf("  Motohashi-type spectral precision, gives DH at σ=3/4.\n\n");

    printf("  🔴 RED TEAM: But wait — is A₂ = 2 at σ = 3/4 KNOWN?\n\n");

    printf("  YES! This is the INGHAM-HUXLEY result from 1940/1972.\n");
    printf("  The fourth moment bound N(σ,T) ≤ T^{2(1-σ)+ε} for σ>3/4\n");
    printf("  IS the Density Hypothesis in this range.\n\n");

    printf("  Huxley (1972): N(σ,T) ≤ T^{A(1-σ)+ε} with:\n");
    printf("    A = 12/5 for 1/2 ≤ σ ≤ 3/4  (from sixth moment + exponent pairs)\n");
    printf("    A = 2 for 3/4 ≤ σ ≤ 1       (from fourth moment/Ingham)\n\n");

    printf("  So GM's A = 30/13 applies to σ NEAR 1/2, where the\n");
    printf("  sixth moment is needed. For σ > 3/4, DH is ALREADY PROVED.\n\n");

    printf("  THE TARGET σ-RANGE for improvement:\n");
    printf("    σ ∈ [1/2, 3/4] where A = 12/5 (Huxley) or 30/13 (GM)\n\n");

    printf("  Can Motohashi improve the SIXTH moment at σ near 1/2?\n");
    printf("  Motohashi's formula is for the FOURTH moment of ζ.\n");
    printf("  GM uses F = -ζ'/ζ, and its SIXTH moment.\n");
    printf("  These are DIFFERENT objects.\n\n");

    printf("  ★ To use Motohashi for zero-density, we'd need to:\n");
    printf("  1. Write ζ'/ζ in terms of ζ² (possible but loses structure)\n");
    printf("  2. Apply Motohashi to |ζ'/ζ|⁶ (much harder, no known formula)\n");
    printf("  3. Or use ζ itself as the detecting function (weaker detection)\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 5. The Refined Landscape\n\n");

    printf("  σ range  | Best A | Method              | Status\n");
    printf("  ─────────┼────────┼─────────────────────┼──────────────\n");
    printf("  [1/2,σ₁] | 30/13  | GM (6th moment)     | Current best\n");
    printf("  [σ₁,3/4] | 12/5   | Huxley (exp pairs)  | Current best\n");
    printf("  [3/4, 1] | 2      | Ingham (4th moment)  | = DH ✅\n\n");

    printf("  σ₁ = crossover between GM and Huxley ≈ 0.657\n");
    printf("  (where 30/13 = 12/5 · ..., actually need actual formulas)\n\n");

    printf("  The Motohashi angle targets: can spectral information\n");
    printf("  improve A in the [1/2, 3/4] range?\n\n");

    printf("  At σ = 3/4: A = 2 is already DH (from Ingham).\n");
    printf("  At σ = 1/2: A = 30/13 is the current best.\n");
    printf("  Between: there's room for improvement via spectral methods.\n\n");

    printf("  ★★ The MOST PROMISING specific research question:\n\n");
    printf("  'Can Motohashi's spectral decomposition of |ζ|⁴,\n");
    printf("   combined with the explicit formula, give a better\n");
    printf("   zero-density estimate for σ ∈ (0.66, 0.75)?'\n\n");

    printf("  In this range:\n");
    printf("  • The fourth moment is relevant but doesn't quite give DH\n");
    printf("  • The sixth moment (GM) gives A = 30/13 ≈ 2.31\n");
    printf("  • Spectral information (Maass forms) might bridge the gap\n");
    printf("  • This would require a HYBRID fourth + spectral argument\n");

    return 0;
}
