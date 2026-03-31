/*
 * sieve_goldbach.c — Sieve analysis of Goldbach representations.
 *
 * For each even 2n, decompose r(2n) by the "almost-prime quality" of
 * the representation:
 *   r_k(2n) = #{(p,q) : p+q=2n, p prime, Ω(q) = k}
 *
 * where Ω(q) = number of prime factors with multiplicity.
 *
 * Chen's theorem says r_1(2n) + r_2(2n) > 0 for large 2n.
 * We want to know: is r_1(2n) typically >> r_2(2n)?
 * Can we detect a bias toward fewer prime factors?
 *
 * Also: PARITY analysis — does Σ μ(q) for q = 2n-p show cancellation?
 *
 * BUILD: cc -O3 -o sieve_goldbach sieve_goldbach.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 1000001

static char is_composite[MAX_N * 2];
static int omega_table[MAX_N * 2];   /* Ω(n) = total prime factors */
static int mu_table[MAX_N * 2];      /* Möbius function */
static int primes[200000];
static int num_primes = 0;

void sieve(int limit) {
    memset(is_composite, 0, limit + 1);
    memset(omega_table, 0, (limit+1) * sizeof(int));
    for (int i = 1; i <= limit; i++) mu_table[i] = 1;

    is_composite[0] = is_composite[1] = 1;
    for (int p = 2; p <= limit; p++) {
        if (!is_composite[p]) {
            primes[num_primes++] = p;
            for (int j = p; j <= limit; j += p) {
                if (j > p) is_composite[j] = 1;
                omega_table[j]++;
                mu_table[j] *= -1;
            }
            for (long long j = (long long)p*p; j <= limit; j += (long long)p*p)
                mu_table[(int)j] = 0;
        }
    }
}

