/*
 * goldbach_ratio.c — Track r(2N)/HL(2N) for large N.
 * Fast: only counts + HL prediction, no exponential sum.
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

#define MAX_SIEVE 4000001
static char is_composite[MAX_SIEVE];

void sieve(int limit) {
    memset(is_composite, 0, limit + 1);
    is_composite[0] = is_composite[1] = 1;
    for (int i = 2; (long long)i * i <= limit; i++)
        if (!is_composite[i])
            for (int j = i * i; j <= limit; j += i)
                is_composite[j] = 1;
}

int goldbach_count(int twoN) {
    int count = 0;
    for (int p = 2; p <= twoN / 2; p++) {
        if (!is_composite[p] && !is_composite[twoN - p])
            count++;
    }
    return count;
}

double hardy_littlewood(int twoN) {
    /* C₂ = ∏_{p≥3} (1 - 1/(p-1)²) ≈ 0.6601618... (twin prime constant) */
    double C2 = 1.0;
    /* Use enough primes for convergence */
    for (int p = 3; p < MAX_SIEVE && !is_composite[p]; ) {
        C2 *= 1.0 - 1.0 / ((double)(p-1) * (p-1));
        /* find next prime */
        p++;
        while (p < MAX_SIEVE && is_composite[p]) p++;
        if (p > 1000) break;  /* convergence */
    }
    
    /* Singular series: 2·C₂ · ∏_{p|N, p≥3} (p-1)/(p-2) */
    double S = 2.0 * C2;
    int N = twoN / 2;
    for (int p = 3; p <= N; p++) {
        if (is_composite[p]) continue;
        if (N % p == 0)
            S *= (double)(p - 1) / (p - 2);
    }
    
    double logn = log((double)twoN);
    return S * (double)twoN / (logn * logn);
}

int main() {
    sieve(MAX_SIEVE - 1);
    
    printf("# r(2N)/HL(2N) convergence study\n");
    printf("# %8s | %8s | %10s | %7s | %10s | %10s\n",
           "2N", "r(2N)", "HL(2N)", "r/HL", "err/HL", "1/√log2N");
    
    /* Sample at powers of 2 and round numbers */
    int tests[] = {
        100, 200, 500, 1000, 2000, 5000, 10000, 20000,
        50000, 100000, 200000, 500000, 1000000, 2000000, 4000000, 0
    };
    
    for (int i = 0; tests[i] != 0; i++) {
        int twoN = tests[i];
        if (twoN >= MAX_SIEVE) break;
        
        int r = goldbach_count(twoN);
        double hl = hardy_littlewood(twoN);
        double ratio = r / hl;
        double err = fabs(r - hl) / hl;
        double inv_sqrt_log = 1.0 / sqrt(log((double)twoN));
        
        printf("  %8d | %8d | %10.1f | %7.4f | %10.5f | %10.5f\n",
               twoN, r, hl, ratio, err, inv_sqrt_log);
    }
    
    /* Fine-grained: every 10000 from 10000 to 1M, track min r/HL */
    double min_ratio = 999;
    int min_N = 0;
    printf("\n# Min r/HL over ranges:\n");
    for (int twoN = 10000; twoN <= 2000000 && twoN < MAX_SIEVE; twoN += 2) {
        int r = goldbach_count(twoN);
        double hl = hardy_littlewood(twoN);
        if (hl > 0) {
            double ratio = r / hl;
            if (ratio < min_ratio) {
                min_ratio = ratio;
                min_N = twoN;
            }
        }
        if (twoN % 200000 == 0) {
            printf("  Up to %8d: min r/HL = %.5f at 2N = %d\n",
                   twoN, min_ratio, min_N);
        }
    }
    
    return 0;
}
