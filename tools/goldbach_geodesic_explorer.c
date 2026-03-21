/*
 * goldbach_geodesic_explorer.c
 * ============================
 * Numerical exploration of the additive_from_multiplicative gap.
 *
 * For each even integer 2N ≤ M, counts:
 *   r(2N)          = #{(p,q) : p+q = 2N, p,q prime}          (standard Goldbach)
 *   r_prod(2N, M)  = #{(p,q) : p+q = 2N, p·q ≤ M, p,q prime} (product-constrained)
 *
 * The geodesic pair count is analogous to r_prod: it bounds prime pairs whose
 * *product* (not sum) is bounded. The gap between r_prod and r is exactly
 * the `additive_from_multiplicative` obstruction.
 *
 * Build: cc -O3 -o goldbach_explorer goldbach_geodesic_explorer.c -lm
 * Usage: ./goldbach_explorer [M]     (default M = 1000000)
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <stdint.h>
#include <time.h>

/* ─── Sieve of Eratosthenes ──────────────────────────────────── */

static uint8_t *sieve;       /* sieve[i] = 1 iff i is prime */
static int     *primes;      /* sorted list of primes */
static int      prime_count;

static void build_sieve(int limit) {
    sieve = calloc(limit + 1, 1);
    if (!sieve) { perror("calloc"); exit(1); }
    memset(sieve, 1, limit + 1);
    sieve[0] = sieve[1] = 0;
    for (int64_t i = 2; i * i <= limit; i++) {
        if (sieve[i]) {
            for (int64_t j = i * i; j <= limit; j += i)
                sieve[j] = 0;
        }
    }
    /* Build prime list */
    prime_count = 0;
    for (int i = 2; i <= limit; i++)
        if (sieve[i]) prime_count++;
    primes = malloc(prime_count * sizeof(int));
    int idx = 0;
    for (int i = 2; i <= limit; i++)
        if (sieve[i]) primes[idx++] = i;
}

/* ─── Goldbach counting ──────────────────────────────────────── */

typedef struct {
    int standard;     /* r(2N): pairs with p+q = 2N */
    int product;      /* r_prod(2N,M): pairs with p+q = 2N AND p*q ≤ M */
} goldbach_count_t;

static goldbach_count_t count_goldbach(int two_n, int64_t prod_bound) {
    goldbach_count_t c = {0, 0};
    if (two_n < 4 || (two_n & 1)) return c;

    for (int i = 0; i < prime_count; i++) {
        int p = primes[i];
        if (p > two_n / 2) break;   /* unordered: p ≤ q */
        int q = two_n - p;
        if (q < 2 || q > two_n) break;
        if (!sieve[q]) continue;
        c.standard++;
        if ((int64_t)p * q <= prod_bound)
            c.product++;
    }
    return c;
}

/* ─── Modular analysis ───────────────────────────────────────── */

#define NUM_MODS 6
static const int mods[] = {6, 12, 30, 60, 210, 2310};

typedef struct {
    int     mod;
    int     classes;
    double *avg_standard;
    double *avg_product;
    int    *count;
} mod_analysis_t;

static mod_analysis_t *init_mod_analysis(void) {
    mod_analysis_t *ma = calloc(NUM_MODS, sizeof(mod_analysis_t));
    for (int m = 0; m < NUM_MODS; m++) {
        ma[m].mod = mods[m];
        ma[m].classes = mods[m];
        ma[m].avg_standard = calloc(mods[m], sizeof(double));
        ma[m].avg_product  = calloc(mods[m], sizeof(double));
        ma[m].count        = calloc(mods[m], sizeof(int));
    }
    return ma;
}

static void update_mod_analysis(mod_analysis_t *ma, int two_n, goldbach_count_t gc) {
    for (int m = 0; m < NUM_MODS; m++) {
        int cls = two_n % ma[m].mod;
        ma[m].avg_standard[cls] += gc.standard;
        ma[m].avg_product[cls]  += gc.product;
        ma[m].count[cls]++;
    }
}

static void print_mod_analysis(mod_analysis_t *ma) {
    printf("\n");
    printf("╔═════════════════════════════════════════════════════════════╗\n");
    printf("║  📊 Modular Ring Analysis                                   ║\n");
    printf("╚═════════════════════════════════════════════════════════════╝\n\n");

    for (int m = 0; m < NUM_MODS; m++) {
        printf("  mod %d (even residue classes with data):\n", ma[m].mod);
        printf("  %6s  %12s  %12s  %8s\n", "class", "avg_r(2N)", "avg_r_prod", "samples");
        printf("  %6s  %12s  %12s  %8s\n", "──────", "────────────", "────────────", "────────");
        for (int c = 0; c < ma[m].mod; c++) {
            if (ma[m].count[c] == 0) continue;
            if (c % 2 != 0) continue;  /* only even residues */
            double avg_s = ma[m].avg_standard[c] / ma[m].count[c];
            double avg_p = ma[m].avg_product[c]  / ma[m].count[c];
            printf("  %6d  %12.2f  %12.2f  %8d\n", c, avg_s, avg_p, ma[m].count[c]);
        }
        printf("\n");
    }
}

