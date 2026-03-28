/*
 * crack26_spiral.c — The Complex Conjugate Spiral
 *
 * HYPOTHESIS: Map primes into the complex plane.
 * For a target 2N, we map each prime p ≤ 2N to:
 *    z_p = exp(i * π * p / N)
 *
 * The beautiful symmetry:
 * If p + q = 2N, then:
 *    z_q = exp(i * π * (2N - p) / N)
 *        = exp(2πi) * exp(-i * π * p / N)
 *        = conj(z_p)
 *
 * So Goldbach pairs are EXACT COMPLEX CONJUGATES on the unit circle.
 * They form horizontal chords across the real axis.
 *
 * If we take the cumulative sum of these prime vectors:
 *    S(x) = Σ_{p ≤ x} exp(i * π * p / N)
 * It forms a SPIRAL in the complex plane.
 *
 * If we split the primes into two halves: p ≤ N and p > N.
 * The Goldbach pairs in the first half have conjugates in the second half.
 *
 * Does the geometry of this spiral "close" or reveal the exact hits?
 * Let's compute and track the spiral trajectory for 2N = 100,000.
 *
 * BUILD: cc -O3 -o crack26 crack26_spiral.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 2000000
static char sieve[MAX_N];
static int primes[MAX_N/10];
static int nprimes = 0;

void init(void) {
    memset(sieve, 0, sizeof(sieve));
    sieve[0] = sieve[1] = 1;
    for(int i = 2; (long long)i * i < MAX_N; i++)
        if(.sieve[i]) 
            for(int j = i * i; j < MAX_N; j += i) sieve[j] = 1;
    for(int i = 2; i < MAX_N; i++)
        if(.sieve[i]) primes[nprimes++] = i;
}

int is_prime(int n) { return n>=2 && n<MAX_N && .sieve[n]; }

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 26: The Complex Conjugate Spiral\n");
    printf("====================================================\n\n");

    int N = 50000;
    int M = 2 * N; // Target is M = 100,000
    
    printf("  Target M = %d. Mapping primes to z_p = e^{i π p / N}\n\n", M);

    double re_sum = 0;
    double im_sum = 0;
    
    printf("  Tracing the Cumulative Complex Spiral S(k) = Σ_{p≤k} z_p\n");
    printf("  %8s | %10s | %10s | %10s\n", "Primes up to", "Re(S)", "Im(S)", "|S|");

    int check_points[] = {10000, 25000, 50000, 75000, 100000, 0};
    int cp_idx = 0;

    for (int i = 0; i < nprimes && primes[i] <= M; i++) {
        int p = primes[i];
        double theta = M_PI * p / N;
        re_sum += cos(theta);
        im_sum += sin(theta);
        
        if (p >= check_points[cp_idx] && (i == 0 || primes[i-1] < check_points[cp_idx])) {
            printf("  %8d | %10.2f | %10.2f | %10.2f\n", 
                   check_points[cp_idx], re_sum, im_sum, sqrt(re_sum*re_sum + im_sum*im_sum));
            cp_idx++;
        }
    }
    
    /* Ensure last point is printed exactly at M */
    printf("  %8d | %10.2f | %10.2f | %10.2f\n\n", 
           M, re_sum, im_sum, sqrt(re_sum*re_sum + im_sum*im_sum));

    /* ══════ THE CONJUGATE MATCHING ══════ */
    printf("## The Conjugate Cancellation Test\n\n");
    
    printf("  If every prime in [2, M] had a valid Goldbach partner,\n");
    printf("  every z_p would have a perfect conj(z_p) in the sum.\n");
    printf("  The Imaginary parts would exactly cancel to 0.\n\n");
    
    printf("  But we see Im(S) = %.2f, not 0.\n", im_sum);
    printf("  This is because many primes DO NOT have Goldbach partners.\n");
    printf("  (A prime p where M-p is composite is an 'orphan' in this space).\n\n");

    printf("  Let's physically measure the 'Orphan Energy'.\n");
    int orphans = 0;
    double orphan_re = 0, orphan_im = 0;
    int pairs = 0;
    double pair_re = 0, pair_im = 0;

    for (int i = 0; i < nprimes && primes[i] <= M; i++) {
        int p = primes[i];
        double theta = M_PI * p / N;
        
        if (is_prime(M - p)) {
            pairs++;
            pair_re += cos(theta);
            pair_im += sin(theta);
        } else {
            orphans++;
            orphan_re += cos(theta);
            orphan_im += sin(theta);
        }
    }

    int total_p = 0; for(int i=0;i<nprimes && primes[i]<=M; i++) total_p++;
    
    printf("  Total Primes : %d\n", total_p);
    printf("  Paired Primes: %d (forming %d Goldbach pairs)\n", pairs, pairs/2);
    printf("  Orphan Primes: %d\n\n", orphans);

    printf("  Energy of PAIRED primes (must be purely real):\n");
    printf("     Re: %10.2f\n", pair_re);
    printf("     Im: %10.2f  (Perfect cancellation.)\n\n", pair_im);

    printf("  Energy of ORPHAN primes:\n");
    printf("     Re: %10.2f\n", orphan_re);
    printf("     Im: %10.2f\n\n", orphan_im);

    printf("   THE SPIRAL'S TRANSLATION \n");
    printf("  By mapping p → exp(i π p / N), we transformed the combinatorial\n");
    printf("  sum p+q=2N into geometric reflection across the real axis.\n\n");

    printf("  The paired primes form horizontal chords. Their imaginary parts cancel.\n");
    printf("  The orphan primes DO NOT CANCEL. They form a chaotic spiral.\n\n");

    printf("  The Goldbach Conjecture states: 'The number of Paired Primes > 0'.\n");
    printf("  In this geometric space, this translates to:\n");
    printf("  'Does the total sum S(M) contain ANY purely real conjugate components,\n");
    printf("   or is it 100%% orphan spiral?'\n\n");

    printf("  But mathematically, the sum S(M) is just a single vector (%.2f + %.2fi).\n", re_sum, im_sum);
    printf("  You CANNOT deductively reverse-engineer a single 2D vector\n");
    printf("  to prove it contains specific symmetric chords.\n");
    printf("  (e.g., vector (10, 5) could be made of 100 orphans and 0 pairs,\n");
    printf("  or 50 orphans and 25 pairs). Information is lost in the sum.\n\n");

    return 0;
}
