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
    int standard;        /* r(2N): pairs with p+q = 2N */
    int product;         /* r_prod(2N,M): pairs with p+q = 2N AND p*q ≤ M */
    int64_t min_product; /* min p*q over all pairs with p+q = 2N */
    int64_t max_product; /* max p*q over all pairs with p+q = 2N */
} goldbach_count_t;

static goldbach_count_t count_goldbach(int two_n, int64_t prod_bound) {
    goldbach_count_t c = {0, 0, INT64_MAX, 0};
    if (two_n < 4 || (two_n & 1)) return c;

    for (int i = 0; i < prime_count; i++) {
        int p = primes[i];
        if (p > two_n / 2) break;
        int q = two_n - p;
        if (q < 2 || q > two_n) break;
        if (!sieve[q]) continue;
        c.standard++;
        int64_t pq = (int64_t)p * q;
        if (pq < c.min_product) c.min_product = pq;
        if (pq > c.max_product) c.max_product = pq;
        if (pq <= prod_bound)
            c.product++;
    }
    if (c.standard == 0) c.min_product = 0;
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

    /* ── Hyperbolic Geodesic Analysis ────────────────────────── */
    printf("╔═════════════════════════════════════════════════════════════╗\n");
    printf("║  🌀 Hyperbolic Geodesic Analysis                            ║\n");
    printf("╚═════════════════════════════════════════════════════════════╝\n\n");

    /*
     * On an arithmetic surface, each prime p corresponds to a prime geodesic
     * of length ℓ(γ) = 2·log(p). We analyze:
     *   1. The length spectrum distribution
     *   2. The geodesic pair count Π₂(x) = #{(γ,γ') : ℓ(γ)+ℓ(γ') ≤ x}
     *   3. Comparison to the theoretical eˣ/x² asymptotic
     *   4. What integer sums p+q the geodesic pairs actually produce
     */

    /* ── 1. Length spectrum ─────────────────────────────────── */
    printf("  1. LENGTH SPECTRUM ℓ(γ) = 2·log(p)\n");
    printf("  ─────────────────────────────────────\n");
    double min_length = 2.0 * log(2.0);
    double max_length = 2.0 * log((double)primes[prime_count - 1]);
    printf("  Primes in sieve:  %d\n", prime_count);
    printf("  Min geodesic len: %.4f  (p=2, ℓ=2·log2)\n", min_length);
    printf("  Max geodesic len: %.4f  (p=%d, ℓ=2·log%d)\n",
           max_length, primes[prime_count - 1], primes[prime_count - 1]);

    /* Length histogram: bucket geodesic lengths */
    int n_lbuckets = 20;
    double l_step = max_length / n_lbuckets;
    int *l_hist = calloc(n_lbuckets + 1, sizeof(int));
    for (int i = 0; i < prime_count; i++) {
        double l = 2.0 * log((double)primes[i]);
        int b = (int)(l / l_step);
        if (b >= n_lbuckets) b = n_lbuckets - 1;
        l_hist[b]++;
    }
    int l_hist_max = 0;
    for (int b = 0; b < n_lbuckets; b++)
        if (l_hist[b] > l_hist_max) l_hist_max = l_hist[b];

    printf("\n  Length spectrum histogram:\n");
    for (int b = 0; b < n_lbuckets; b++) {
        if (l_hist[b] == 0) continue;
        int bar = (l_hist[b] * 40) / (l_hist_max > 0 ? l_hist_max : 1);
        printf("  [%5.2f-%5.2f] %6d  ", b * l_step, (b + 1) * l_step, l_hist[b]);
        for (int j = 0; j < bar; j++) printf("▓");
        printf("\n");
    }
    free(l_hist);

    /* ── 2. Geodesic pair count Π₂(x) ─────────────────────── */
    printf("\n  2. GEODESIC PAIR COUNT Π₂(x) vs eˣ/x²\n");
    printf("  ─────────────────────────────────────────\n");
    printf("  Π₂(x) = #{ordered (p,q) prime : 2·log(p) + 2·log(q) ≤ x}\n");
    printf("        = #{(p,q) prime : p·q ≤ e^(x/2)}\n\n");

    printf("  %8s  %12s  %12s  %10s  %10s\n",
           "x", "e^(x/2)", "Π₂(x)", "eˣ/x²", "ratio");
    printf("  %8s  %12s  %12s  %10s  %10s\n",
           "────────", "────────────", "────────────", "──────────", "──────────");

    /* Sample x values from 4 to 2·log(M) */
    double x_max = 2.0 * log((double)M);
    int n_samples = 15;
    for (int s = 0; s < n_samples; s++) {
        double x = 4.0 + (x_max - 4.0) * s / (n_samples - 1);
        double prod_lim = exp(x / 2.0);  /* p·q ≤ e^(x/2) */
        int64_t plim = (int64_t)prod_lim;
        if (plim > (int64_t)M * M) plim = (int64_t)M * M;

        /* Count ordered pairs (p,q) with p·q ≤ plim */
        int64_t pair_cnt = 0;
        for (int i = 0; i < prime_count; i++) {
            int p = primes[i];
            if ((int64_t)p * p > plim) break;
            /* For each p, count primes q ≤ plim/p via binary search */
            int64_t q_max = plim / p;
            /* Binary search for largest prime index j with primes[j] ≤ q_max */
            int lo = i, hi = prime_count - 1, best = -1;
            while (lo <= hi) {
                int mid = lo + (hi - lo) / 2;
                if (primes[mid] <= q_max) { best = mid; lo = mid + 1; }
                else hi = mid - 1;
            }
            if (best >= i) {
                pair_cnt += 2 * (best - i);  /* ordered: (p,q) and (q,p) */
                pair_cnt += 1;               /* p == q case */
            }
        }

        double theoretical = exp(x) / (x * x);
        double ratio = (theoretical > 0) ? pair_cnt / theoretical : 0;
        printf("  %8.2f  %12.0f  %12lld  %10.0f  %10.4f\n",
               x, prod_lim, (long long)pair_cnt, theoretical, ratio);
    }

    /* ── 3. Geodesic pair → integer sum coverage ──────────── */
    printf("\n  3. GEODESIC PAIR → INTEGER SUM COVERAGE\n");
    printf("  ─────────────────────────────────────────\n");
    printf("  For each x, what fraction of even integers ≤ 2·√(e^(x/2))\n");
    printf("  are achievable as p+q where p·q ≤ e^(x/2)?\n\n");

    printf("  %8s  %10s  %10s  %10s  %10s\n",
           "x", "prod_bnd", "max_sum", "evens_hit", "coverage");
    printf("  %8s  %10s  %10s  %10s  %10s\n",
           "────────", "──────────", "──────────", "──────────", "──────────");

    for (int s = 0; s < 10; s++) {
        double x = 6.0 + (x_max - 6.0) * s / 9.0;
        double prod_lim = exp(x / 2.0);
        int64_t plim = (int64_t)prod_lim;
        if (plim > (int64_t)M) plim = M;  /* limited by sieve */

        /* Max possible sum for pairs with product ≤ plim:
         * p + q ≤ p·q + 1 ≤ plim + 1  (for p,q ≥ 2)
         * But more precisely, max sum is 2 + (plim/2) when p=2 */
        int max_sum = (int)(plim / 2) + 2;
        if (max_sum > M) max_sum = M;

        /* Track which even integers are hit */
        int sum_slots = max_sum / 2 + 1;
        uint8_t *hit = calloc(sum_slots, 1);
        int evens_hit = 0;

        for (int i = 0; i < prime_count; i++) {
            int p = primes[i];
            if ((int64_t)p * p > plim) break;
            int64_t q_max = plim / p;
            for (int j = i; j < prime_count && primes[j] <= q_max; j++) {
                int s_val = p + primes[j];
                if (s_val <= max_sum && (s_val % 2 == 0)) {
                    int idx = s_val / 2;
                    if (idx < sum_slots && !hit[idx]) {
                        hit[idx] = 1;
                        evens_hit++;
                    }
                }
            }
        }

        int total_evens = max_sum / 2 - 1;  /* even integers 4..max_sum */
        double coverage = total_evens > 0 ? 100.0 * evens_hit / total_evens : 0;
        printf("  %8.2f  %10lld  %10d  %10d  %9.2f%%\n",
               x, (long long)plim, max_sum, evens_hit, coverage);
        free(hit);
    }

    /* ── 4. Bridge gap: geodesic vs additive ──────────────── */
    printf("\n  4. BRIDGE GAP ANALYSIS\n");
    printf("  ─────────────────────────────────────────\n");
    printf("  The additive_from_multiplicative axiom asks:\n");
    printf("  does p·q ≤ M for primes p,q guarantee p+q hits all evens?\n\n");

    /* Use full sieve limit M as the product bound */
    {
        int max_sum_full = M / 2 + 2;
        if (max_sum_full > M) max_sum_full = M;
        int sum_slots = max_sum_full / 2 + 1;
        uint8_t *hit = calloc(sum_slots, 1);
        int evens_hit = 0;
        int64_t total_pairs = 0;

        for (int i = 0; i < prime_count; i++) {
            int p = primes[i];
            if ((int64_t)p * p > (int64_t)M) break;
            int64_t q_max = (int64_t)M / p;
            for (int j = i; j < prime_count && primes[j] <= q_max; j++) {
                total_pairs++;
                int s_val = p + primes[j];
                if (s_val <= max_sum_full && (s_val % 2 == 0)) {
                    int idx = s_val / 2;
                    if (idx < sum_slots && !hit[idx]) {
                        hit[idx] = 1;
                        evens_hit++;
                    }
                }
            }
        }

        int total_evens = max_sum_full / 2 - 1;
        printf("  Product bound:       M = %d\n", M);
        printf("  Total geodesic pairs (p·q ≤ M): %lld\n", (long long)total_pairs);
        printf("  Max achievable sum:  %d\n", max_sum_full);
        printf("  Even integers hit:   %d / %d (%.2f%%)\n",
               evens_hit, total_evens, 100.0 * evens_hit / (total_evens > 0 ? total_evens : 1));
        printf("  Even integers missed: %d\n\n", total_evens - evens_hit);

        if (evens_hit >= total_evens) {
            printf("  ✅ ALL even integers up to %d are geodesic-reachable!\n\n", max_sum_full);
        } else {
            /* Find the first missed even */
            int first_miss = -1;
            for (int k = 2; k < sum_slots; k++) {
                if (!hit[k]) { first_miss = 2 * k; break; }
            }
            printf("  ⚠️  First even integer NOT reachable: %d\n", first_miss);
            printf("  This is an even N where no primes p,q with p·q ≤ %d sum to N.\n\n", M);

            /* Count missed by magnitude */
            printf("  Missed even integers by range:\n");
            int range_sz = max_sum_full / 10;
            for (int r = 0; r < 10; r++) {
                int r_start = r * range_sz / 2;
                int r_end = (r + 1) * range_sz / 2;
                if (r_end > sum_slots) r_end = sum_slots;
                int missed_in_range = 0;
                int total_in_range = 0;
                for (int k = r_start; k < r_end; k++) {
                    if (k >= 2) {  /* skip 0 and 2 */
                        total_in_range++;
                        if (!hit[k]) missed_in_range++;
                    }
                }
                printf("    [%6d - %6d]: %5d missed / %5d (%.1f%%)\n",
                       r * range_sz, (r + 1) * range_sz,
                       missed_in_range, total_in_range,
                       total_in_range > 0 ? 100.0 * missed_in_range / total_in_range : 0);
            }
            printf("\n");
        }
        free(hit);
    }

    /* ── 5. Delta/Epsilon Distance Analysis ─────────────────── */
    printf("\n");
    printf("╔═════════════════════════════════════════════════════════════╗\n");
    printf("║  📏 Delta/Epsilon Distance Analysis                         ║\n");
    printf("╚═════════════════════════════════════════════════════════════╝\n\n");
    printf("  δ(2N) = min_{p+q=2N, p,q prime} p·q\n");
    printf("  ε(2N) = δ(2N) / M  (normalized: <1 means product bound satisfied)\n\n");

    /* Recompute with distance tracking */
    int64_t *delta_arr = malloc(num_evens * sizeof(int64_t));
    int64_t *delta_max_arr = malloc(num_evens * sizeof(int64_t));
    for (int i = 0; i < num_evens; i++) {
        int two_n = 2 * (i + 2);
        goldbach_count_t gc = count_goldbach(two_n, (int64_t)M);
        delta_arr[i] = gc.min_product;
        delta_max_arr[i] = gc.max_product;
    }

    /* Delta distribution by 2N range */
    printf("  %12s  %12s  %12s  %12s  %12s\n",
           "2N range", "avg δ(2N)", "avg ε=δ/M", "min δ", "max δ");
    printf("  %12s  %12s  %12s  %12s  %12s\n",
           "────────────", "────────────", "────────────", "────────────", "────────────");

    int d_ranges = 10;
    int d_range_size = num_evens / d_ranges;
    for (int r = 0; r < d_ranges; r++) {
        int start = r * d_range_size;
        int end = (r == d_ranges - 1) ? num_evens : (r + 1) * d_range_size;
        double avg_delta = 0;
        int64_t min_d = INT64_MAX, max_d = 0;
        int cnt = 0;
        for (int i = start; i < end; i++) {
            if (delta_arr[i] > 0) {
                avg_delta += (double)delta_arr[i];
                if (delta_arr[i] < min_d) min_d = delta_arr[i];
                if (delta_arr[i] > max_d) max_d = delta_arr[i];
                cnt++;
            }
        }
        avg_delta = cnt > 0 ? avg_delta / cnt : 0;
        int two_n_lo = 2 * (start + 2);
        int two_n_hi = 2 * (end + 1);
        printf("  [%5d-%5d]  %12.0f  %12.6f  %12lld  %12lld\n",
               two_n_lo, two_n_hi, avg_delta, avg_delta / M,
               (long long)(min_d == INT64_MAX ? 0 : min_d), (long long)max_d);
    }

    /* Epsilon threshold analysis */
    printf("\n  Epsilon threshold: how many 2N have ε ≤ threshold?\n");
    double thresholds[] = {0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 100.0};
    int n_thresh = sizeof(thresholds) / sizeof(thresholds[0]);
    printf("  %10s  %10s  %10s\n", "ε ≤", "count", "fraction");
    printf("  %10s  %10s  %10s\n", "──────────", "──────────", "──────────");
    for (int t = 0; t < n_thresh; t++) {
        int cnt = 0;
        for (int i = 0; i < num_evens; i++) {
            double eps = (double)delta_arr[i] / M;
            if (eps <= thresholds[t]) cnt++;
        }
        printf("  %10.2f  %10d  %10.4f\n", thresholds[t], cnt, (double)cnt / num_evens);
    }

    /* CSV export */
    {
        char csv_path[256];
        snprintf(csv_path, sizeof(csv_path),
                 "/Users/kevin/projects/perqed/tools/goldbach_geodesic_M%d.csv", M);
        FILE *csv = fopen(csv_path, "w");
        if (csv) {
            fprintf(csv, "two_n,r_standard,r_product,min_product,max_product,"
                         "epsilon,log_two_n,geodesic_x\n");
            for (int i = 0; i < num_evens; i++) {
                int two_n = 2 * (i + 2);
                double eps = (double)delta_arr[i] / M;
                double geodesic_x = (delta_arr[i] > 0) ? 2.0 * log((double)delta_arr[i]) : 0;
                fprintf(csv, "%d,%d,%d,%lld,%lld,%.8f,%.6f,%.6f\n",
                        two_n, r_standard[i], r_product[i],
                        (long long)delta_arr[i], (long long)delta_max_arr[i],
                        eps, log((double)two_n), geodesic_x);
            }
            fclose(csv);
            printf("\n  📁 CSV exported: %s\n", csv_path);
            printf("  Columns: two_n, r_standard, r_product, min_product,\n");
            printf("           max_product, epsilon, log_two_n, geodesic_x\n");
        }
    }

    free(delta_arr);
    free(delta_max_arr);

    /* ── Cleanup ────────────────────────────────────────────── */
    free_mod_analysis(ma);
    free(r_standard);
    free(r_product);
    free(primes);
    free(sieve);

    printf("Done.\n");
    return 0;
}

