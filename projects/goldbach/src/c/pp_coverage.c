/*
 * pp_coverage.c — Study the sumset P+P = {p+q : p,q prime ≤ N}
 *
 * Computes:
 * 1. Coverage: what fraction of even numbers ≤ 2N are in P+P?
 * 2. Representation count: r(2n) = #{(p,q) : p+q=2n}
 * 3. Gaps: even numbers NOT in P+P (Goldbach failures for primes ≤ N)
 * 4. Residue class coverage: P+P ∩ {2n : 2n ≡ a mod q} for small q
 * 5. Minimum representation: min_{2n ≤ 2N} r(2n)
 * 6. Density of thin primes subsets: for P_δ = {p prime : random or structured
 *    subset with density δ}, does P_δ + P_δ still cover almost all evens?
 *
 * BUILD: cc -O3 -o pp_coverage pp_coverage.c -lm
 * USAGE: ./pp_coverage [N]
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 2000001

static char is_composite[MAX_N];
static int primes[200000];
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
    int N = 1000000;
    if (argc > 1) N = atoi(argv[1]);
    if (N > MAX_N - 1) N = MAX_N - 1;

    sieve(N);
    printf("# P+P Coverage Analysis, N=%d, π(N)=%d\n\n", N, num_primes);

    /* Compute r(2n) = #{(p,q): p+q=2n, p≤q, p,q ≤ N} for 2n ≤ 2N */
    int sz = 2*N + 2;
    int *repr = calloc(sz, sizeof(int));  /* representation count */

    /* For each pair (p, q) with p ≤ q ≤ N, mark p+q */
    for (int i = 0; i < num_primes; i++) {
        for (int j = i; j < num_primes; j++) {
            int s = primes[i] + primes[j];
            if (s < sz) repr[s]++;
        }
    }

    /* Coverage statistics */
    int total_even = 0, covered = 0, uncovered = 0;
    int min_repr = 1 << 30, min_repr_n = 0;
    int max_gap = 0;
    int last_covered = 4;

    /* Distribution of r(2n) */
    int repr_hist[1000];
    memset(repr_hist, 0, sizeof(repr_hist));

    for (int n = 2; n <= N; n++) {
        int even = 2*n;
        total_even++;
        if (repr[even] > 0) {
            covered++;
            if (repr[even] < min_repr && even >= 10) {
                min_repr = repr[even];
                min_repr_n = even;
            }
            int gap = even - last_covered;
            if (gap > max_gap) max_gap = gap;
            last_covered = even;

            int bucket = repr[even];
            if (bucket >= 1000) bucket = 999;
            repr_hist[bucket]++;
        } else {
            uncovered++;
        }
    }

    printf("## Basic Coverage\n");
    printf("  Even numbers 4..%d: %d\n", 2*N, total_even);
    printf("  Covered by P+P:     %d (%.6f%%)\n", covered, 100.0*covered/total_even);
    printf("  Uncovered:          %d\n", uncovered);
    printf("  Min repr r(2n):     %d at 2n=%d\n", min_repr, min_repr_n);
    printf("  Max gap in P+P:     %d\n", max_gap);

    /* List uncovered even numbers (if any) */
    if (uncovered > 0 && uncovered <= 20) {
        printf("\n  Uncovered evens: ");
        for (int n = 2; n <= N; n++)
            if (repr[2*n] == 0) printf("%d ", 2*n);
        printf("\n");
    }

    /* Representation distribution */
    printf("\n## Representation Distribution r(2n)\n");
    printf("  r(2n)=1: %d evens\n", repr_hist[1]);
    printf("  r(2n)=2: %d evens\n", repr_hist[2]);
    printf("  r(2n)=3: %d evens\n", repr_hist[3]);
    printf("  r(2n) ≤ 5: %d evens\n", repr_hist[1]+repr_hist[2]+repr_hist[3]+repr_hist[4]+repr_hist[5]);

    /* Hardy-Littlewood prediction: r(2n) ~ C₂ · 2n/log²(2n) · ∏_{p|n,p≥3} (p-1)/(p-2) */
    /* C₂ = 2 · ∏_{p≥3} (1 - 1/(p-1)²) ≈ 1.3203 (twin prime constant) */
    double C2 = 1.3203236316;
    printf("\n## Hardy-Littlewood Comparison\n");
    printf("  %8s | %8s | %10s | %8s\n", "2n", "r(2n)", "HL predict", "ratio");
    int test_ns[] = {100, 1000, 10000, 100000, 500000, 1000000, 0};
    for (int i = 0; test_ns[i] && test_ns[i] <= 2*N; i++) {
        int even = test_ns[i];
        if (even % 2 != 0) continue;
        double hl = C2 * even / (log((double)even) * log((double)even));
        /* Multiply by ∏_{p|n, p≥3} (p-1)/(p-2) */
        int n = even / 2;
        double prod = 1.0;
        for (int p = 3; p*p <= n; p += 2)
            if (n % p == 0) { prod *= (double)(p-1)/(p-2); while (n%p==0) n/=p; }
        if (n > 2) prod *= (double)(n-1)/(n-2);
        hl *= prod;
        printf("  %8d | %8d | %10.1f | %8.4f\n",
               even, repr[even], hl, repr[even] / hl);
    }

    /* Residue class coverage: P+P mod q */
    printf("\n## P+P Residue Class Coverage\n");
    int mods[] = {3, 4, 5, 6, 7, 8, 10, 12, 24, 30, 0};
    for (int mi = 0; mods[mi]; mi++) {
        int q = mods[mi];
        int classes_hit[100] = {0};
        int total_classes = 0;
        for (int a = 0; a < q; a++) {
            if (a % 2 != 0) continue; /* only even residues */
            total_classes++;
            int hits = 0;
            for (int n = 2; n <= N && hits == 0; n++)
                if (2*n % q == a && repr[2*n] > 0) hits = 1;
            classes_hit[a] = hits;
        }
        int covered_classes = 0;
        for (int a = 0; a < q; a++) covered_classes += classes_hit[a];
        printf("  mod %2d: %d/%d even residue classes covered\n",
               q, covered_classes, total_classes);
    }

    /* THIN SUBSET TEST: take only primes p ≡ 1 mod 4 vs p ≡ 3 mod 4 */
    printf("\n## Thin Subset Test: P_a + P_a for primes ≡ a (mod 4)\n");
    for (int a = 1; a <= 3; a += 2) {
        int *repr_thin = calloc(sz, sizeof(int));
        for (int i = 0; i < num_primes; i++) {
            if (primes[i] == 2) continue;
            if (primes[i] % 4 != a) continue;
            for (int j = i; j < num_primes; j++) {
                if (primes[j] == 2) continue;
                if (primes[j] % 4 != a) continue;
                int s = primes[i] + primes[j];
                if (s < sz) repr_thin[s]++;
            }
        }
        int thin_covered = 0, thin_total = 0;
        for (int n = 2; n <= N; n++) {
            thin_total++;
            if (repr_thin[2*n] > 0) thin_covered++;
        }
        printf("  P_{≡%d mod 4} + P_{≡%d mod 4}: %d/%d = %.2f%% of evens covered\n",
               a, a, thin_covered, thin_total, 100.0*thin_covered/thin_total);
        free(repr_thin);
    }

    /* MIXED: P_1 + P_3 (primes 1 mod 4 + primes 3 mod 4) */
    {
        int *repr_mix = calloc(sz, sizeof(int));
        for (int i = 0; i < num_primes; i++) {
            if (primes[i] == 2 || primes[i] % 4 != 1) continue;
            for (int j = 0; j < num_primes; j++) {
                if (primes[j] == 2 || primes[j] % 4 != 3) continue;
                int s = primes[i] + primes[j];
                if (s < sz) repr_mix[s]++;
            }
        }
        int mix_covered = 0, mix_total = 0;
        for (int n = 2; n <= N; n++) {
            mix_total++;
            if (repr_mix[2*n] > 0) mix_covered++;
        }
        printf("  P_{≡1} + P_{≡3 mod 4}: %d/%d = %.2f%% of evens covered\n",
               mix_covered, mix_total, 100.0*mix_covered/mix_total);
        free(repr_mix);
    }

    free(repr);
    return 0;
}
