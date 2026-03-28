/*
 * weight_sweep.c — Mass sweep of positive weight functions.
 *
 * KEY INSIGHT: If w(p) > 0 for ALL primes, then r_w(E) > 0 whenever r(E) > 0.
 * Counting viability is AUTOMATIC. We only need to find β < 0.
 *
 * Families tested (all guaranteed positive):
 *   A: w = exp(ε·τ̃)               — exponential tilt, ε ∈ [-2, 2]
 *   B: w = 1 + a·τ̃ + b·τ̃²        — quadratic (with positivity check)
 *   C: w = (1 + c·τ̃)²             — perfect square, c ∈ [-0.5, 0.5]
 *   D: w = |τ̃|^α                  — power of absolute value
 *   E: w = 1/(1 + ε·|τ̃|)          — inverse, ε > 0
 *   F: w = cosh(ε·τ̃)              — even exponential
 *   G: w = 1 + ε·τ̃²              — pure quadratic shift
 *   H: w = softplus(τ̃ + c)        — log(1+exp(τ̃+c)), always positive
 *
 * For each weight, compute E at N₁=50K and N₂=200K, estimate β from 2 points.
 * Best candidates get full 7-point analysis.
 */
#include "fft_lib.h"
#include "tau_lib.h"
#include <math.h>

#define FIXED_Q 10
#define MAX_FUNCS 300

static void progress(int n, int max_n) {
    if (n % 50000 == 0)
        fprintf(stderr, "    τ: %d/%d (%.0f%%)\n", n, max_n, 100.0*n/max_n);
}

typedef struct {
    char name[64];
    double params[3];
    double beta;         /* estimated exponent */
    double E1, E2;       /* E at N1, N2 */
    int positive;        /* 1 if w>0 for all primes tested */
} WeightFunc;

