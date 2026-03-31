/*
 * test_two_ninths.c — Test δ₀ = 2/9 as the critical density threshold.
 *
 * Focused test: does δ = 2/9 achieve ≥ 99% coverage for various N and H?
 * Also tests above/below 2/9 to confirm it's the critical value.
 *
 * BUILD: cc -O3 -o test_two_ninths test_two_ninths.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

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

static unsigned long long rng = 314159265358979323ULL;
double randu() {
    rng ^= rng << 13; rng ^= rng >> 7; rng ^= rng << 17;
    return (rng & 0xFFFFFFF) / (double)0x10000000;
}

int construct_interval_subset(double delta, int H, int N, int *selected) {
    int n_sel = 0;
    char *included = calloc(num_primes, 1);
    for (int bs = 2; bs <= N; bs += H) {
        int be = bs + H - 1;
        if (be > N) be = N;
        int bp[5000]; int nb = 0;
        for (int i = 0; i < num_primes; i++)
            if (primes[i] >= bs && primes[i] <= be) bp[nb++] = i;
        int need = (int)ceil(delta * nb);
        if (need > nb) need = nb;
        for (int i = nb - 1; i > 0; i--) {
            int j = (int)(randu() * (i + 1)); if (j > i) j = i;
            int t = bp[i]; bp[i] = bp[j]; bp[j] = t;
        }
        for (int i = 0; i < need; i++) included[bp[i]] = 1;
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
    printf("# Testing δ₀ = 2/9 ≈ %.6f as Critical Density\n\n", 2.0/9.0);

    int Ns[] = {50000, 100000, 200000, 400000, 0};
    int Hs[] = {100, 500, 1000, 5000, 0};
    double two_ninths = 2.0 / 9.0;
    int trials = 5;
    int *selected = malloc(50000 * sizeof(int));

    /* Test 1: δ = 2/9 across N and H */
    printf("## Test 1: Coverage at δ = 2/9 across (N, H)\n\n");
    printf("  %8s", "N \\ H");
    for (int hi = 0; Hs[hi]; hi++) printf(" | H=%-5d", Hs[hi]);
    printf(" | |A|/π(N)\n");

    for (int ni = 0; Ns[ni]; ni++) {
        int N = Ns[ni];
        num_primes = 0;
        sieve(N);
        printf("  %8d", N);

        for (int hi = 0; Hs[hi]; hi++) {
            int H = Hs[hi];
            double avg = 0; int avg_sz = 0;
            for (int t = 0; t < trials; t++) {
                int ns = construct_interval_subset(two_ninths, H, N, selected);
                avg += compute_coverage(selected, ns, N);
                avg_sz += ns;
            }
            printf(" | %5.2f%%", avg / trials * 100);
        }
        int ns = construct_interval_subset(two_ninths, 1000, N, selected);
        printf(" |  %.0f%%\n", 100.0*ns/num_primes);
    }

    /* Test 2: Fine sweep around 2/9 for H=1000 */
    printf("\n## Test 2: Fine Sweep Around δ = 2/9 (H=1000)\n\n");
    printf("  %8s | %10s | %10s | %s\n", "δ", "δ vs 2/9", "coverage", "");

    num_primes = 0;
    sieve(200000);
    int N = 200000;

    double test_deltas[] = {
        1.0/9, 1.5/9, 1.8/9, 1.9/9, 2.0/9, 2.1/9, 2.2/9, 2.5/9, 3.0/9, 4.0/9, 0
    };

    for (int di = 0; test_deltas[di] > 0; di++) {
        double d = test_deltas[di];
        double avg = 0;
        for (int t = 0; t < trials; t++) {
            int ns = construct_interval_subset(d, 1000, N, selected);
            avg += compute_coverage(selected, ns, N);
        }
        avg /= trials;
        printf("  %8.5f | %9.4f  | %9.4f%% | %s  %s\n",
               d, d / two_ninths,
               avg * 100,
               avg >= 0.99 ? "✓" : "",
               fabs(d - two_ninths) < 0.001 ? "← 2/9" : "");
    }

    /* Test 3: Does it scale? Predict coverage from δ²·π(N)/log²N */
    printf("\n## Test 3: Scaling Across N at δ = 2/9, H=1000\n\n");
    printf("  %8s | %8s | %10s | %12s | %10s\n",
           "N", "π(N)", "coverage", "δ²·π(N)/5", "ratio");

    for (int ni = 0; Ns[ni]; ni++) {
        int N2 = Ns[ni];
        num_primes = 0; sieve(N2);
        double avg = 0;
        for (int t = 0; t < trials; t++) {
            int ns = construct_interval_subset(two_ninths, 1000, N2, selected);
            avg += compute_coverage(selected, ns, N2);
        }
        avg /= trials;
        double uncov = 1.0 - avg;
        double pred = 5.0 / (two_ninths * two_ninths * num_primes);
        printf("  %8d | %8d | %9.5f%% | %12.6f | %10.4f\n",
               N2, num_primes, avg*100, pred, uncov/pred);
    }

    free(selected);
    return 0;
}
