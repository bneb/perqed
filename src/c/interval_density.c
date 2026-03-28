/*
 * interval_density.c — Test interval-density Goldbach coverage.
 *
 * Conjecture: If A ⊆ Primes has density ≥ δ in every interval
 * [x, x+H] (for all x ≤ N), then A+A covers (1-ε)·100% of evens ≤ 2N.
 *
 * Tests various (δ, H) parameters and both deterministic and randomized
 * constructions satisfying the interval-density constraint.
 *
 * BUILD: cc -O3 -o interval_density interval_density.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 300001

static char is_composite[MAX_N];
static int primes[30000];
static int num_primes = 0;

void sieve(int limit) {
    memset(is_composite, 0, limit + 1);
    is_composite[0] = is_composite[1] = 1;
    for (int i = 2; (long long)i*i <= limit; i++)
        if (!is_composite[i])
            for (int j = i*i; j <= limit; j += i)
                is_composite[j] = 1;
    for (int i = 2; i <= limit; i++)
        if (!is_composite[i])
            primes[num_primes++] = i;
}

static unsigned long long rng = 98765432101234567ULL;
double randu() {
    rng ^= rng << 13; rng ^= rng >> 7; rng ^= rng << 17;
    return (rng & 0xFFFFFFF) / (double)0x10000000;
}

/* Construct subset with density ≥ δ in every interval of length H.
 * Strategy: divide [2, N] into blocks of length H.
 * In each block, include ⌈δ · (primes in block)⌉ primes, chosen uniformly. */
int construct_interval_subset(double delta, int H, int N, int *selected) {
    int n_sel = 0;
    char *included = calloc(num_primes, 1);

    /* Process blocks */
    for (int block_start = 2; block_start <= N; block_start += H) {
        int block_end = block_start + H - 1;
        if (block_end > N) block_end = N;

        /* Find primes in this block */
        int block_primes[5000];
        int n_block = 0;
        for (int i = 0; i < num_primes; i++)
            if (primes[i] >= block_start && primes[i] <= block_end)
                block_primes[n_block++] = i;

        /* Include ⌈δ · n_block⌉ primes from this block */
        int need = (int)ceil(delta * n_block);
        if (need > n_block) need = n_block;

        /* Shuffle and pick first 'need' (Fisher-Yates) */
        for (int i = n_block - 1; i > 0; i--) {
            int j = (int)(randu() * (i + 1));
            if (j > i) j = i;
            int tmp = block_primes[i];
            block_primes[i] = block_primes[j];
            block_primes[j] = tmp;
        }
        for (int i = 0; i < need; i++)
            included[block_primes[i]] = 1;
    }

    for (int i = 0; i < num_primes; i++)
        if (included[i]) selected[n_sel++] = primes[i];

    free(included);
    return n_sel;
}

double compute_coverage(int *sel, int n_sel, int N_max) {
    int sz = 2*N_max + 2;
    char *covered = calloc(sz, 1);
    for (int i = 0; i < n_sel; i++)
        for (int j = i; j < n_sel; j++) {
            int s = sel[i] + sel[j];
            if (s < sz && s >= 4) covered[s] = 1;
        }
    int total = 0, hit = 0;
    for (int n = 4; n <= 2*N_max; n += 2) { total++; if (covered[n]) hit++; }
    free(covered);
    return (double)hit / total;
}

int main() {
    int N = 200000;
    sieve(N);
    int *selected = malloc(num_primes * sizeof(int));
    int trials = 3;

    printf("# Interval-Density Goldbach Coverage\n");
    printf("# N=%d, π(N)=%d\n\n", N, num_primes);
    printf("# For A ⊆ P with density ≥ δ in every interval [x, x+H]:\n");
    printf("# What fraction of evens ≤ 2N is in A+A?\n\n");

    double deltas[] = {0.05, 0.10, 0.15, 0.20, 0.30, 0.50, 0};
    int Hs[] = {100, 500, 1000, 5000, 10000, 50000, 0};

    printf("          ");
    for (int hi = 0; Hs[hi]; hi++) printf("| H=%-6d", Hs[hi]);
    printf("|\n");
    printf("  δ       ");
    for (int hi = 0; Hs[hi]; hi++) printf("+--------");
    printf("+\n");

    for (int di = 0; deltas[di] > 0; di++) {
        double delta = deltas[di];
        printf("  %.2f    ", delta);

        for (int hi = 0; Hs[hi]; hi++) {
            int H = Hs[hi];
            double avg_cov = 0;
            int avg_sz = 0;
            for (int t = 0; t < trials; t++) {
                int n_sel = construct_interval_subset(delta, H, N, selected);
                avg_cov += compute_coverage(selected, n_sel, N);
                avg_sz += n_sel;
            }
            avg_cov /= trials;
            avg_sz /= trials;
            printf("| %5.1f%% ", avg_cov * 100);
        }
        printf("|\n");
    }

    /* Detailed analysis at the transition */
    printf("\n## Phase Transition Detail (H=1000)\n");
    printf("  %6s | %8s | %10s | %s\n", "δ", "|A|/π(N)", "coverage", "");

    for (double d = 0.05; d <= 0.51; d += 0.025) {
        double avg_cov = 0;
        int avg_sz = 0;
        for (int t = 0; t < trials; t++) {
            int n_sel = construct_interval_subset(d, 1000, N, selected);
            avg_cov += compute_coverage(selected, n_sel, N);
            avg_sz += n_sel;
        }
        avg_cov /= trials;
        avg_sz /= trials;
        printf("  %6.3f | %6.1f%% | %9.4f%% | %s\n",
               d, 100.0*avg_sz/num_primes, avg_cov*100,
               avg_cov > 0.99 ? "≈ FULL ✓" :
               avg_cov > 0.95 ? "NEAR" :
               avg_cov > 0.90 ? "HIGH" : "");
    }

    /* Compare: what δ gives 99% coverage for different H? */
    printf("\n## Critical δ for 99%% coverage at each H:\n");
    for (int hi = 0; Hs[hi]; hi++) {
        int H = Hs[hi];
        for (double d = 0.05; d <= 0.51; d += 0.01) {
            double avg_cov = 0;
            for (int t = 0; t < trials; t++) {
                int n_sel = construct_interval_subset(d, H, N, selected);
                avg_cov += compute_coverage(selected, n_sel, N);
            }
            avg_cov /= trials;
            if (avg_cov >= 0.99) {
                printf("  H=%6d: δ_crit ≈ %.2f (coverage=%.2f%%)\n",
                       H, d, avg_cov*100);
                break;
            }
        }
    }

    free(selected);
    return 0;
}
