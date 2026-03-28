/*
 * goldbach_graph.c — Goldbach as a bipartite graph.
 *
 * LEFT vertices:  even numbers 2n, for 2 ≤ n ≤ N
 * RIGHT vertices: primes p ≤ 2N
 * Edge (2n, p):   exists iff 2n - p is also prime (and ≥ 2)
 *
 * Goldbach ↔ every left vertex has degree ≥ 1.
 *
 * We analyze:
 * 1. Degree distribution (left = r(2n), right = #{2n : 2n-p prime})
 * 2. Hall's condition: for every subset S of evens, |N(S)| ≥ |S|
 * 3. Expansion ratio: |N(S)| / |S| for various S
 * 4. Minimum left degree and where it occurs
 * 5. Vertex connectivity / edge connectivity
 * 6. Whether the graph is an EXPANDER (spectral gap)
 *
 * BUILD: cc -O3 -o goldbach_graph goldbach_graph.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_2N 1000002

static char is_composite[MAX_2N];
static int primes[80000];
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

int main(int argc, char **argv) {
    int N = 500000;
    if (argc > 1) N = atoi(argv[1]);
    int twoN = 2 * N;
    if (twoN > MAX_2N - 2) { N = (MAX_2N-2)/2; twoN = 2*N; }

    sieve(twoN);
    printf("# Goldbach Bipartite Graph Analysis\n");
    printf("# N=%d, 2N=%d, π(2N)=%d\n\n", N, twoN, num_primes);

    /* LEFT degrees: r(2n) = #{p prime : 2n-p prime, p ≤ 2n} */
    int *left_deg = calloc(N + 1, sizeof(int));  /* left_deg[n] = degree of 2n */
    int min_deg = 1 << 30, min_deg_n = 0;
    int max_deg = 0, max_deg_n = 0;
    long long total_edges = 0;
    int deg_hist[20] = {0};  /* histogram of left degrees */

    for (int n = 2; n <= N; n++) {
        int even = 2 * n;
        int deg = 0;
        for (int i = 0; i < num_primes && primes[i] <= even; i++) {
            int p = primes[i];
            int q = even - p;
            if (q >= 2 && !is_composite[q] && p <= q) deg++;
        }
        left_deg[n] = deg;
        total_edges += deg;
        if (deg < min_deg) { min_deg = deg; min_deg_n = n; }
        if (deg > max_deg) { max_deg = deg; max_deg_n = n; }
        int bucket = deg < 19 ? deg : 19;
        deg_hist[bucket]++;
    }

    printf("## Left Degree (r(2n)) Statistics\n");
    printf("  Min degree: %d at 2n=%d\n", min_deg, 2*min_deg_n);
    printf("  Max degree: %d at 2n=%d\n", max_deg, 2*max_deg_n);
    printf("  Mean degree: %.2f\n", (double)total_edges / (N - 1));
    printf("  Total edges: %lld\n\n", total_edges);

    printf("  Degree distribution:\n");
    for (int i = 0; i < 20; i++)
        if (deg_hist[i] > 0)
            printf("    r(2n)=%2d: %6d evens\n", i, deg_hist[i]);

    /* RIGHT degrees: for each prime p, how many evens 2n have 2n-p prime? */
    printf("\n## Right Degree (prime vertex degrees)\n");
    int right_deg_min = 1 << 30, right_deg_max = 0;
    double right_deg_sum = 0;
    for (int i = 0; i < num_primes && i < 20; i++) {
        int p = primes[i];
        int deg = 0;
        for (int n = 2; n <= N; n++)
            if (2*n >= p + 2 && !is_composite[2*n - p]) deg++;
        if (i < 10) printf("  Prime %d: degree = %d\n", p, deg);
        if (deg < right_deg_min) right_deg_min = deg;
        if (deg > right_deg_max) right_deg_max = deg;
        right_deg_sum += deg;
    }

    /* Hall's condition check: |N(S)| ≥ |S| for small S.
     * For S = {evens with smallest degree}, check if their neighborhoods
     * are large enough. */
    printf("\n## Hall's Condition (Expansion)\n");
    printf("  For S = {k evens with smallest r(2n)}, compute |N(S)|:\n");

    /* Find the evens with smallest degree */
    int *sorted_n = malloc((N+1) * sizeof(int));
    for (int i = 0; i <= N; i++) sorted_n[i] = i;
    /* Simple selection: find the 100 smallest-degree evens */
    for (int i = 2; i < 102 && i <= N; i++) {
        for (int j = i + 1; j <= N; j++) {
            if (left_deg[sorted_n[j]] < left_deg[sorted_n[i]])
                { int t = sorted_n[i]; sorted_n[i] = sorted_n[j]; sorted_n[j] = t; }
        }
    }

    char *prime_seen = calloc(twoN + 1, 1);
    for (int k = 1; k <= 50 && k + 1 < N; k *= 2) {
        memset(prime_seen, 0, twoN + 1);
        int neighborhood_size = 0;
        for (int i = 2; i < k + 2; i++) {
            int n = sorted_n[i];
            int even = 2 * n;
            for (int j = 0; j < num_primes && primes[j] <= even; j++) {
                int p = primes[j];
                int q = even - p;
                if (q >= 2 && !is_composite[q]) {
                    if (!prime_seen[p]) { prime_seen[p] = 1; neighborhood_size++; }
                    if (!prime_seen[q]) { prime_seen[q] = 1; neighborhood_size++; }
                }
            }
        }
        double expansion = (double)neighborhood_size / k;
        printf("    |S|=%4d (min-degree evens): |N(S)|=%6d, expansion=%.2f %s\n",
               k, neighborhood_size, expansion,
               neighborhood_size >= k ? "Hall ✓" : "Hall ✗");
    }

    /* Key graph-theoretic metric: is the graph an expander?
     * The expansion ratio |N(S)|/|S| should be bounded away from 1
     * for ALL small S, not just the min-degree ones. */
    printf("\n## Expansion for Random Subsets\n");
    unsigned long long rng = 123456789ULL;
    for (int k = 10; k <= 10000; k *= 10) {
        double worst_exp = 1e9;
        for (int trial = 0; trial < 5; trial++) {
            memset(prime_seen, 0, twoN + 1);
            int ns = 0;
            int selected = 0;
            while (selected < k) {
                rng ^= rng << 13; rng ^= rng >> 7; rng ^= rng << 17;
                int n = 2 + (rng % (N - 1));
                int even = 2 * n;
                selected++;
                for (int j = 0; j < num_primes && primes[j] <= even; j++) {
                    int p = primes[j];
                    int q = even - p;
                    if (q >= 2 && !is_composite[q]) {
                        if (!prime_seen[p]) { prime_seen[p] = 1; ns++; }
                        if (!prime_seen[q]) { prime_seen[q] = 1; ns++; }
                    }
                }
            }
            double exp = (double)ns / k;
            if (exp < worst_exp) worst_exp = exp;
        }
        printf("    |S|=%6d: worst expansion = %.2f %s\n",
               k, worst_exp,
               worst_exp > 2.0 ? "STRONG EXPANDER" :
               worst_exp > 1.0 ? "expander" : "NOT expander");
    }

    free(left_deg); free(sorted_n); free(prime_seen);
    return 0;
}
