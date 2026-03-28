/*
 * goldbach_threshold_test.c — v2 (optimized)
 * ============================================
 * Key optimization: by quadratic_reduction (Lemma 1), if p+q=2N and p*q≤M,
 * then p ≤ M/(2N). So the inner loop only checks primes up to M/(2N),
 * NOT all primes up to N. This is O(M/(2N·logN)) per 2N instead of O(N/logN).
 */

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <math.h>
#include <time.h>

#define LIMIT 2000000

static uint8_t *sieve;

static void build_sieve(uint64_t max_val) {
    sieve = calloc(max_val + 1, 1);
    if (!sieve) { fprintf(stderr, "OOM\n"); exit(1); }
    for (uint64_t i = 2; i <= max_val; i++) sieve[i] = 1;
    for (uint64_t i = 2; i * i <= max_val; i++)
        if (sieve[i])
            for (uint64_t j = i * i; j <= max_val; j += i)
                sieve[j] = 0;
}

/* Check if 2N has a Goldbach pair (p,q) with p*q ≤ M.
   By quadratic reduction, only check p ≤ M/q ≤ M/N (since q ≥ N). */
static int has_bounded_pair(uint64_t twoN, uint64_t M) {
    uint64_t N = twoN / 2;
    uint64_t p_max = (N > 0) ? M / N : M; /* p ≤ M/N from Lemma 1 */
    if (p_max > N) p_max = N;              /* p ≤ q means p ≤ N */
    if (p_max >= twoN) p_max = twoN - 2;   /* sanity */

    for (uint64_t p = 2; p <= p_max; p++) {
        if (!sieve[p]) continue;
        uint64_t q = twoN - p;
        if (q > (uint64_t)LIMIT) continue; /* out of sieve range */
        if (!sieve[q]) continue;
        if (p * q <= M) return 1;
    }
    return 0;
}

int main(void) {
    clock_t t0 = clock();
    printf("=== Goldbach N·log²(N) Threshold Test (v2, optimized) ===\n");
    printf("Limit: 2N up to %d\n\n", LIMIT);

    build_sieve(LIMIT);
    printf("Sieve built: %.2fs\n\n", (double)(clock()-t0)/CLOCKS_PER_SEC);

    /* --- Fixed M baseline --- */
    printf("--- Baseline: Fixed M = %d ---\n", LIMIT);
    {
        uint64_t gaps = 0, total = 0;
        for (uint64_t twoN = 4; twoN <= LIMIT; twoN += 2) {
            total++;
            if (!has_bounded_pair(twoN, LIMIT)) gaps++;
        }
        printf("  Gaps: %llu / %llu (%.1f%%)\n\n", gaps, total, 100.0*gaps/total);
    }
    printf("Baseline done: %.2fs\n\n", (double)(clock()-t0)/CLOCKS_PER_SEC);

    /* --- Dynamic M(N) = C * N * log²(N) --- */
    double C_values[] = {0.5, 1.0, 2.0, 3.0, 4.0, 6.0, 8.0, 10.0, 20.0};
    int num_C = sizeof(C_values) / sizeof(C_values[0]);

    printf("--- Dynamic M(N) = C · N · log²(N) ---\n");
    printf("%-8s %10s %10s %8s %12s %10s\n",
           "C", "Gaps", "Total", "Gap%", "First Gap", "Time");
    printf("--------------------------------------------------------------\n");

    for (int ci = 0; ci < num_C; ci++) {
        double C = C_values[ci];
        uint64_t gaps = 0, total = 0, first_gap = 0;
        clock_t tc = clock();

        for (uint64_t twoN = 4; twoN <= LIMIT; twoN += 2) {
            uint64_t N = twoN / 2;
            double logN = (N >= 2) ? log((double)N) : 1.0;
            uint64_t M = (uint64_t)(C * (double)N * logN * logN);

            total++;
            if (!has_bounded_pair(twoN, M)) {
                gaps++;
                if (!first_gap) first_gap = twoN;
            }
        }

        double dt = (double)(clock()-tc)/CLOCKS_PER_SEC;
        printf("%-8.1f %10llu %10llu %7.2f%% %12llu %9.2fs\n",
               C, gaps, total, 100.0*gaps/total, first_gap, dt);
        fflush(stdout); /* flush after each C so user sees progress */
    }

    /* --- Decile breakdown for C = 6 --- */
    printf("\n--- Decile breakdown: C = 6, M(N) = 6·N·log²(N) ---\n");
    printf("%-20s %8s %8s %8s %12s\n", "Range", "Gaps", "Total", "Gap%", "Avg M/N");
    {
        double C = 6.0;
        uint64_t dec_count = (LIMIT / 2 - 1) / 10;

        for (int d = 0; d < 10; d++) {
            uint64_t lo = 4 + d * dec_count * 2;
            uint64_t hi = lo + dec_count * 2 - 2;
            if (d == 9) hi = LIMIT;
            if (hi > LIMIT) hi = LIMIT;

            uint64_t gaps = 0, total = 0;
            double sum_ratio = 0;

            for (uint64_t twoN = lo; twoN <= hi; twoN += 2) {
                uint64_t N = twoN / 2;
                double logN = (N >= 2) ? log((double)N) : 1.0;
                double M_dyn = C * (double)N * logN * logN;
                sum_ratio += M_dyn / (double)N; /* = C·log²N */

                total++;
                if (!has_bounded_pair(twoN, (uint64_t)M_dyn)) gaps++;
            }
            printf("%7lluK - %7lluK %8llu %8llu %7.2f%% %11.1f\n",
                   lo/1000, hi/1000, gaps, total, 100.0*gaps/total,
                   sum_ratio/total);
        }
    }

    /* --- Window histogram for C=6 --- */
    printf("\n--- Smallest prime p in product-bounded pair (C=6) ---\n");
    {
        double C = 6.0;
        uint64_t hist[100] = {0};
        uint64_t total = 0, missed = 0;

        for (uint64_t twoN = 100; twoN <= LIMIT; twoN += 2) {
            uint64_t N = twoN / 2;
            double logN = log((double)N);
            uint64_t M = (uint64_t)(C * (double)N * logN * logN);
            uint64_t p_max = M / N;
            if (p_max > N) p_max = N;

            int found = 0;
            for (uint64_t p = 2; p <= p_max; p++) {
                if (!sieve[p]) continue;
                uint64_t q = twoN - p;
                if (q > LIMIT) continue;
                if (!sieve[q]) continue;
                if (p * q <= M) {
                    uint64_t idx = (p < 100) ? p : 99;
                    hist[idx]++;
                    found = 1;
                    break;
                }
            }
            total++;
            if (!found) missed++;
        }

        for (int i = 2; i < 100; i++)
            if (hist[i] > 0)
                printf("  p = %2d: %8llu (%.1f%%)\n", i, hist[i], 100.0*hist[i]/total);
        if (missed) printf("  missed: %llu\n", missed);
    }

    printf("\nTotal time: %.2fs\n", (double)(clock()-t0)/CLOCKS_PER_SEC);
    free(sieve);
    return 0;
}
