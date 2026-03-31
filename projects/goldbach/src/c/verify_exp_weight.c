/*
 * verify_exp_weight.c — Check the FULL exceptional set ratio
 * ∫|S_w|⁴ / M_w² vs ∫|S|⁴ / M² for the exp(-p/2N) weight.
 *
 * Key insight: for Goldbach (p+q=2n), the paired weight
 * w(p)·w(q) = exp(-(p+q)/2N) = exp(-n/N) = CONSTANT for fixed n.
 * So M_w(2n) = exp(-n/N) · M(2n).
 *
 * The exceptional set ratio is:
 *   E(N) ≤ ∫|S_w|⁴ / min_n M_w(2n)²
 *        = ∫|S_w|⁴ / (exp(-2n/N) · M(2n)²)
 *
 * For the WORST CASE exceptional n ≈ N:
 *   ratio = ∫|S_w|⁴ · exp(2) / M(2N)²
 *
 * We need ∫|S_w|⁴ · exp(2) < ∫|S|⁴ for genuine improvement.
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

#define MAX_SIEVE 200001
static char is_composite[MAX_SIEVE];
static int primes[20000];
static int num_primes = 0;

void sieve(int limit) {
    memset(is_composite, 0, limit + 1);
    is_composite[0] = is_composite[1] = 1;
    for (int i = 2; (long long)i * i <= limit; i++)
        if (!is_composite[i])
            for (int j = i * i; j <= limit; j += i)
                is_composite[j] = 1;
    for (int i = 2; i <= limit; i++)
        if (!is_composite[i])
            primes[num_primes++] = i;
}

int main(int argc, char **argv) {
    int N = 50000;
    if (argc > 1) N = atoi(argv[1]);
    if (N > MAX_SIEVE - 1) N = MAX_SIEVE - 1;
    sieve(N);

    int np = 0;
    while (np < num_primes && primes[np] <= N) np++;
    int sz = 2 * N + 2;

    printf("# Full Exceptional Set Comparison for exp(-p/2N)\n");
    printf("# N=%d, π(N)=%d\n\n", N, np);

    /* Build convolutions */
    double *ff = calloc(sz, sizeof(double));   /* plain */
    double *ww = calloc(sz, sizeof(double));   /* weighted */

    for (int i = 0; i < np; i++) {
        double lp_i = log((double)primes[i]);
        double wi = exp(-(double)primes[i] / (2.0 * N));
        for (int j = 0; j < np; j++) {
            int s = primes[i] + primes[j];
            if (s < sz) {
                double lp_j = log((double)primes[j]);
                double wj = exp(-(double)primes[j] / (2.0 * N));
                ff[s] += lp_i * lp_j;
                ww[s] += lp_i * wi * lp_j * wj;
            }
        }
    }

    /* Fourth moments */
    double fourth_plain = 0, fourth_w = 0;
    for (int s = 0; s < sz; s++) {
        fourth_plain += ff[s] * ff[s];
        fourth_w += ww[s] * ww[s];
    }

    /* For each even s = 2n, the paired weight is exp(-n/N).
     * So M_w(2n) = exp(-n/N) · M(2n), hence M_w(2n)² = exp(-2n/N) · M(2n)².
     *
     * The exceptional set bound needs the WORST CASE over exceptional n:
     * E(N) ≤ ∫|S_w|⁴ / min_{n exceptional} M_w(2n)²
     *
     * For exceptional n near N/2 to N:
     *   M_w(2n)² = exp(-2n/N) · M(2n)²
     *
     * The per-n ratio is:
     *   weighted_ratio(n) = ww[2n]² / (exp(-2n/N) · ff[2n])²  ... not quite.
     *
     * Actually: the exceptional set bound uses the TOTAL fourth moment
     * divided by the MINIMUM main term squared.
     *
     * plain:    E ≤ fourth_plain / min_n M(2n)²
     * weighted: E ≤ fourth_w / min_n (exp(-n/N) · M(2n))²
     *         = fourth_w / (exp(-2·n_min/N) · min_n M(2n)²)
     *         = (fourth_w · exp(2·n_worst/N)) / min_n M(2n)²
     *
     * The worst case is n_worst ≈ N (largest even number),
     * where exp(2·N/N) = exp(2) ≈ 7.39.
     *
     * So: ratio = fourth_w · exp(2) / fourth_plain
     */

    double ratio_half = fourth_w * exp(1.0) / fourth_plain;  /* n = N/2 */
    double ratio_full = fourth_w * exp(2.0) / fourth_plain;  /* n = N */

    printf("∫|S|⁴         = %.6e\n", fourth_plain);
    printf("∫|S_w|⁴       = %.6e\n", fourth_w);
    printf("∫|S_w|⁴/∫|S|⁴ = %.6f\n\n", fourth_w / fourth_plain);

    printf("For exceptional n ≈ N/2:  exp(1) · ∫|S_w|⁴/∫|S|⁴ = %.6f  %s\n",
           ratio_half, ratio_half < 1.0 ? "IMPROVEMENT ✓" : "NO IMPROVEMENT ✗");
    printf("For exceptional n ≈ N:    exp(2) · ∫|S_w|⁴/∫|S|⁴ = %.6f  %s\n",
           ratio_full, ratio_full < 1.0 ? "IMPROVEMENT ✓" : "NO IMPROVEMENT ✗");

    printf("\n# The exp(-p/2N) weight shrinks ∫|S|⁴ by factor %.4f\n", fourth_w/fourth_plain);
    printf("# But the main term M_w(2n) shrinks by exp(-n/N), so M_w² shrinks by exp(-2n/N)\n");
    printf("# For worst-case n≈N: exp(2)=%.4f penalty on the main term\n", exp(2.0));
    printf("# Net effect: %.4f × %.4f = %.4f > 1 → NO IMPROVEMENT\n",
           fourth_w/fourth_plain, exp(2.0), ratio_full);

    /* Try optimizing: w(p) = exp(-p/(c·N)) for various c */
    printf("\n# Sweep c in exp(-p/(c·N)):\n");
    printf("# %6s | %12s | %12s | %12s | %s\n",
           "c", "4th_w/4th", "penalty(n=N)", "net_ratio", "result");
    for (double c = 0.5; c <= 20.0; c += 0.5) {
        double *wc = calloc(sz, sizeof(double));
        for (int i = 0; i < np; i++) {
            double lw_i = log((double)primes[i]) * exp(-(double)primes[i] / (c * N));
            for (int j = 0; j < np; j++) {
                int s = primes[i] + primes[j];
                if (s < sz)
                    wc[s] += lw_i * log((double)primes[j]) * exp(-(double)primes[j] / (c * N));
            }
        }
        double fw = 0;
        for (int s = 0; s < sz; s++) fw += wc[s] * wc[s];
        double frac = fw / fourth_plain;
        double penalty = exp(2.0 / c);  /* exp(2n/N) with n=N → exp(2/c·N/N) = exp(2/c) */

        /* Wait: w(p)·w(q)=exp(-(p+q)/(cN))=exp(-2n/(cN)) for p+q=2n.
         * So M_w²=exp(-4n/(cN))·M², penalty=exp(4n/(cN)).
         * For n=N: penalty = exp(4/c). Actually:
         * M_w(2n)= exp(-2n/(cN))·M(2n), so M_w²=exp(-4n/(cN))·M² ← WRONG
         * No: M_w(2n) involves Σ_{p+q=2n} lp·lq·w(p)·w(q)
         * = exp(-2n/(cN)) · Σ lp·lq = exp(-2n/(cN))·M(2n)
         * So M_w(2n)² = exp(-4n/(cN))·M(2n)²
         * Penalty = exp(4n/(cN)), at n=N: exp(4/c)
         */
        penalty = exp(4.0 / c);
        double net = frac * penalty;
        printf("  %6.1f | %12.6f | %12.4f | %12.6f | %s\n",
               c, frac, penalty, net, net < 1.0 ? "WIN ✓" : "lose");
        free(wc);
    }

    free(ff); free(ww);
    return 0;
}
