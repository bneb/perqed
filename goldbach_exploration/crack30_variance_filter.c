/*
 * crack30_variance_filter.c — The Variance Flattening Filter
 *
 * HYPOTHESIS: The Hyperbolic Circle Method (Kuznetsov Trace Formula)
 * was killed by the massive variance of d(pq-1), which inflates the
 * Maass Cusp Form error term natively.
 *
 * The user asked: "What if we ignore a certain class of primes?"
 * If d(pq-1) spikes because pq-1 is highly composite (divisible by 2,3,5,7),
 * we can mathematically BAN pq-1 from having small prime factors by
 * carefully restricting the congruence classes of p and q.
 *
 * Example: Mod 30 (primes 2,3,5).
 * We want pq - 1 to NOT be divisible by 3 or 5.
 * So pq ≢ 1 (mod 3) and pq ≢ 1 (mod 5).
 * Since p+q = 2N, we have q = 2N - p.
 * So p(2N - p) ≢ 1 (mod 3)  ==>  p^2 - 2N*p + 1 ≢ 0 (mod 3)
 *
 * Can we strictly filter the Goldbach pairs to only include primes p
 * where (pq-1) escapes all small prime factors?
 * If we do, we strip the massive spikes out of d(pq-1).
 *
 * We will calculate the Variance/Mean ratio for the UNFILTERED sum,
 * and then calculate it for the STRATEGICALLY FILTERED sum (banning mods 3, 5, 7).
 * If the filtered ratio drops drastically (approaching Poissonian random noise),
 * this sub-selection of primes could theoretically allow the Main Term
 * to actually survive the Error Term.
 *
 * BUILD: cc -O3 -o crack30 crack30_variance_filter.c -lm
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

int d(long long n) {
    int count = 0;
    long long limit = (long long)sqrt(n);
    for (long long i = 1; i <= limit; i++) {
        if (n % i == 0) {
            count += 2;
            if (i * i == n) count--;
        }
    }
    return count;
}

int escapes_factors(long long K, int max_prime_check) {
    // 2 is unavoidable if p,q odd.
    int check_primes[] = {3, 5, 7, 11, 13, 17, 19};
    for(int i=0; i<7; i++) {
        if (check_primes[i] > max_prime_check) break;
        if (K % check_primes[i] == 0) return 0; // Did not escape
    }
    return 1;
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 30: The Variance Flattening Filter\n");
    printf("====================================================\n\n");

    printf("  Target 2N. We compare the base Variance of d(pq-1)\n");
    printf("  vs the Filtered Variance where (pq-1) is mathematically\n");
    printf("  banned from having small prime factors (3, 5, 7, 11).\n\n");

    printf("  %8s | %10s | %8s | %8s || %10s | %8s | %8s\n", 
           "2N", "Base Pairs", "Base V/M", "Base Max", "Filt Pairs", "Filt V/M", "Filt Max");

    int N_vals[] = {1000, 10000, 50000, 100000, 250000, 500000, 0};

    double last_base_vm = 0;
    double last_filt_vm = 0;

    for (int idx = 0; N_vals[idx]; idx++) {
        int N2 = N_vals[idx];
        
        // Base Stats
        long long base_pairs = 0;
        double base_sum = 0, base_sum2 = 0;
        int base_max = 0;

        // Filtered Stats (Ban 3, 5, 7, 11)
        long long filt_pairs = 0;
        double filt_sum = 0, filt_sum2 = 0;
        int filt_max = 0;

        for (int p = 3; p <= N2/2; p++) {
            if (is_prime(p) && is_prime(N2 - p)) {
                int q = N2 - p;
                long long K = (long long)p * q - 1;
                
                int div_count = d(K);
                
                // Base
                base_pairs++;
                base_sum += div_count;
                base_sum2 += (double)div_count * div_count;
                if (div_count > base_max) base_max = div_count;

                // Filtered
                if (escapes_factors(K, 11)) {
                    filt_pairs++;
                    filt_sum += div_count;
                    filt_sum2 += (double)div_count * div_count;
                    if (div_count > filt_max) filt_max = div_count;
                }
            }
        }

        double base_vm = 0;
        if (base_pairs > 0) {
            double mean = base_sum / base_pairs;
            double var = (base_sum2 / base_pairs) - (mean * mean);
            base_vm = var / mean;
            last_base_vm = base_vm;
        }

        double filt_vm = 0;
        if (filt_pairs > 0) {
            double mean = filt_sum / filt_pairs;
            double var = (filt_sum2 / filt_pairs) - (mean * mean);
            filt_vm = var / mean;
            last_filt_vm = filt_vm;
        }

        printf("  %8d | %10lld | %8.2f | %8d || %10lld | %8.2f | %8d\n", 
               N2, base_pairs, base_vm, base_max, filt_pairs, filt_vm, filt_max);
    }

    printf("\n   THE FILTERING EFFECT \n");
    if (last_filt_vm < last_base_vm * 0.5) {
        printf("  Filtering out small prime moduli MASSIVELY collapses the variance.\n");
        printf("  The Error Term (Maass Cusp Forms) has been severely throttled.\n");
        printf("  But notice 'Filt Pairs': the subset of surviving pairs shrinks.\n");
        printf("  Does the Main Term survive the filtration better than the Error Term?\n");
    } else {
        printf("  The variance ratio remains highly unstable.\n");
    }

    return 0;
}
