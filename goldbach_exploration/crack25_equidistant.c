/*
 * crack25_equidistant.c — The Continuous Equidistant Projection
 *
 * HYPOTHESIS: Map p + q = 2N to 1 - p/N = q/N - 1.
 * Let x = p/N. Then x ∈ (0, 2].
 * We are looking for symmetry around 1: x and 2-x both in the prime set A_N.
 *
 * By dividing by N, we normalize the domain to [0, 2]. As N → ∞, the grid
 * size 1/N → 0. The discrete set of primes becomes a dense "dust" in [0, 2].
 *
 * The Prime Number Theorem says the macroscopic density of this dust at x
 * is 1 / log(xN). Rescaled by log N, the density approaches a flat uniform
 * measure on [0, 2].
 *
 * But does the CONTINUUM limit tell us anything about exact intersections?
 * Let's physically map the points p/N and compute the "overlap" at
 * increasing resolutions to show the mathematical paradox of the continuum limit.
 *
 * BUILD: cc -O3 -o crack25 crack25_equidistant.c -lm
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
    printf("  CRACK 25: Continuous Equidistant Projection\n");
    printf("====================================================\n\n");

    printf("  Mapping: 1 - p/N = q/N - 1  ==>  Let x = p/N, y = q/N\n");
    printf("  We seek x + y = 2 where x, y are in the normalized prime set A_N.\n\n");

    int N_vals[] = {1000, 10000, 100000, 500000, 0};
    
    // We will bucket the interval [0, 2] into BINS to see the continuous density
    int BINS = 50;
    
    for (int idx = 0; N_vals[idx]; idx++) {
        int N = N_vals[idx];
        
        int *density = calloc(BINS, sizeof(int));
        int *overlap = calloc(BINS, sizeof(int)); // How many pairs fall into this bin

        // 1. Measure Prime Density in Continuous Space
        for (int i = 0; i < nprimes && primes[i] <= 2*N; i++) {
            double x = (double)primes[i] / N;
            int bin = (int)(x * BINS / 2.0);
            if (bin >= BINS) bin = BINS - 1;
            density[bin]++;
        }

        // 2. Measure Overlap Density (Goldbach Pairs)
        int r = 0;
        for (int p = 2; p <= N; p++) {
            if (is_prime(p) && is_prime(2*N - p)) {
                r++;
                double x = (double)p / N;
                int bin = (int)(x * BINS / 2.0);
                if (bin >= BINS) bin = BINS - 1;
                overlap[bin]++;
            }
        }

        printf("  N = %d (Total Primes = %d, Total Pairs = %d)\n", N, density[0]*BINS /* rough */, r);
        
        // Print the continuous profile for N=500,000
        if (N == 500000) {
            printf("\n  Density Profile of A_N and Intersections over [0, 2]:\n");
            printf("  %6s | %10s | %10s | %s\n", "x-span", "p/N mass", "Pair mass", "Visual Density (Primes: #, Overlap: *)");
            
            int max_d = 0;
            for(int b=0; b<BINS/2; b++) { if (density[b] > max_d) max_d = density[b]; }

            for (int b = 0; b < BINS / 2; b++) {
                double x_start = (double)b * 2.0 / BINS;
                double x_end = (double)(b+1) * 2.0 / BINS;
                
                int len_p = (int)((double)density[b] / max_d * 40.0);
                int len_o = (int)((double)overlap[b] / max_d * 40.0 * 20.0); // scale up for visibility
                
                char bar[100]; memset(bar, ' ', 80);
                for(int j=0; j<len_p; j++) bar[j] = '#';
                for(int j=0; j<len_o; j++) bar[j] = '*'; // Overwrite with overlap
                bar[40] = 0;
                
                printf("  %3.1f-%3.1f| %10d | %10d | %s\n", x_start, x_end, density[b], overlap[b], bar);
            }
            printf("\n");
        }
        free(density);
        free(overlap);
    }

    printf("   THE CONTINUUM PARADOX \n");
    printf("  As N → ∞, the density of x = p/N approaches the smooth\n");
    printf("  curve 1 / (log N + log x). The macroscopic \"gas\" of primes\n");
    printf("  perfectly fills the interval [0, 2].\n\n");

    printf("  But an overlap in continuous space (Lebesgue measure)\n");
    printf("  DOES NOT GUARANTEE a microscopic exact hit x + y = 2.\n");
    printf("  Two points can be arbitrarily close (p/N + q/N = 2.000001)\n");
    printf("  but fail Goldbach because p+q = 2N + 2.\n\n");

    printf("  Dividing by N shrinks the target from size 1 to size 1/N.\n");
    printf("  To prove x + y = 2 exactly, your mathematical measuring stick\n");
    printf("  must have resolution finer than 1/N.\n");
    printf("  Since 1/N → 0, any topological or continuous integration\n");
    printf("  tool (which requires epsilon > 0) becomes mathematically\n");
    printf("  blind to the discrete collisions.\n\n");

    printf("  This is exactly the 'Moving Frequency' topological block\n");
    printf("  we found in CRACK 24. Translating to [0,2] just maps the\n");
    printf("  high-frequency minor arcs directly into resolving 1/N scale dots.\n");

    return 0;
}