static void free_mod_analysis(mod_analysis_t *ma) {
    for (int m = 0; m < NUM_MODS; m++) {
        free(ma[m].avg_standard);
        free(ma[m].avg_product);
        free(ma[m].count);
    }
    free(ma);
}

/* ─── Histogram ──────────────────────────────────────────────── */

#define HIST_BUCKETS 20

static void print_histogram(const char *label, int *counts, int n, int max_val) {
    printf("  %s (distribution of representation counts):\n", label);
    int bucket_size = (max_val + HIST_BUCKETS - 1) / HIST_BUCKETS;
    if (bucket_size < 1) bucket_size = 1;

    int *hist = calloc(HIST_BUCKETS + 1, sizeof(int));
    for (int i = 0; i < n; i++) {
        int b = counts[i] / bucket_size;
        if (b >= HIST_BUCKETS) b = HIST_BUCKETS - 1;
        hist[b]++;
    }

    int hist_max = 0;
    for (int b = 0; b < HIST_BUCKETS; b++)
        if (hist[b] > hist_max) hist_max = hist[b];

    for (int b = 0; b < HIST_BUCKETS; b++) {
        if (hist[b] == 0) continue;
        int bar_len = (hist[b] * 50) / (hist_max > 0 ? hist_max : 1);
        printf("  [%5d-%5d] %6d  ", b * bucket_size, (b + 1) * bucket_size - 1,
               hist[b]);
        for (int j = 0; j < bar_len; j++) printf("█");
        printf("\n");
    }
    free(hist);
    printf("\n");
}

/* ─── Main ───────────────────────────────────────────────────── */

