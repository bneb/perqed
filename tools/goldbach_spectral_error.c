/*
 * goldbach_spectral_error.c
 * =========================
 * Empirically measure the Hardy-Littlewood spectral error for Goldbach.
 *
 * For each even 2N, computes:
 *   r(2N)     = actual Goldbach representation count
 *   HL(2N)    = Hardy-Littlewood prediction = 2·C₂·S(2N)·N/log²(N)
 *   Error(2N) = r(2N) - HL(2N)
 *   Ratio     = |Error| / HL
 *
 * The singular series S(2N) = ∏_{p|N, p≥3} (p-1)/(p-2) captures
 * the modular arithmetic of each target 2N.
 *
 * The twin prime constant C₂ = ∏_{p≥3} (1 - 1/(p-1)²) ≈ 0.6602.
 *
 * If the spectral route works, |Error|/HL → 0 as N → ∞.
 */

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <math.h>
#include <time.h>

#define LIMIT 1000000

static uint8_t *sieve;
/* smallest prime factor for singular series computation */
static uint32_t *spf;

static void build_sieve(uint64_t max_val) {
    sieve = calloc(max_val + 1, 1);
    spf   = calloc(max_val + 1, sizeof(uint32_t));
    if (!sieve || !spf) { fprintf(stderr, "OOM\n"); exit(1); }
    for (uint64_t i = 2; i <= max_val; i++) { sieve[i] = 1; spf[i] = 0; }
    for (uint64_t i = 2; i <= max_val; i++) {
        if (sieve[i]) {
            spf[i] = (uint32_t)i; /* i is its own smallest prime factor */
            if (i * i <= max_val) {
                for (uint64_t j = i * i; j <= max_val; j += i) {
                    sieve[j] = 0;
                    if (spf[j] == 0) spf[j] = (uint32_t)i;
                }
            }
        }
    }
}

/* Count unordered Goldbach pairs: #{(p,q) : p+q=2N, p≤q, p,q prime} */
static uint32_t goldbach_count(uint64_t twoN) {
    uint32_t count = 0;
    uint64_t N = twoN / 2;
    for (uint64_t p = 2; p <= N; p++) {
        if (!sieve[p]) continue;
        uint64_t q = twoN - p;
        if (q > (uint64_t)LIMIT) continue;
        if (sieve[q]) count++;
    }
    return count;
}

/* Compute singular series S(2N) = ∏_{p|N, p≥3} (p-1)/(p-2)
   by factoring N via the smallest-prime-factor sieve */
static double singular_series(uint64_t N) {
    double S = 1.0;
    uint64_t n = N;
    while (n > 1) {
        uint32_t p;
        if (n <= (uint64_t)LIMIT && spf[n] != 0)
            p = spf[n];
        else if (sieve[n])
            p = (uint32_t)n;
        else
            break; /* shouldn't happen for n ≤ LIMIT */

        if (p >= 3)
            S *= (double)(p - 1) / (double)(p - 2);

        /* remove all factors of p */
        while (n % p == 0) n /= p;
    }
    return S;
}