int main(void) {
    int N2 = 200001;
    int N1 = 50000;
    fprintf(stderr, "Init (τ to %d)...\n", N2);
    char *isc = fft_sieve_primes(N2);
    TauTable tau = tau_compute(N2, progress);
    fprintf(stderr, "Done.\n\n");
    if (tau_verify_known(&tau)) { printf("τ FAILED\n"); return 1; }

    /* Precompute τ̃(p) for all primes */
    double *tn = calloc(N2+1, 8);
    for (int p = 2; p <= N2; p++)
        if (!isc[p]) tn[p] = tau_normalized(&tau, p);

    /* ═══ Generate weight functions ═══ */
    WeightFunc funcs[MAX_FUNCS];
    int nf = 0;

    /* Family A: exp(ε·τ̃), ε from -2 to 2 */
    for (double eps = -2.0; eps <= 2.01; eps += 0.2) {
        snprintf(funcs[nf].name, 64, "exp(%.1f·τ̃)", eps);
        funcs[nf].params[0] = eps;
        funcs[nf].params[1] = 0; /* family A */
        nf++;
    }

    /* Family B: 1 + a·τ̃ + b·τ̃², various (a,b) keeping positive */
    double bs[] = {0.1, 0.2, 0.3, 0.5, 0.8, 1.0, 1.5, 2.0};
    for (int bi = 0; bi < 8; bi++) {
        double b = bs[bi];
        /* For each b, sweep a from -2√b to 2√b */
        double a_max = 2.0 * sqrt(b) * 0.9; /* 90% to stay safe */
        for (double a = -a_max; a <= a_max + 0.01; a += a_max / 3) {
            snprintf(funcs[nf].name, 64, "1+%.2f·τ̃+%.1f·τ̃²", a, b);
            funcs[nf].params[0] = a;
            funcs[nf].params[1] = b;
            funcs[nf].params[2] = 1; /* family B */
            nf++;
        }
    }

    /* Family C: (1+c·τ̃)², c from -0.49 to 0.49 */
    for (double c = -0.49; c <= 0.50; c += 0.07) {
        snprintf(funcs[nf].name, 64, "(1+%.2f·τ̃)²", c);
        funcs[nf].params[0] = c;
        funcs[nf].params[1] = 0;
        funcs[nf].params[2] = 2; /* family C */
        nf++;
    }

    /* Family D: |τ̃|^α, α from 0.1 to 3 */
    for (double alpha = 0.2; alpha <= 3.01; alpha += 0.4) {
        snprintf(funcs[nf].name, 64, "|τ̃|^%.1f", alpha);
        funcs[nf].params[0] = alpha;
        funcs[nf].params[1] = 0;
        funcs[nf].params[2] = 3; /* family D */
        nf++;
    }

    /* Family E: 1/(1+ε·|τ̃|), ε > 0 */
    for (double eps = 0.1; eps <= 2.01; eps += 0.3) {
        snprintf(funcs[nf].name, 64, "1/(1+%.1f|τ̃|)", eps);
        funcs[nf].params[0] = eps;
        funcs[nf].params[1] = 0;
        funcs[nf].params[2] = 4; /* family E */
        nf++;
    }

    /* Family F: cosh(ε·τ̃) */
    for (double eps = 0.1; eps <= 2.01; eps += 0.3) {
        snprintf(funcs[nf].name, 64, "cosh(%.1f·τ̃)", eps);
        funcs[nf].params[0] = eps;
        funcs[nf].params[1] = 0;
        funcs[nf].params[2] = 5; /* family F */
        nf++;
    }

    /* Family G: 1+ε·τ̃² */
    for (double eps = 0.1; eps <= 5.01; eps += 0.5) {
        snprintf(funcs[nf].name, 64, "1+%.1f·τ̃²", eps);
        funcs[nf].params[0] = eps;
        funcs[nf].params[1] = 0;
        funcs[nf].params[2] = 6; /* family G */
        nf++;
    }

    /* Family H: softplus(τ̃+c) = log(1+exp(τ̃+c)) */
    for (double c = -2.0; c <= 4.01; c += 0.5) {
        snprintf(funcs[nf].name, 64, "softplus(τ̃+%.1f)", c);
        funcs[nf].params[0] = c;
        funcs[nf].params[1] = 0;
        funcs[nf].params[2] = 7; /* family H */
        nf++;
    }

    /* Plain and full τ for reference */
    snprintf(funcs[nf].name, 64, "PLAIN (w=1)");
    funcs[nf].params[2] = 99; nf++;
    snprintf(funcs[nf].name, 64, "FULL τ̃ (signed)");
    funcs[nf].params[2] = 98; nf++;

    printf("═══════════════════════════════════════════════════════\n");
    printf("  Mass Weight Sweep: %d functions\n", nf);
    printf("  Quick β from N₁=%d and N₂=%d\n", N1, N2);
    printf("═══════════════════════════════════════════════════════\n\n");

    /* ═══ Sweep ═══ */
    double logN1 = log((double)N1), logN2 = log((double)N2);
    double norm1 = (double)N1/log((double)N1), norm2 = (double)N2/log((double)N2);

    for (int fi = 0; fi < nf; fi++) {
        if (fi % 20 == 0) fprintf(stderr, "  %d/%d...\n", fi, nf);

        /* Compute weights */
        double *w1 = calloc(N1+1, 8);
        double *w2 = calloc(N2+1, 8);
        int pos = 1;

        for (int pass = 0; pass < 2; pass++) {
            int N = (pass==0) ? N1 : N2;
            double *w = (pass==0) ? w1 : w2;

            for (int p = 2; p <= N; p++) {
                if (isc[p]) continue;
                double t = tn[p];
                double v = 0;
                int fam = (int)funcs[fi].params[2];

                switch(fam) {
                    case 0: /* exp(ε·τ̃) */
                        v = log((double)p) * exp(funcs[fi].params[0] * t);
                        break;
                    case 1: /* 1 + a·τ̃ + b·τ̃² */
                        v = log((double)p) * (1.0 + funcs[fi].params[0]*t + funcs[fi].params[1]*t*t);
                        break;
                    case 2: /* (1+c·τ̃)² */
                        { double x = 1.0 + funcs[fi].params[0]*t;
                          v = log((double)p) * x * x; }
                        break;
                    case 3: /* |τ̃|^α */
                        v = log((double)p) * pow(fabs(t) + 1e-30, funcs[fi].params[0]);
                        break;
                    case 4: /* 1/(1+ε|τ̃|) */
                        v = log((double)p) / (1.0 + funcs[fi].params[0]*fabs(t));
                        break;
                    case 5: /* cosh(ε·τ̃) */
                        v = log((double)p) * cosh(funcs[fi].params[0] * t);
                        break;
                    case 6: /* 1+ε·τ̃² */
                        v = log((double)p) * (1.0 + funcs[fi].params[0]*t*t);
                        break;
                    case 7: /* softplus(τ̃+c) */
                        v = log((double)p) * log(1.0 + exp(t + funcs[fi].params[0]));
                        break;
                    case 98: /* full τ̃ (signed) */
                        v = log((double)p) * t;
                        break;
                    case 99: /* plain */
                        v = log((double)p);
                        break;
                }

                if (fam != 98 && v < -1e-10) pos = 0; /* check positivity */
                w[p] = v;
            }
        }

        funcs[fi].positive = pos;

        /* Compute E at N1 and N2 */
        double sup1 = fft_minor_arc_sup(w1, N1, FIXED_Q);
        double sup2 = fft_minor_arc_sup(w2, N2, FIXED_Q);
        funcs[fi].E1 = sup1 / norm1;
        funcs[fi].E2 = sup2 / norm2;

        /* Quick β from 2 points */
        if (funcs[fi].E1 > 0 && funcs[fi].E2 > 0)
            funcs[fi].beta = (log(funcs[fi].E2) - log(funcs[fi].E1)) / (logN2 - logN1);
        else
            funcs[fi].beta = 99;

        free(w1); free(w2);
    }

    /* ═══ Sort by β ═══ */
    for (int i = 0; i < nf-1; i++)
        for (int j = i+1; j < nf; j++)
            if (funcs[j].beta < funcs[i].beta) {
                WeightFunc tmp = funcs[i]; funcs[i] = funcs[j]; funcs[j] = tmp;
            }

    /* ═══ Print top 30 ═══ */
    printf("\n  ═══ Top 30 by β (lower = better) ═══\n");
    printf("  %4s | %-26s | %8s | %8s | %8s | %3s\n",
           "Rank", "Weight Function", "β", "E(50K)", "E(200K)", "w>0");

    for (int i = 0; i < 30 && i < nf; i++) {
        printf("  %4d | %-26s | %8.4f | %8.4f | %8.4f | %s\n",
               i+1, funcs[i].name, funcs[i].beta,
               funcs[i].E1, funcs[i].E2,
               funcs[i].positive ? " ✓" : " ✗");
    }

    /* ═══ Print bottom 10 (worst) ═══ */
    printf("\n  ═══ Bottom 10 (worst β) ═══\n");
    for (int i = nf-10; i < nf; i++) {
        if (i < 0) continue;
        printf("  %4d | %-26s | %8.4f | %8.4f | %8.4f | %s\n",
               i+1, funcs[i].name, funcs[i].beta,
               funcs[i].E1, funcs[i].E2,
               funcs[i].positive ? " ✓" : " ✗");
    }

    /* ═══ Key question: best POSITIVE function ═══ */
    printf("\n  ═══ BEST POSITIVE (w>0) WEIGHT FUNCTIONS ═══\n");
    printf("  (These automatically have r_w > 0 whenever r > 0)\n\n");
    int shown = 0;
    for (int i = 0; i < nf && shown < 15; i++) {
        if (!funcs[i].positive) continue;
        const char *v = (funcs[i].beta<-0.10) ? "★★★" : (funcs[i].beta<-0.05) ? "★★" :
                        (funcs[i].beta<-0.01) ? "★" : (funcs[i].beta<0.05) ? "~" : "✗";
        printf("  %4d | %-26s | β=%8.4f | %s\n", shown+1, funcs[i].name, funcs[i].beta, v);
        shown++;
    }

    printf("\n  Total functions tested: %d\n", nf);
    int n_pos_neg_beta = 0;
    for (int i = 0; i < nf; i++)
        if (funcs[i].positive && funcs[i].beta < -0.05) n_pos_neg_beta++;
    printf("  Positive w with β < -0.05: %d\n", n_pos_neg_beta);

    tau_free(&tau); free(tn); free(isc);
    return 0;
}