int main(int argc, char **argv) {
    int M = 1000000;  /* default */
    if (argc > 1) M = atoi(argv[1]);
    if (M < 100) M = 100;

    printf("╔═════════════════════════════════════════════════════════════╗\n");
    printf("║  🔭 Goldbach-Geodesic Explorer                              ║\n");
    printf("║  Numerical test of additive_from_multiplicative             ║\n");
    printf("╚═════════════════════════════════════════════════════════════╝\n\n");
    printf("  M = %d\n\n", M);

    /* ── Sieve ──────────────────────────────────────────────── */
    struct timespec t0, t1;
    clock_gettime(CLOCK_MONOTONIC, &t0);
    build_sieve(M);
    clock_gettime(CLOCK_MONOTONIC, &t1);
    double sieve_ms = (t1.tv_sec - t0.tv_sec) * 1000.0 +
                      (t1.tv_nsec - t0.tv_nsec) / 1e6;
    printf("  Sieve: %d primes up to %d (%.1f ms)\n\n", prime_count, M, sieve_ms);

    /* ── Count representations ──────────────────────────────── */
    int num_evens = M / 2 - 1;  /* even integers from 4 to M */
    int *r_standard = malloc(num_evens * sizeof(int));
    int *r_product  = malloc(num_evens * sizeof(int));

    int gaps_standard = 0;
    int gaps_product  = 0;
    int max_standard  = 0;
    int max_product   = 0;
    int min_standard  = M;
    int min_product   = M;
    int64_t sum_standard = 0;
    int64_t sum_product  = 0;

    mod_analysis_t *ma = init_mod_analysis();

    clock_gettime(CLOCK_MONOTONIC, &t0);

    /* Print progress header */
    printf("  Scanning even integers 4..%d:\n", M);

    int first_gap_standard = -1;
    int first_gap_product  = -1;

    for (int i = 0; i < num_evens; i++) {
        int two_n = 2 * (i + 2);  /* 4, 6, 8, ..., M */
        goldbach_count_t gc = count_goldbach(two_n, (int64_t)M);

        r_standard[i] = gc.standard;
        r_product[i]  = gc.product;

        if (gc.standard == 0) {
            gaps_standard++;
            if (first_gap_standard < 0) first_gap_standard = two_n;
        }
        if (gc.product == 0) {
            gaps_product++;
            if (first_gap_product < 0) first_gap_product = two_n;
        }

        if (gc.standard > max_standard) max_standard = gc.standard;
        if (gc.standard < min_standard) min_standard = gc.standard;
        if (gc.product  > max_product)  max_product  = gc.product;
        if (gc.product  < min_product)  min_product  = gc.product;
        sum_standard += gc.standard;
        sum_product  += gc.product;

        update_mod_analysis(ma, two_n, gc);

        /* Progress */
        if ((i + 1) % (num_evens / 10) == 0 || i == num_evens - 1) {
            printf("    ... %d/%d (%.0f%%)\n",
                   i + 1, num_evens, 100.0 * (i + 1) / num_evens);
        }
    }

    clock_gettime(CLOCK_MONOTONIC, &t1);
    double scan_ms = (t1.tv_sec - t0.tv_sec) * 1000.0 +
                     (t1.tv_nsec - t0.tv_nsec) / 1e6;

    /* ── Results ────────────────────────────────────────────── */
    printf("\n");
    printf("╔═════════════════════════════════════════════════════════════╗\n");
    printf("║  📈 Results                                                 ║\n");
    printf("╚═════════════════════════════════════════════════════════════╝\n\n");

    printf("  Scan completed in %.1f ms\n\n", scan_ms);

    printf("  ┌──────────────────────────────────┬──────────┬──────────┐\n");
    printf("  │ Metric                           │ Standard │ Product  │\n");
    printf("  │                                  │ r(2N)    │ r_prod   │\n");
    printf("  ├──────────────────────────────────┼──────────┼──────────┤\n");
    printf("  │ Even integers with 0 reps (GAPS) │ %8d │ %8d │\n",
           gaps_standard, gaps_product);
    printf("  │ Min representations              │ %8d │ %8d │\n",
           min_standard, min_product);
    printf("  │ Max representations              │ %8d │ %8d │\n",
           max_standard, max_product);
    printf("  │ Avg representations              │ %8.1f │ %8.1f │\n",
           (double)sum_standard / num_evens, (double)sum_product / num_evens);
    printf("  └──────────────────────────────────┴──────────┴──────────┘\n\n");

    if (gaps_product > 0) {
        printf("  ⚠️  GAPS FOUND in product-constrained count!\n");
        printf("  First gap:  2N = %d (r_prod = 0 but r = %d)\n",
               first_gap_product,
               r_standard[(first_gap_product / 2) - 2]);
        printf("  Total gaps: %d out of %d even integers (%.2f%%)\n\n",
               gaps_product, num_evens, 100.0 * gaps_product / num_evens);
        /* Print first 20 gaps */
        printf("  First product-constrained gaps:\n  ");
        int printed = 0;
        for (int i = 0; i < num_evens && printed < 20; i++) {
            if (r_product[i] == 0) {
                printf("%d ", 2 * (i + 2));
                printed++;
            }
        }
        printf("\n\n");
    } else {
        printf("  ✅ NO GAPS in product-constrained count!\n");
        printf("  Every even 2N ∈ [4, %d] has r_prod(2N, %d) > 0.\n", M, M);
        printf("  This is evidence FOR additive_from_multiplicative.\n\n");
    }

    if (gaps_standard > 0) {
        printf("  ⚠️  GAPS in standard Goldbach count!\n");
    } else {
        printf("  ✅ Goldbach verified: every even 2N ∈ [4, %d] = p + q.\n\n", M);
    }

    /* ── Histograms ─────────────────────────────────────────── */
    printf("╔═════════════════════════════════════════════════════════════╗\n");
    printf("║  📊 Histograms                                              ║\n");
    printf("╚═════════════════════════════════════════════════════════════╝\n\n");

    print_histogram("r(2N) — standard Goldbach", r_standard, num_evens, max_standard);
    print_histogram("r_prod(2N,M) — product-constrained", r_product, num_evens, max_product);

    /* ── Modular analysis ───────────────────────────────────── */
    print_mod_analysis(ma);

    /* ── Ratio analysis ─────────────────────────────────────── */
    printf("╔═════════════════════════════════════════════════════════════╗\n");
    printf("║  📐 Product/Standard Ratio by 2N magnitude                  ║\n");
    printf("╚═════════════════════════════════════════════════════════════╝\n\n");

    printf("  %12s  %10s  %10s  %10s\n", "2N range", "avg r(2N)", "avg r_prod", "ratio");
    printf("  %12s  %10s  %10s  %10s\n", "────────────", "──────────", "──────────", "──────────");

    int ranges = 10;
    int range_size = num_evens / ranges;
    for (int r = 0; r < ranges; r++) {
        int start = r * range_size;
        int end   = (r == ranges - 1) ? num_evens : (r + 1) * range_size;
        double rs = 0, rp = 0;
        int cnt = 0;
        for (int i = start; i < end; i++) {
            rs += r_standard[i];
            rp += r_product[i];
            cnt++;
        }
        rs /= cnt; rp /= cnt;
        int two_n_lo = 2 * (start + 2);
        int two_n_hi = 2 * (end + 1);
        printf("  [%5d-%5d]  %10.1f  %10.1f  %10.4f\n",
               two_n_lo, two_n_hi, rs, rp, rp / (rs > 0 ? rs : 1));
    }
    printf("\n");

    /* ── Cleanup ────────────────────────────────────────────── */
    free_mod_analysis(ma);
    free(r_standard);
    free(r_product);
    free(primes);
    free(sieve);

    printf("Done.\n");
    return 0;
}
