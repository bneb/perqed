/*
 * goldbach_detwist.c — De-twisting test: Does r_τ(E) > 0 imply r(E) > 0?
 *
 * Computes:
 *   r(E)   = Σ_{p+q=E} log(p)·log(q)              (plain Goldbach count)
 *   r_τ(E) = Σ_{p+q=E} log(p)·log(q)·τ̃(p)·τ̃(q)  (τ-weighted count)
 *
 * For every even E in [4, MAX_E], check whether:
 *   1. r(E) > 0 (Goldbach holds)
 *   2. r_τ(E) > 0 (τ-weighted version holds)
 *   3. Correlation between r and r_τ
 *
 * If r_τ(E) > 0 whenever r(E) > 0, de-twisting is viable.
 * If r_τ(E) can be negative when r(E) > 0, de-twisting fails.
 *
 * Also computes:
 *   ratio(E) = r_τ(E) / r(E) — stability of the de-twisting constant
 *   sign disagreements — how often r_τ and r have different signs
 */
#include "fft_lib.h"
#include "tau_lib.h"

static void progress(int n, int max_n) {
    if (n % 10000 == 0)
        fprintf(stderr, "    τ: %d/%d (%.0f%%)\n", n, max_n, 100.0*n/max_n);
}

int main(void) {
    int MAX_E = 20000;
    int TAU_MAX = MAX_E + 1;

    fprintf(stderr, "Init (τ to %d)...\n", TAU_MAX);
    char *isc = fft_sieve_primes(TAU_MAX);
    TauTable tau = tau_compute(TAU_MAX, progress);
    fprintf(stderr, "Done.\n\n");

    /* Self-test */
    int kv = tau_verify_known(&tau);
    if (kv) { printf("τ self-test FAILED\n"); return 1; }
    printf("τ self-test: ✓\n\n");

    printf("═══════════════════════════════════════════════════════\n");
    printf("  De-Twisting Test: r_τ(E) vs r(E)\n");
    printf("  Even E from 4 to %d\n", MAX_E);
    printf("═══════════════════════════════════════════════════════\n\n");

    int goldbach_fails = 0;    /* r(E) ≤ 0 */
    int tau_fails = 0;         /* r_τ(E) ≤ 0 when r(E) > 0 */
    int sign_disagree = 0;     /* r_τ(E) < 0 */
    int total_even = 0;

    double ratio_sum = 0, ratio_sum2 = 0;
    int ratio_count = 0;
    double ratio_min = 1e30, ratio_max = -1e30;
    int ratio_min_E = 0, ratio_max_E = 0;

    /* Print sample values */
    printf("  %8s | %12s | %12s | %10s | status\n", "E", "r(E)", "r_τ(E)", "ratio");

    for (int E = 4; E <= MAX_E; E += 2) {
        total_even++;
        double r_plain = 0;
        double r_tau = 0;

        for (int p = 2; p <= E - 2; p++) {
            if (isc[p]) continue;
            int q = E - p;
            if (q < 2 || isc[q]) continue;

            double lp = log((double)p);
            double lq = log((double)q);
            r_plain += lp * lq;
            r_tau += lp * lq * tau_normalized(&tau, p) * tau_normalized(&tau, q);
        }

        /* Track statistics */
        if (r_plain <= 0) goldbach_fails++;

        if (r_plain > 0 && r_tau <= 0) tau_fails++;
        if (r_tau < 0) sign_disagree++;

        if (r_plain > 0.01) {
            double ratio = r_tau / r_plain;
            ratio_sum += ratio;
            ratio_sum2 += ratio * ratio;
            ratio_count++;
            if (ratio < ratio_min) { ratio_min = ratio; ratio_min_E = E; }
            if (ratio > ratio_max) { ratio_max = ratio; ratio_max_E = E; }
        }

        /* Print first 20, then every 1000 */
        if (E <= 44 || E % 2000 == 0) {
            double ratio = (fabs(r_plain) > 0.01) ? r_tau / r_plain : 0;
            const char *status = (r_plain > 0 && r_tau > 0) ? "✓ both +" :
                                 (r_plain > 0 && r_tau <= 0) ? "✗ τ FAILS" :
                                 "? r=0";
            printf("  %8d | %12.2f | %12.2f | %10.4f | %s\n",
                   E, r_plain, r_tau, ratio, status);
        }
    }

    printf("\n  ═══ Summary ═══\n");
    printf("  Total even E tested:  %d\n", total_even);
    printf("  r(E) > 0 (Goldbach): %d/%d\n", total_even - goldbach_fails, total_even);
    printf("  r_τ(E) > 0:          %d/%d\n", total_even - sign_disagree, total_even);
    printf("  Sign disagreements:   %d (r_τ < 0 when r > 0)\n", tau_fails);

    if (ratio_count > 0) {
        double mean = ratio_sum / ratio_count;
        double var = ratio_sum2 / ratio_count - mean * mean;
        printf("\n  ═══ Ratio r_τ/r ═══\n");
        printf("  Mean:   %.6f\n", mean);
        printf("  StdDev: %.6f\n", sqrt(var));
        printf("  Min:    %.6f (at E=%d)\n", ratio_min, ratio_min_E);
        printf("  Max:    %.6f (at E=%d)\n", ratio_max, ratio_max_E);
    }

    printf("\n  ═══ De-Twisting Verdict ═══\n");
    if (tau_fails == 0 && sign_disagree == 0) {
        printf("  ★★★ PERFECT CORRELATION: r_τ(E) > 0 whenever r(E) > 0\n");
        printf("  De-twisting is viable!  r(E) ≥ (1/C²)·|r_τ(E)| is plausible.\n");
    } else if (tau_fails == 0) {
        printf("  ★★ NO FAILURES: r_τ > 0 whenever r > 0, but some r_τ < 0 when r ≤ 0\n");
    } else {
        double fail_rate = 100.0 * tau_fails / total_even;
        printf("  ✗ %d FAILURES (%.2f%% of E): r_τ(E) ≤ 0 when r(E) > 0\n",
               tau_fails, fail_rate);
        printf("  De-twisting via simple inequality is NOT viable.\n");
    }

    /* ═══ Distribution in bins ═══ */
    printf("\n  ═══ Ratio Distribution by E Range ═══\n");
    printf("  %15s | %8s | %8s | %8s | %8s\n", "Range", "mean", "min", "max", "neg_frac");

    int binsize = 2000;
    for (int lo = 4; lo <= MAX_E; lo += binsize) {
        int hi = lo + binsize - 1;
        if (hi > MAX_E) hi = MAX_E;
        double bsum = 0, bmin = 1e30, bmax = -1e30;
        int bcnt = 0, bneg = 0;

        for (int E = lo; E <= hi; E += 2) {
            double r_p = 0, r_t = 0;
            for (int p = 2; p <= E - 2; p++) {
                if (isc[p]) continue;
                int q = E - p;
                if (q < 2 || isc[q]) continue;
                double lp = log((double)p), lq = log((double)q);
                r_p += lp * lq;
                r_t += lp * lq * tau_normalized(&tau, p) * tau_normalized(&tau, q);
            }
            if (r_p > 0.01) {
                double r = r_t / r_p;
                bsum += r; bcnt++;
                if (r < bmin) bmin = r;
                if (r > bmax) bmax = r;
                if (r < 0) bneg++;
            }
        }
        if (bcnt > 0)
            printf("  %7d-%7d | %8.4f | %8.4f | %8.4f | %7.1f%%\n",
                   lo, hi, bsum/bcnt, bmin, bmax, 100.0*bneg/bcnt);
    }

    tau_free(&tau);
    free(isc);
    return 0;
}