int main(void) {
    clock_t t0 = clock();
    printf("=== Goldbach Spectral Error Analysis ===\n");
    printf("Limit: 2N up to %d\n\n", LIMIT);

    build_sieve(LIMIT);

    /* Compute twin prime constant C2 = ∏_{p≥3} (1 - 1/(p-1)^2)
       Truncate product at primes up to LIMIT (more than sufficient) */
    double C2 = 1.0;
    for (uint64_t p = 3; p <= (uint64_t)LIMIT; p++) {
        if (!sieve[p]) continue;
        C2 *= 1.0 - 1.0 / ((double)(p-1) * (double)(p-1));
    }
    printf("Twin prime constant C₂ ≈ %.6f\n", C2);
    printf("Sieve built: %.2fs\n\n", (double)(clock()-t0)/CLOCKS_PER_SEC);

    /* --- Decile analysis --- */
    printf("--- Decile Analysis: |Error|/HL ratio ---\n");
    printf("%-18s %8s %10s %10s %8s %8s %8s\n",
           "Range", "Count", "Avg r(2N)", "Avg HL", "Avg Err", "MaxRatio", "AvgRatio");

    uint64_t dec_size = (LIMIT / 2) / 10;

    /* Also accumulate stats for overall analysis */
    double total_ratio_sum = 0;
    uint64_t total_count = 0;
    double max_ratio_overall = 0;

    /* Track ratio vs N for scaling analysis */
    double ratio_by_logN[20] = {0};
    uint64_t ratio_by_logN_count[20] = {0};

    for (int d = 0; d < 10; d++) {
        uint64_t lo = 4 + d * dec_size * 2;
        uint64_t hi = lo + dec_size * 2 - 2;
        if (d == 9) hi = LIMIT;
        if (hi > (uint64_t)LIMIT) hi = LIMIT;

        uint64_t count = 0;
        double sum_r = 0, sum_hl = 0, sum_ratio = 0;
        double max_ratio = 0;

        for (uint64_t twoN = lo; twoN <= hi; twoN += 2) {
            uint64_t N = twoN / 2;
            if (N < 3) continue;

            uint32_t r = goldbach_count(twoN);
            double logN = log((double)N);
            double S = singular_series(N);
            double HL = 2.0 * C2 * S * (double)N / (logN * logN);

            double error = fabs((double)r - HL);
            double ratio = (HL > 0) ? error / HL : 0;

            sum_r += r;
            sum_hl += HL;
            sum_ratio += ratio;
            if (ratio > max_ratio) max_ratio = ratio;
            count++;

            total_ratio_sum += ratio;
            total_count++;
            if (ratio > max_ratio_overall) max_ratio_overall = ratio;

            /* Bin by log(N) for scaling analysis */
            int bin = (int)(logN) - 1;
            if (bin < 0) bin = 0;
            if (bin >= 20) bin = 19;
            ratio_by_logN[bin] += ratio;
            ratio_by_logN_count[bin]++;
        }

        printf("%7lluK - %7lluK %8llu %10.1f %10.1f %8.4f %8.4f %8.4f\n",
               lo/1000, hi/1000, count, sum_r/count, sum_hl/count,
               (sum_r - sum_hl)/count, max_ratio, sum_ratio/count);
        fflush(stdout);
    }

    printf("\n--- Overall ---\n");
    printf("Average |Error|/HL:  %.6f\n", total_ratio_sum / total_count);
    printf("Max |Error|/HL:      %.6f\n", max_ratio_overall);

    /* Scaling analysis: does |Error|/HL decrease with N? */
    printf("\n--- Scaling: Average |Error|/HL by log(N) ---\n");
    printf("%-10s %10s %10s\n", "log(N)", "Avg Ratio", "Count");
    for (int i = 0; i < 20; i++) {
        if (ratio_by_logN_count[i] > 0) {
            printf("%-10.1f %10.6f %10llu\n",
                   (double)(i + 1),
                   ratio_by_logN[i] / ratio_by_logN_count[i],
                   ratio_by_logN_count[i]);
        }
    }

    /* Specific examples: show prediction vs actual */
    printf("\n--- Sample predictions (every 100K) ---\n");
    printf("%-10s %8s %10s %10s %8s\n", "2N", "r(2N)", "HL(2N)", "Error", "|E|/HL");
    uint64_t samples[] = {100000, 200000, 300000, 400000, 500000,
                          600000, 700000, 800000, 900000, 1000000};
    for (int i = 0; i < 10; i++) {
        uint64_t twoN = samples[i];
        uint64_t N = twoN / 2;
        uint32_t r = goldbach_count(twoN);
        double logN = log((double)N);
        double S = singular_series(N);
        double HL = 2.0 * C2 * S * (double)N / (logN * logN);
        double err = (double)r - HL;
        printf("%-10llu %8u %10.1f %+10.1f %8.4f\n",
               twoN, r, HL, err, fabs(err)/HL);
    }

    /* RMS error scaling: compute sqrt(variance(Error/HL)) per decile */
    printf("\n--- RMS(Error/HL) by decile (spectral error decay test) ---\n");
    printf("%-18s %10s %10s\n", "Range", "RMS ratio", "1/sqrt(N)");
    for (int d = 0; d < 10; d++) {
        uint64_t lo = 4 + d * dec_size * 2;
        uint64_t hi = lo + dec_size * 2 - 2;
        if (d == 9) hi = LIMIT;
        if (hi > (uint64_t)LIMIT) hi = LIMIT;

        double sum_sq = 0;
        uint64_t count = 0;
        double mid_N = 0;

        for (uint64_t twoN = lo; twoN <= hi; twoN += 2) {
            uint64_t N = twoN / 2;
            if (N < 3) continue;

            uint32_t r = goldbach_count(twoN);
            double logN = log((double)N);
            double S = singular_series(N);
            double HL = 2.0 * C2 * S * (double)N / (logN * logN);
            double ratio = ((double)r - HL) / HL;
            sum_sq += ratio * ratio;
            count++;
            mid_N += N;
        }
        mid_N /= count;
        double rms = sqrt(sum_sq / count);
        printf("%7lluK - %7lluK %10.6f %10.6f\n",
               lo/1000, hi/1000, rms, 1.0/sqrt(mid_N));
    }

    printf("\nDone in %.2fs\n", (double)(clock()-t0)/CLOCKS_PER_SEC);
    free(sieve);
    free(spf);
    return 0;
}
