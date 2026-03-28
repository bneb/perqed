/*
 * density_threshold.c — Find the critical density δ for P_δ + P_δ coverage.
 *
 * For each density δ in (0, 1):
 *   - Sample a random subset P_δ of primes ≤ N with density δ
 *   - Compute what fraction of even numbers ≤ 2N is in P_δ + P_δ
 *   - Average over multiple trials
 *
 * Also test STRUCTURED subsets:
 *   - P_δ = primes in selected residue classes
 *   - P_δ = smallest δ·π(N) primes
 *   - P_δ = largest δ·π(N) primes
 *
 * BUILD: cc -O3 -o density_threshold density_threshold.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <time.h>

#define MAX_N 500001

static char is_composite[MAX_N];
static int primes[50000];
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

/* Simple xorshift RNG */
static unsigned long long rng_state = 12345678901234567ULL;
double rand_double() {
    rng_state ^= rng_state << 13;
    rng_state ^= rng_state >> 7;
    rng_state ^= rng_state << 17;
    return (rng_state & 0xFFFFFFF) / (double)0x10000000;
}

/* Compute coverage: fraction of even 4..2*N_max in subset+subset */
double compute_coverage(int *selected, int n_selected, int N_max) {
    int sz = 2*N_max + 2;
    char *covered = calloc(sz, 1);

    /* For speed: only mark sums, don't count */
    for (int i = 0; i < n_selected; i++) {
        for (int j = i; j < n_selected; j++) {
            int s = selected[i] + selected[j];
            if (s < sz && s >= 4) covered[s] = 1;
        }
    }

    int total = 0, hit = 0;
    for (int n = 4; n <= 2*N_max; n += 2) {
        total++;
        if (covered[n]) hit++;
    }
    free(covered);
    return (double)hit / total;
}

int main(int argc, char **argv) {
    int N = 200000;
    if (argc > 1) N = atoi(argv[1]);
    if (N > MAX_N - 1) N = MAX_N - 1;

    sieve(N);
    rng_state = (unsigned long long)time(NULL);

    printf("# Density Threshold for P+P Coverage\n");
    printf("# N=%d, π(N)=%d\n\n", N, num_primes);

    int *selected = malloc(num_primes * sizeof(int));
    int trials = 5;

    /* RANDOM SUBSETS */
    printf("## Random Subsets of Primes (averaged over %d trials)\n", trials);
    printf("  %6s | %10s | %10s | %10s\n", "δ", "coverage", "subset_sz", "evens_hit%");
    printf("  -------+------------+------------+--------\n");

    double deltas[] = {0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40,
                       0.45, 0.50, 0.55, 0.60, 0.70, 0.80, 0.90, 1.00, 0};

    for (int di = 0; deltas[di] > 0; di++) {
        double delta = deltas[di];
        double avg_cov = 0;
        int avg_sz = 0;

        for (int trial = 0; trial < trials; trial++) {
            int n_sel = 0;
            for (int i = 0; i < num_primes; i++) {
                if (rand_double() < delta)
                    selected[n_sel++] = primes[i];
            }
            avg_sz += n_sel;
            avg_cov += compute_coverage(selected, n_sel, N);
        }
        avg_cov /= trials;
        avg_sz /= trials;

        printf("  %6.2f | %10.6f | %10d | %9.4f%%\n",
               delta, avg_cov, avg_sz, avg_cov * 100);
    }

    /* STRUCTURED SUBSETS */
    printf("\n## Structured Subsets\n");

    /* Smallest primes */
    printf("\n  ### Smallest δ·π(N) primes:\n");
    for (int di = 0; deltas[di] > 0; di++) {
        double delta = deltas[di];
        int n_sel = (int)(delta * num_primes);
        if (n_sel > num_primes) n_sel = num_primes;
        for (int i = 0; i < n_sel; i++) selected[i] = primes[i];
        double cov = compute_coverage(selected, n_sel, N);
        printf("    δ=%.2f: %d primes ≤ %d, coverage=%.4f%%\n",
               delta, n_sel, (n_sel > 0 ? selected[n_sel-1] : 0), cov*100);
    }

    /* Largest primes */
    printf("\n  ### Largest δ·π(N) primes:\n");
    for (int di = 0; deltas[di] > 0; di++) {
        double delta = deltas[di];
        int n_sel = (int)(delta * num_primes);
        if (n_sel > num_primes) n_sel = num_primes;
        int start = num_primes - n_sel;
        for (int i = 0; i < n_sel; i++) selected[i] = primes[start + i];
        double cov = compute_coverage(selected, n_sel, N);
        printf("    δ=%.2f: %d primes ≥ %d, coverage=%.4f%%\n",
               delta, n_sel, (n_sel > 0 ? selected[0] : 0), cov*100);
    }

    /* Primes in specific residue classes mod 6 (2,3 are special) */
    printf("\n  ### Primes ≡ 1 mod 6 only (density ~1/2):\n");
    {
        int n_sel = 0;
        for (int i = 0; i < num_primes; i++)
            if (primes[i] > 3 && primes[i] % 6 == 1)
                selected[n_sel++] = primes[i];
        double cov = compute_coverage(selected, n_sel, N);
        printf("    %d primes, coverage=%.4f%%\n", n_sel, cov*100);
    }

    printf("\n  ### Primes ≡ 5 mod 6 only (density ~1/2):\n");
    {
        int n_sel = 0;
        for (int i = 0; i < num_primes; i++)
            if (primes[i] > 3 && primes[i] % 6 == 5)
                selected[n_sel++] = primes[i];
        double cov = compute_coverage(selected, n_sel, N);
        printf("    %d primes, coverage=%.4f%%\n", n_sel, cov*100);
    }

    printf("\n  ### Both classes mod 6 (all p > 3):\n");
    {
        int n_sel = 0;
        for (int i = 0; i < num_primes; i++)
            if (primes[i] > 3)
                selected[n_sel++] = primes[i];
        double cov = compute_coverage(selected, n_sel, N);
        printf("    %d primes, coverage=%.4f%%\n", n_sel, cov*100);
    }

    free(selected);
    return 0;
}
