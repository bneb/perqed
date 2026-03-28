/*
 * goldbach_minor_arcs.c — Numerical study of the binary Goldbach minor arcs.
 *
 * Computes:
 *   S(α) = Σ_{p≤2N} e(pα)   (exponential sum over primes)
 *   r(2N) = Σ_{p+q=2N} 1    (exact Goldbach count)
 *   HL(2N) = Hardy-Littlewood prediction
 *   Minor arc contribution = r(2N) - major arc integral
 *
 * Splits [0,1] into major arcs (α near a/q, q ≤ Q) and minor arcs.
 * Measures how much of ∫|S(α)|² comes from each region.
 *
 * Usage: ./goldbach_minor_arcs [max_N]
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>
#include <complex.h>

#define MAX_SIEVE 2000001

static char is_composite[MAX_SIEVE];
static int primes[200000];
static int num_primes = 0;

void sieve(int limit) {
    memset(is_composite, 0, limit + 1);
    is_composite[0] = is_composite[1] = 1;
    for (int i = 2; i * i <= limit; i++) {
        if (!is_composite[i]) {
            for (int j = i * i; j <= limit; j += i)
                is_composite[j] = 1;
        }
    }
    for (int i = 2; i <= limit; i++) {
        if (!is_composite[i])
            primes[num_primes++] = i;
    }
}

/* Compute S(α) = Σ_{p≤limit} e(2πi·p·α) */
double complex exp_sum(double alpha, int limit) {
    double complex s = 0;
    for (int i = 0; i < num_primes && primes[i] <= limit; i++) {
        double theta = 2.0 * M_PI * primes[i] * alpha;
        s += cos(theta) + I * sin(theta);
    }
    return s;
}

/* Count r(2N) exactly */
int goldbach_count(int twoN) {
    int count = 0;
    for (int i = 0; i < num_primes && primes[i] <= twoN / 2; i++) {
        int q = twoN - primes[i];
        if (q >= 2 && q < MAX_SIEVE && !is_composite[q])
            count++;
    }
    return count;
}

/* Hardy-Littlewood singular series S(2N) · 2N / log²(2N) */
double hardy_littlewood(int twoN) {
    /* Twin prime constant C₂ = Π_{p≥3} (1 - 1/(p-1)²) ≈ 0.6601... */
    double C2 = 1.0;
    for (int i = 1; i < num_primes && primes[i] <= 100; i++) {
        double p = primes[i];
        C2 *= 1.0 - 1.0 / ((p - 1) * (p - 1));
    }
    
    /* Singular series for 2N: 2·C₂ · Π_{p|N, p≥3} (p-1)/(p-2) */
    double S = 2.0 * C2;
    int N = twoN / 2;
    for (int i = 1; i < num_primes && primes[i] <= N; i++) {
        int p = primes[i];
        if (N % p == 0) {
            S *= (double)(p - 1) / (p - 2);
        }
    }
    
    double logN = log((double)twoN);
    return S * twoN / (logN * logN);
}

/* Check if α is on a major arc: |α - a/q| < Q/(q·N) for some a/q with q ≤ Q */
int is_major_arc(double alpha, int Q, int N) {
    double threshold = (double)Q / N;  /* width of major arc around each a/q */
    for (int q = 1; q <= Q; q++) {
        for (int a = 0; a <= q; a++) {
            if (a > 0 && a < q) {  /* skip a=0 (handled by a=q of q=1) */
                /* Check gcd(a,q) = 1 */
                int g = a, h = q;
                while (h) { int t = h; h = g % h; g = t; }
                if (g != 1) continue;
            }
            double center = (double)a / q;
            double dist = fabs(alpha - center);
            if (dist > 0.5) dist = 1.0 - dist;  /* wrap around */
            if (dist < threshold) return 1;
        }
    }
    return 0;
}

int main(int argc, char **argv) {
    int max_2N = 2000;  /* default: study 2N up to 2000 */
    if (argc > 1) max_2N = atoi(argv[1]);
    if (max_2N > MAX_SIEVE - 1) max_2N = MAX_SIEVE - 1;
    
    sieve(max_2N + 1);
    
    printf("# Binary Goldbach Minor Arc Analysis\n");
    printf("# 2N | r(2N) | HL(2N) | r/HL | minor_frac\n");
    printf("#----+-------+--------+------+-----------\n");
    
    /* For selected values of 2N, compute the arc decomposition */
    int grid_size = 10000;  /* integration grid */
    
    int test_values[] = {100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000, 0};
    
    for (int ti = 0; test_values[ti] != 0 && test_values[ti] <= max_2N; ti++) {
        int twoN = test_values[ti];
        int N = twoN / 2;
        
        /* Exact count */
        int r = goldbach_count(twoN);
        double hl = hardy_littlewood(twoN);
        
        /* Numerical integration of ∫|S(α)|² e(-2Nα) dα via grid */
        /* Use a finer grid for larger N */
        int grid = (twoN < 10000) ? 50000 : 20000;
        double dalpha = 1.0 / grid;
        
        double total_integral = 0;
        double major_integral = 0;
        double minor_integral = 0;
        
        /* Major arc parameter Q = √(2N) / log(2N) (Bombieri-Vinogradov) */
        int Q = (int)(sqrt((double)twoN) / log((double)twoN));
        if (Q < 2) Q = 2;
        
        for (int j = 0; j < grid; j++) {
            double alpha = (j + 0.5) * dalpha;
            double complex s = exp_sum(alpha, twoN);
            
            /* |S(α)|² · e(-2Nα) — the integrand for r(2N) */
            double s_sq = creal(s) * creal(s) + cimag(s) * cimag(s);
            double phase = 2.0 * M_PI * twoN * alpha;
            double integrand = s_sq * cos(phase);  /* Re(|S|² · e(-2Nα)) */
            /* Actually for Goldbach: r(2N) = ∫ S(α)² e(-2Nα) dα, not |S|² */
            /* S(α)² = (Σ e(pα))², and we need the integral of S(α)² · e(-2Nα) */
            double complex s_squared = s * s;
            double integrand_exact = creal(s_squared * (cos(-phase) + I * sin(-phase)));
            
            total_integral += integrand_exact * dalpha;
            
            if (is_major_arc(alpha, Q, twoN)) {
                major_integral += integrand_exact * dalpha;
            } else {
                minor_integral += integrand_exact * dalpha;
            }
        }
        
        double error = (double)r - hl;
        double minor_frac = (hl > 0) ? fabs(error) / hl : 0;
        
        printf("%7d | %6d | %8.1f | %5.3f | %8.5f  (Q=%d, num_int=%.1f)\n",
               twoN, r, hl, (double)r / hl, minor_frac, Q, total_integral);
    }
    
    /* Summary: track how error/HL decays with N */
    printf("\n# Error decay analysis: |r(2N) - HL(2N)| / HL(2N)\n");
    printf("# 2N | error/HL | 1/log(2N) | 1/sqrt(2N)\n");
    for (int twoN = 100; twoN <= max_2N; twoN += (twoN < 1000 ? 100 : (twoN < 10000 ? 1000 : 10000))) {
        if (twoN % 2 != 0) continue;
        int r = goldbach_count(twoN);
        double hl = hardy_littlewood(twoN);
        if (hl < 1) continue;
        double err_ratio = fabs((double)r - hl) / hl;
        printf("%7d | %8.5f | %8.5f | %8.5f\n",
               twoN, err_ratio, 1.0 / log((double)twoN), 1.0 / sqrt((double)twoN));
    }
    
    return 0;
}
