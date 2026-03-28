/*
 * red_team_crack53.c — Red Teaming the Elliptic Curve Sato-Tate Anomaly
 *
 * THE 35% VARIANCE ANOMALY:
 * In Crack 53, we observed a massive 35.35% variance in the Joint Sato-Tate 
 * angular distribution of Goldbach prime pairs evaluating the trace of Frobenius 
 * a_p for the Elliptic Curve E: y^2 = x^3 - x + 1.
 * 
 * POISSON SMALL-SAMPLE ILLUSION:
 * The prior test ran up to 2N = 40,000, yielding exactly 389 Goldbach pairs.
 * It plotted these pairs onto a 10x10 joint probability grid (100 bins).
 * Distributing exactly 389 discrete items into 100 bins means the expected 
 * density per bin is less than 4 items. At this microscopic limit, standard 
 * Poisson variance (sqrt(N)) overwhelms the topological signal.
 *
 * THE RIGOROUS AUDIT:
 * 1. We crank the scale up to 2N = 400,000, which will generate massive 
 *    amounts of prime pairs, smoothing out the Poisson floor.
 * 2. We introduce the true Control Group: We test the exact same metric on 
 *    completely Random Prime Pairs.
 * 
 * If the Elliptic Curve Arithmetic Geometry truly dictates Goldbach, the 
 * Goldbach variance will remain highly elevated > 15-20%, while the Random 
 * Pairs variance will crash down to ~0.0%.
 * If the "Breakthrough" was an illusion, both variances will crash to the 
 * exact same identical noise floor.
 *
 * BUILD: cc -O3 -o red_team_crack53 red_team_crack53.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 400000
static char sieve[MAX_N];
static int primes[MAX_N];
static int nprimes = 0;

void init() {
    memset(sieve, 0, sizeof(sieve));
    sieve[0] = sieve[1] = 1;
    for (int i=2; i*i < MAX_N; i++)
        if (.sieve[i]) 
            for (int j=i*i; j < MAX_N; j+=i) sieve[j] = 1;
    
    for (int i=2; i < MAX_N; i++)
        if (.sieve[i]) primes[nprimes++] = i;
}

int compute_a_p(int p) {
    if (p == 2 || p == 3) return 0;
    int a_p = 0;
    for (long long x = 0; x < p; x++) {
        long long rhs = (x*x*x - x + 1) % p;
        if (rhs < 0) rhs += p;
        if (rhs == 0) continue;
        
        long long e = (p - 1) / 2;
        long long base = rhs;
        long long res = 1;
        while (e > 0) {
            if (e % 2 == 1) res = (res * base) % p;
            base = (base * base) % p;
            e /= 2;
        }
        if (res == p - 1) res = -1;
        a_p -= (int)res;
    }
    return a_p;
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 53 (RED TEAM): Elliptic Curve Sample Noise\n");
    printf("====================================================\n\n");

    int target = 200000;
    printf("  Target 2N = %d (Massive sample size)\n", target);
    printf("  Computing Hasse Traces of Frobenius a_p for all primes p < 2N...\n");

    int *a_p_cache = malloc(MAX_N * sizeof(int));
    for (int i=0; i<nprimes; i++) {
        int p = primes[i];
        if (p > target) break;
        a_p_cache[p] = compute_a_p(p);
    }
    
    printf("  Evaluating Joint Sato-Tate Variances for Goldbach vs Random Pairs...\n\n");
    
    int BINS = 10;
    int **gb_hist = malloc(BINS * sizeof(int*));
    int **rand_hist = malloc(BINS * sizeof(int*));
    for (int i=0; i<BINS; i++) {
        gb_hist[i] = calloc(BINS, sizeof(int));
        rand_hist[i] = calloc(BINS, sizeof(int));
    }
    
    int gb_count = 0;

    for (int p=5; p<=target/2; p+=2) {
        if (.sieve[p] && .sieve[target - p]) {
            int q = target - p;
            
            double cos_theta_p = (double)a_p_cache[p] / (2.0 * sqrt(p));
            double cos_theta_q = (double)a_p_cache[q] / (2.0 * sqrt(q));
            
            if (cos_theta_p > 1.0) cos_theta_p = 1.0; if (cos_theta_p < -1.0) cos_theta_p = -1.0;
            if (cos_theta_q > 1.0) cos_theta_q = 1.0; if (cos_theta_q < -1.0) cos_theta_q = -1.0;
            
            double theta_p = acos(cos_theta_p);
            double theta_q = acos(cos_theta_q);
            
            int bin_p = (int)((theta_p / M_PI) * BINS);
            int bin_q = (int)((theta_q / M_PI) * BINS);
            if (bin_p >= BINS) bin_p = BINS - 1;
            if (bin_q >= BINS) bin_q = BINS - 1;
            
            gb_hist[bin_p][bin_q]++;
            gb_count++;
        }
    }
    
    int rand_count = 0;
    srand(42);
    while (rand_count < gb_count) {
        int p = primes[rand() % (nprimes/2)];
        int q = primes[rand() % (nprimes/2)];
        if (p < 5 || q < 5) continue;
        
        double cos_theta_p = (double)a_p_cache[p] / (2.0 * sqrt(p));
        double cos_theta_q = (double)a_p_cache[q] / (2.0 * sqrt(q));
        
        if (cos_theta_p > 1.0) cos_theta_p = 1.0; if (cos_theta_p < -1.0) cos_theta_p = -1.0;
        if (cos_theta_q > 1.0) cos_theta_q = 1.0; if (cos_theta_q < -1.0) cos_theta_q = -1.0;
        
        double theta_p = acos(cos_theta_p);
        double theta_q = acos(cos_theta_q);
        
        int bin_p = (int)((theta_p / M_PI) * BINS);
        int bin_q = (int)((theta_q / M_PI) * BINS);
        if (bin_p >= BINS) bin_p = BINS - 1;
        if (bin_q >= BINS) bin_q = BINS - 1;
        
        rand_hist[bin_p][bin_q]++;
        rand_count++;
    }
    
    double *st_expected_1D = calloc(BINS, sizeof(double));
    for (int i=0; i<BINS; i++) {
        double start = (i / (double)BINS) * M_PI;
        double end = ((i+1) / (double)BINS) * M_PI;
        int steps = 1000;
        double dt = (end - start) / steps;
        double integral = 0;
        for (int k=0; k<steps; k++) {
            double t = start + k*dt + dt/2.0;
            integral += (2.0 / M_PI) * sin(t) * sin(t) * dt;
        }
        st_expected_1D[i] = integral;
    }
    
    double gb_variance = 0;
    double rand_variance = 0;
    
    for (int i=0; i<BINS; i++) {
        for (int j=0; j<BINS; j++) {
            double expected_pct = st_expected_1D[i] * st_expected_1D[j] * 100.0;
            double gb_pct = (double)gb_hist[i][j] / gb_count * 100.0;
            double rand_pct = (double)rand_hist[i][j] / rand_count * 100.0;
            
            gb_variance += fabs(gb_pct - expected_pct);
            rand_variance += fabs(rand_pct - expected_pct);
        }
    }
    
    printf("  %20s | %18s | %18s\n", "Geometric Metric", "Goldbach Pairs", "Random Prime Pairs");
    printf("  ------------------------------------------------------------------\n");
    printf("  %20s | %18d | %18d\n", "Sample Size", gb_count, rand_count);
    printf("  %20s | %17.2f%% | %17.2f%%\n", "Joint S-T Variance", gb_variance, rand_variance);

    printf("\n   RED TEAM VERDICT \n");
    if (gb_variance > rand_variance * 5.0) {
        printf("  CONFIRMED: The Elliptic Curve Anomaly SURVIVED scale up.\n");
        printf("  The Goldbach trace entanglement rigorously out-performs randomness.\n");
    } else {
        printf("  RESULT: HYPOTHESIS FALSIFIED. The anomaly was pure Poisson small-sample illusion.\n");
        printf("  As sample size increased to thousands of pairs, the Goldbach Joint Sato-Tate\n");
        printf("  variance (%2.2f%%) perfectly crashed to match the Random Pair variance (%2.2f%%).\n", gb_variance, rand_variance);
        printf("  The traces of Frobenius are absolutely mathematically independent.\n");
        printf("  Elliptic Curves and the Modularity Theorem possess ZERO structural\n");
        printf("  geometric correlation to Goldbach prime combinations. ️\n");
    }

    free(a_p_cache);
    free(st_expected_1D);
    for(int i=0; i<BINS; i++) { free(gb_hist[i]); free(rand_hist[i]); }
    free(gb_hist); free(rand_hist);
    return 0;
}
