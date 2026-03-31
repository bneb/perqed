/*
 * sixth_moment.c — Numerical computation of the averaged 6th moment
 * of Dirichlet L-functions and spectral decomposition of d₃.
 *
 * Computes:
 *   M₆(σ, q, T) = Σ_{χ mod q} ∫₀ᵀ |L(σ+it, χ)|⁶ dt
 *
 * Also computes the "spectral prediction" from decomposing d₃
 * and using second moment bounds for Rankin-Selberg L-functions.
 *
 * BUILD: cc -O3 -o sixth_moment sixth_moment.c -lm
 * USAGE: ./sixth_moment [q_max]
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>
#include <complex.h>

#define MAX_N 50000

/* d₃(n) = number of ways to write n = abc */
static double d3[MAX_N + 1];

/* Compute d₃ via convolution: d₃ = d₂ * 1, where d₂(n) = d(n) = divisor fn */
void compute_d3(int limit) {
    /* First compute d₂(n) = number of divisors */
    double *d2 = calloc(limit + 1, sizeof(double));
    for (int i = 1; i <= limit; i++)
        for (int j = i; j <= limit; j += i)
            d2[j] += 1.0;

    /* d₃(n) = Σ_{d|n} d₂(d) = Σ_{abc=n} 1 */
    memset(d3, 0, (limit + 1) * sizeof(double));
    for (int i = 1; i <= limit; i++)
        for (int j = i; j <= limit; j += i)
            d3[j] += d2[i];

    free(d2);
}

/* GCD */
int gcd(int a, int b) {
    while (b) { int t = b; b = a % b; a = t; }
    return a;
}

/* Compute all Dirichlet characters mod q.
 * For prime q, there are q-1 characters.
 * We represent χ(n) as complex values. */

/* Find a primitive root mod q (for prime q) */
int primitive_root(int q) {
    for (int g = 2; g < q; g++) {
        int ok = 1;
        int x = 1;
        for (int i = 1; i < q - 1; i++) {
            x = (x * g) % q;
            if (x == 1) { ok = 0; break; }
        }
        if (ok) return g;
    }
    return -1;
}

/* Compute L(s, χ) for a Dirichlet character χ mod q.
 * χ is specified by its index j: χ(g^k) = exp(2πi·j·k/(q-1))
 * where g is the primitive root.
 *
 * We compute via partial sum: L(s,χ) ≈ Σ_{n=1}^{N_max} χ(n) n^{-s}
 */
double complex compute_L(double sigma, double t, int q, int char_index,
                         int g, int N_max) {
    /* Precompute discrete logarithm table for mod q */
    int *dlog = calloc(q, sizeof(int));
    int x = 1;
    for (int k = 0; k < q - 1; k++) {
        dlog[x] = k;
        x = (x * g) % q;
    }

    double complex L = 0;
    double omega = 2.0 * M_PI * char_index / (q - 1);

    for (int n = 1; n <= N_max; n++) {
        if (n % q == 0) continue;  /* χ(n) = 0 when q|n */
        int r = n % q;
        int k = dlog[r];
        double chi_angle = omega * k;
        double complex chi_n = cos(chi_angle) + I * sin(chi_angle);
        double n_power = pow((double)n, -sigma);
        double log_n = log((double)n);
        double complex n_s = n_power * (cos(-t * log_n) + I * sin(-t * log_n));
        L += chi_n * n_s;
    }

    free(dlog);
    return L;
}

int main(int argc, char **argv) {
    int q_max = 13;
    if (argc > 1) q_max = atoi(argv[1]);

    printf("# Averaged 6th Moment of Dirichlet L-functions\n");
    printf("# M₆(σ, q, T) = Σ_{χ mod q} ∫₀ᵀ |L(σ+it, χ)|⁶ dt\n\n");

    compute_d3(MAX_N);

    /* Verify d₃ */
    printf("d₃ check: d₃(1)=%.0f d₃(2)=%.0f d₃(4)=%.0f d₃(6)=%.0f d₃(12)=%.0f d₃(24)=%.0f\n",
           d3[1], d3[2], d3[4], d3[6], d3[12], d3[24]);
    /* Expected: 1, 3, 6, 9, 27, 54 */

    /* d₃ statistics: Σ d₃(n)² / n^{2σ} as a function of σ */
    printf("\n# d₃ Dirichlet series: Σ d₃(n)²/n^{2σ} (related to 6th moment)\n");
    for (double sigma = 0.55; sigma <= 1.01; sigma += 0.05) {
        double sum = 0;
        for (int n = 1; n <= MAX_N; n++)
            sum += d3[n] * d3[n] * pow((double)n, -2.0 * sigma);
        printf("  σ=%.2f: Σ d₃²/n^{2σ} = %.4f (up to N=%d)\n", sigma, sum, MAX_N);
    }

    /* Now compute the actual 6th moment for small primes q */
    printf("\n# Averaged 6th moment M₆(σ, q, T):\n");
    printf("# q | σ | T | M₆ | M₆/(φ(q)·T) | prediction\n");

    int primes_q[] = {3, 5, 7, 11, 13, 0};
    double sigmas[] = {0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0};

    for (int qi = 0; primes_q[qi] && primes_q[qi] <= q_max; qi++) {
        int q = primes_q[qi];
        int g = primitive_root(q);
        if (g < 0) continue;

        int N_sum = 2000;  /* partial sum length for L-function */
        double T = 20.0;   /* integration range */
        int T_grid = 200;  /* integration points */
        double dt = T / T_grid;

        for (int si = 0; sigmas[si] > 0; si++) {
            double sigma = sigmas[si];
            double M6 = 0;

            /* Sum over all non-trivial characters χ mod q */
            for (int j = 0; j < q - 1; j++) {
                /* Integrate |L(σ+it, χ)|⁶ over t ∈ [1, T] */
                double char_integral = 0;
                for (int ti = 0; ti < T_grid; ti++) {
                    double t = 1.0 + ti * dt;
                    double complex Lval = compute_L(sigma, t, q, j, g, N_sum);
                    double absL = cabs(Lval);
                    char_integral += pow(absL, 6.0) * dt;
                }
                M6 += char_integral;
            }

            double phi_q = q - 1;  /* φ(q) for prime q */
            double normalized = M6 / (phi_q * T);

            /* Prediction from d₃ second moment:
             * M₆ ≈ φ(q) · T · Σ_{n≤qT} d₃(n)² n^{-2σ} */
            double prediction = 0;
            int pred_limit = (int)(q * T);
            if (pred_limit > MAX_N) pred_limit = MAX_N;
            for (int n = 1; n <= pred_limit; n++) {
                if (n % q == 0) continue;
                prediction += d3[n] * d3[n] * pow((double)n, -2.0 * sigma);
            }

            printf("  q=%2d σ=%.2f T=%.0f | M₆=%12.4f | norm=%10.4f | pred=%10.4f | ratio=%.4f\n",
                   q, sigma, T, M6, normalized, prediction,
                   (prediction > 0) ? normalized / prediction : 0);
        }
        printf("\n");
    }

    /* Key test: does the normalized M₆ match the d₃² prediction?
     * If ratio ≈ 1, the spectral decomposition captures the right behavior.
     * If ratio >> 1 at some σ, there's extra structure to exploit.
     * If ratio << 1, the prediction overestimates (good for upper bounds!). */

    printf("# INTERPRETATION:\n");
    printf("# ratio ≈ 1: spectral decomposition matches → can use for bounds\n");
    printf("# ratio < 1: prediction overestimates → UPPER BOUND is valid\n");
    printf("# ratio > 1: prediction underestimates → more structure needed\n");

    return 0;
}