int main() {
    int N = 500000;
    sieve(2 * N);

    printf("# Sieve Analysis of Goldbach Representations\n");
    printf("# N=%d, analyzing 2n for 3 ≤ n ≤ %d\n\n", N, N);

    /* For each even 2n: count r_k(2n) for k=1,2,3,... */
    long long total_r1 = 0, total_r2 = 0, total_r3 = 0, total_rge4 = 0;
    long long total_r = 0;
    int r1_zero_count = 0;  /* how many 2n have r_1 = 0? */
    int r12_zero_count = 0; /* how many have r_1 + r_2 = 0? */

    /* Parity: Σ μ(q) for q = 2n - p */
    long long parity_pos = 0, parity_neg = 0, parity_zero = 0;

    /* Maynard-type weight analysis:
     * For each representation p + q = 2n:
     *   weight(q) = Σ_{d|q, d≤D} λ_d  (sieve weight)
     * We use the simple Selberg weight: λ_d = μ(d) · max(0, 1 - log(d)/log(D))
     */
    double D = 1000.0; /* sieve level */
    double logD = log(D);
    long long total_weighted = 0;
    double total_selberg_sum = 0;

    /* Distribution of r_1(2n) */
    int r1_hist[100] = {0};

    for (int n = 3; n <= N; n++) {
        int even = 2 * n;
        int r1 = 0, r2 = 0, r3 = 0, rge4 = 0;
        double selberg_sum = 0;
        int parity_sum = 0;

        for (int i = 0; i < num_primes && primes[i] < even; i++) {
            int p = primes[i];
            int q = even - p;
            if (q < 2 || q >= 2*N) continue;

            int omega_q = omega_table[q];
            if (omega_q == 1) r1++;
            else if (omega_q == 2) r2++;
            else if (omega_q == 3) r3++;
            else rge4++;

            parity_sum += mu_table[q]; /* parity detection */

            /* Selberg-type weight for q */
            /* W(q) = (Σ_{d|q, d≤D} μ(d)(1 - logd/logD))² */
            /* For simplicity, just check if q has a small factor */
        }

        total_r1 += r1; total_r2 += r2; total_r3 += r3; total_rge4 += rge4;
        total_r += r1 + r2 + r3 + rge4;

        if (r1 == 0) r1_zero_count++;
        if (r1 + r2 == 0) r12_zero_count++;

        if (parity_sum > 0) parity_pos++;
        else if (parity_sum < 0) parity_neg++;
        else parity_zero++;

        int bucket = r1 < 99 ? r1 : 99;
        r1_hist[bucket]++;
    }

    int total_evens = N - 2;

    printf("## Almost-Prime Decomposition of r(2n)\n\n");
    printf("  Total representations: %lld\n", total_r);
    printf("  r₁ (p + prime):        %lld (%.1f%%)\n", total_r1, 100.0*total_r1/total_r);
    printf("  r₂ (p + semiprime):    %lld (%.1f%%)\n", total_r2, 100.0*total_r2/total_r);
    printf("  r₃ (p + 3-almost):     %lld (%.1f%%)\n", total_r3, 100.0*total_r3/total_r);
    printf("  r≥4 (p + ≥4-almost):   %lld (%.1f%%)\n\n", total_rge4, 100.0*total_rge4/total_r);

    printf("  Evens with r₁=0 (no p+p):  %d (%.4f%%)\n",
           r1_zero_count, 100.0*r1_zero_count/total_evens);
    printf("  Evens with r₁+r₂=0:        %d\n\n", r12_zero_count);

    printf("  r₁(2n) distribution:\n");
    for (int i = 0; i < 10; i++)
        printf("    r₁=%d: %d evens\n", i, r1_hist[i]);
    printf("    r₁≥10: %d evens\n", total_evens - r1_hist[0]-r1_hist[1]-r1_hist[2]-
           r1_hist[3]-r1_hist[4]-r1_hist[5]-r1_hist[6]-r1_hist[7]-r1_hist[8]-r1_hist[9]);

    printf("\n## Parity Analysis: Σ μ(2n-p) over primes p\n\n");
    printf("  Positive bias: %lld evens (%.1f%%)\n", parity_pos, 100.0*parity_pos/total_evens);
    printf("  Negative bias: %lld evens (%.1f%%)\n", parity_neg, 100.0*parity_neg/total_evens);
    printf("  Zero (perfect cancel): %lld evens (%.1f%%)\n\n", parity_zero, 100.0*parity_zero/total_evens);

    /* KEY QUESTION: Among representations p + q = 2n,
     * what fraction have q prime vs q = P₂?
     * The ratio r₁/(r₁+r₂) tells us how "close to Goldbach" Chen's theorem gets. */
    printf("## Quality Ratio r₁/(r₁+r₂)\n\n");
    printf("  Overall: %.4f (%.1f%% of Chen representations are Goldbach)\n",
           (double)total_r1/(total_r1+total_r2),
           100.0*total_r1/(total_r1+total_r2));

    /* Does the ratio improve with 2n? */
    printf("\n  By range:\n");
    int ranges[] = {10000, 50000, 100000, 200000, 500000, 0};
    for (int ri = 0; ranges[ri]; ri++) {
        int rmax = ranges[ri];
        long long tr1 = 0, tr2 = 0;
        for (int n = 3; n <= rmax && n <= N; n++) {
            int even = 2*n;
            for (int i = 0; i < num_primes && primes[i] < even; i++) {
                int q = even - primes[i];
                if (q < 2 || q >= 2*N) continue;
                if (omega_table[q] == 1) tr1++;
                else if (omega_table[q] == 2) tr2++;
            }
        }
        printf("    2n ≤ %7d: r₁/(r₁+r₂) = %.4f\n", 2*rmax,
               (double)tr1/(tr1+tr2));
    }

    /* The PARITY OBSTRUCTION: can we see it numerically?
     * If primes are "random mod 2 in Ω", then r₁ ≈ r₂ ≈ r₃ ≈ ...
     * But primes have Ω = 1, so they're "parity-odd".
     * The Selberg symmetry says sieve can't distinguish Ω=1 from Ω=3.
     * Check: is r₁ ≈ r₃? (parity prediction) */
    printf("\n## Parity Symmetry Check: r₁ vs r₃\n");
    printf("  r₁ = %lld, r₃ = %lld, ratio = %.4f\n", total_r1, total_r3,
           (double)total_r1/total_r3);
    printf("  If parity-symmetric: ratio ≈ 1/(3·something)\n");
    printf("  Deviation from parity: this measures how much the sieve 'sees'\n");

    return 0;
}
