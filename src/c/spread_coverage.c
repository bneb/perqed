/*
 * spread_coverage.c — Map the (δ, Q) → coverage phase transition.
 *
 * For each (δ, Q):
 *   Construct A ⊆ Primes such that A has relative density ≥ δ
 *   in every reduced residue class mod q, for all q ≤ Q.
 *   Then compute |A+A ∩ 2ℕ| / |2ℕ ∩ [4, 2N]|.
 *
 * This directly tests what density threshold is needed in the
 * 2024 "Density versions of binary Goldbach" framework.
 *
 * BUILD: cc -O3 -o spread_coverage spread_coverage.c -lm
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

int gcd(int a, int b) { while (b) { int t=b; b=a%b; a=t; } return a; }

/* Construct subset with density ≥ δ in every reduced residue class mod q, q ≤ Q.
 * Strategy: include each prime p independently with probability chosen to ensure
 * the density in each class exceeds δ.
 * For deterministic construction: include the first ceil(δ·count) primes in each class. */
int construct_spread_subset(double delta, int Q, int *selected) {
    /* For each (q, a) with gcd(a,q)=1 and q ≤ Q:
     * count primes ≡ a mod q, include the first ⌈δ·count⌉ of them.
     * Mark all included primes. */
    char *included = calloc(num_primes, 1);

    for (int q = 1; q <= Q; q++) {
        for (int a = 1; a < q; a++) {
            if (gcd(a, q) != 1) continue;

            /* Count primes ≡ a mod q */
            int count = 0;
            for (int i = 0; i < num_primes; i++)
                if (primes[i] % q == a) count++;

            /* Include the first ⌈δ·count⌉ and the last ⌈δ·count⌉
             * (to ensure spread across the range) */
            int need = (int)ceil(delta * count);
            if (need > count) need = count;

            /* Include first 'need' primes in this class */
            int included_count = 0;
            for (int i = 0; i < num_primes && included_count < need; i++) {
                if (primes[i] % q == a) {
                    included[i] = 1;
                    included_count++;
                }
            }
            /* Also include last 'need' to ensure coverage at top of range */
            included_count = 0;
            for (int i = num_primes - 1; i >= 0 && included_count < need; i--) {
                if (primes[i] % q == a) {
                    included[i] = 1;
                    included_count++;
                }
            }
        }
    }

    int n_sel = 0;
    for (int i = 0; i < num_primes; i++)
        if (included[i]) selected[n_sel++] = primes[i];

    free(included);
    return n_sel;
}

double compute_coverage(int *selected, int n_sel, int N_max) {
    int sz = 2 * N_max + 2;
    char *covered = calloc(sz, 1);
    for (int i = 0; i < n_sel; i++)
        for (int j = i; j < n_sel; j++) {
            int s = selected[i] + selected[j];
            if (s < sz && s >= 4) covered[s] = 1;
        }
    int total = 0, hit = 0;
    for (int n = 4; n <= 2*N_max; n += 2) { total++; if (covered[n]) hit++; }
    free(covered);
    return (double)hit / total;
}

/* Verify the density constraint is actually met */
void verify_density(int *selected, int n_sel, double delta, int Q) {
    printf("    Density verification (q ≤ %d):\n", Q);
    int worst_q = 0, worst_a = 0;
    double worst_ratio = 1.0;

    for (int q = 2; q <= Q; q++) {
        for (int a = 1; a < q; a++) {
            if (gcd(a, q) != 1) continue;
            int total_in_class = 0, selected_in_class = 0;
            for (int i = 0; i < num_primes; i++)
                if (primes[i] % q == a) total_in_class++;
            for (int i = 0; i < n_sel; i++)
                if (selected[i] % q == a) selected_in_class++;
            double ratio = (total_in_class > 0) ?
                (double)selected_in_class / total_in_class : 1.0;
            if (ratio < worst_ratio) {
                worst_ratio = ratio;
                worst_q = q;
                worst_a = a;
            }
        }
    }
    printf("      Worst class: %d mod %d, density = %.4f (target ≥ %.4f) %s\n",
           worst_a, worst_q, worst_ratio, delta,
           worst_ratio >= delta - 0.01 ? "✓" : "✗");
}

int main(int argc, char **argv) {
    int N = 200000;
    if (argc > 1) N = atoi(argv[1]);
    if (N > MAX_N - 1) N = MAX_N - 1;

    sieve(N);
    int *selected = malloc(num_primes * sizeof(int));

    printf("# Spread Coverage Phase Transition\n");
    printf("# N=%d, π(N)=%d\n\n", N, num_primes);

    printf("# (δ, Q) → |A+A coverage| where A has density ≥ δ in every\n");
    printf("# reduced residue class mod q for q ≤ Q.\n\n");

    double deltas[] = {0.05, 0.10, 0.15, 0.20, 0.30, 0.40, 0.50, 0};
    int Qs[] = {2, 3, 6, 10, 30, 0};

    printf("          |");
    for (int qi = 0; Qs[qi]; qi++) printf("  Q=%-4d |", Qs[qi]);
    printf("    |A|/π(N)\n");
    printf("  δ       |");
    for (int qi = 0; Qs[qi]; qi++) printf("---------+");
    printf("-----------\n");

    for (int di = 0; deltas[di] > 0; di++) {
        double delta = deltas[di];
        printf("  %.2f    |", delta);

        for (int qi = 0; Qs[qi]; qi++) {
            int Q = Qs[qi];
            int n_sel = construct_spread_subset(delta, Q, selected);
            double cov = compute_coverage(selected, n_sel, N);
            printf(" %6.2f%% |", cov * 100);
        }

        /* Also show subset size for Q=30 */
        int n_sel = construct_spread_subset(delta, 30, selected);
        printf("  %d/%d (%.0f%%)", n_sel, num_primes,
               100.0*n_sel/num_primes);
        printf("\n");
    }

    /* Detailed analysis for the most interesting cases */
    printf("\n## Detailed Analysis\n");
    double interesting[][2] = {{0.10, 6}, {0.15, 6}, {0.10, 30}, {0.20, 30}, {0}};
    for (int i = 0; interesting[i][0] > 0; i++) {
        double delta = interesting[i][0];
        int Q = (int)interesting[i][1];
        printf("\n  δ=%.2f, Q=%d:\n", delta, Q);
        int n_sel = construct_spread_subset(delta, Q, selected);
        printf("    Subset size: %d (%d%% of primes)\n",
               n_sel, (int)(100.0*n_sel/num_primes));
        double cov = compute_coverage(selected, n_sel, N);
        printf("    Coverage: %.4f%%\n", cov * 100);
        verify_density(selected, n_sel, delta, Q);
    }

    free(selected);
    return 0;
}
